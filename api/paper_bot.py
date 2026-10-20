"""
Live side of paper trading: fetching prices/signals, running target/stop
checks and the bot, and the background thread that does both on a timer.

Network calls (quotes, the analysis pipeline) happen outside the account
lock; the decision itself is re-made inside paper_store.mutate against the
freshly loaded account, so a slow fetch can never act on stale state.

The thread only runs while this process is up. On Render's free tier that
means while someone is using the app - by design (see
docs/superpowers/specs/2026-10-20-paper-trading-design.md). GET
/paper/account also runs the target/stop check, so a server that just woke
up corrects positions before showing them.
"""
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, Optional

from analysis import paper_trading as pt
from api import deps, paper_store

logger = logging.getLogger("AIEquityResearchPlatform")

TICK_SECONDS = 60
BOT_INTERVAL = timedelta(minutes=5)

_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()


# --------------------------------------------------------------------------
# Market data (monkeypatched in tests)
# --------------------------------------------------------------------------

def get_quote(ticker: str) -> Optional[Dict[str, Any]]:
    """Live quote, or None if no real price could be fetched (never trade on a placeholder)."""
    from api.routers.analysis import fetch_live_quote
    try:
        quote = fetch_live_quote(ticker, deps.get_live_cache(), deps.get_cache())
    except Exception as e:
        logger.warning(f"Paper trading: quote failed for {ticker}: {e}")
        return None
    if quote.get("is_fallback_price") or not quote.get("price"):
        return None
    return quote


def get_prices(tickers: Iterable[str]) -> Dict[str, float]:
    unique = sorted(set(tickers))
    if not unique:
        return {}
    with ThreadPoolExecutor(max_workers=min(8, len(unique))) as ex:
        quotes = dict(zip(unique, ex.map(get_quote, unique)))
    return {t: q["price"] for t, q in quotes.items() if q}


def get_signal(ticker: str) -> Optional[Dict[str, Any]]:
    """The same 1D trade signal the dashboard shows, or None on failure."""
    from api.routers.analysis import _run_deterministic_pipeline
    try:
        report = _run_deterministic_pipeline(
            ticker=ticker,
            downloader=deps.get_downloader(),
            cache=deps.get_cache(),
            live_cache=deps.get_live_cache(),
            report_generator=deps.get_report_generator(),
            feature_store=deps.get_feature_store(),
            scorer=deps.get_scorer(),
            market_downloader=deps.get_market_downloader(),
            interval="1d",
            skip_intelligence=True,
        )
    except Exception as e:
        logger.warning(f"Paper bot: signal failed for {ticker}: {e}")
        return None
    return report.get("trade_signal")


def company_name_for(ticker: str) -> Optional[str]:
    from api.routers.market_opportunities import load_symbols_catalog
    for item in load_symbols_catalog():
        if item.get("ticker") == ticker:
            return item.get("name")
    return None


# --------------------------------------------------------------------------
# Account jobs
# --------------------------------------------------------------------------

def run_exit_checks(username: str, now: Optional[datetime] = None) -> list:
    """Sells any of the user's positions that hit target/stop. Market hours only."""
    now = now or paper_store.market_now()
    if not pt.is_market_open(now):
        return []
    account = paper_store.load(username)
    tickers = [p["ticker"] for p in account["positions"]
               if p.get("target") is not None or p.get("stop") is not None]
    if not tickers:
        return []
    prices = get_prices(tickers)
    if not prices:
        return []
    return paper_store.mutate(username, lambda acc: pt.check_exits(acc, prices, now))


def run_bot(username: str, now: Optional[datetime] = None) -> list:
    """One bot pass over the user's watch list. Returns the decisions made."""
    now = now or paper_store.market_now()
    account = paper_store.load(username)
    bot = account["bot"]
    if not bot.get("enabled") or not pt.is_market_open(now):
        return []

    held = {p["ticker"] for p in account["positions"] if p["owner"] == "BOT"}
    candidates = [t for t in bot.get("tickers", []) if t not in held]
    def fetch(ticker: str):
        signal = get_signal(ticker)
        if signal is None:
            return None, None
        quote = get_quote(ticker)
        return signal, quote["price"] if quote else None

    gathered = {}
    if candidates:
        with ThreadPoolExecutor(max_workers=min(4, len(candidates))) as ex:
            gathered = dict(zip(candidates, ex.map(fetch, candidates)))

    def apply(acc: pt.Account) -> list:
        decisions = []
        if not acc["bot"].get("enabled"):
            return decisions  # switched off while we were fetching
        for ticker, (signal, price) in gathered.items():
            if signal is None or price is None:
                pt.bot_log(acc, now, ticker, "ERROR", "Couldn't get a signal or live price.")
                continue
            decisions.append(pt.bot_consider(acc, ticker, signal, price, now,
                                             company_name=company_name_for(ticker)))
        acc["bot"]["last_run_at"] = now.isoformat()
        return decisions

    return paper_store.mutate(username, apply)


def _bot_due(account: pt.Account, now: datetime) -> bool:
    last = account["bot"].get("last_run_at")
    if not last:
        return True
    try:
        return now - datetime.fromisoformat(last) >= BOT_INTERVAL
    except (TypeError, ValueError):
        return True


def tick(now: Optional[datetime] = None) -> None:
    """One pass over every account: exits always, the bot when it's due."""
    now = now or paper_store.market_now()
    if not pt.is_market_open(now):
        return
    for username in paper_store.list_accounts():
        try:
            run_exit_checks(username, now)
            account = paper_store.load(username)
            if account["bot"].get("enabled") and _bot_due(account, now):
                run_bot(username, now)
        except Exception as e:
            logger.error(f"Paper trading tick failed for {username}: {e}")


def _loop() -> None:
    while not _stop_event.is_set():
        started = time.monotonic()
        try:
            tick()
        except Exception as e:
            logger.error(f"Paper trading loop error: {e}")
        _stop_event.wait(max(1.0, TICK_SECONDS - (time.monotonic() - started)))


def start() -> None:
    global _thread
    if _thread is not None and _thread.is_alive():
        return
    _stop_event.clear()
    _thread = threading.Thread(target=_loop, name="paper-trading-bot", daemon=True)
    _thread.start()
    logger.info("Paper trading background thread started")


def stop() -> None:
    _stop_event.set()
