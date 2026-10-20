"""
Paper trading API. All rules are in analysis/paper_trading.py, persistence in
api/paper_store.py, live prices/bot in api/paper_bot.py - this module only
validates input, fetches the fill price, and maps rule errors to 400s.

Handlers are sync `def` on purpose: they make blocking yfinance calls, which
FastAPI then runs in its thread pool instead of on the event loop.
"""
import csv
import io
import logging
from typing import List, Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from analysis import paper_trading as pt
from analysis.normalizer import TickerNormalizer
from api import paper_bot, paper_store
from api.routers.user_data import _current_username

logger = logging.getLogger("AIEquityResearchPlatform")

router = APIRouter(prefix="/paper", tags=["Paper trading"])


class OrderRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=32)
    side: Literal["BUY", "SELL"]
    quantity: int = Field(ge=1, le=1_000_000)
    owner: Literal["YOU", "BOT"] = "YOU"
    target: Optional[float] = Field(default=None, gt=0)
    stop: Optional[float] = Field(default=None, gt=0)
    company_name: Optional[str] = Field(default=None, max_length=120)


class LevelsRequest(BaseModel):
    target: Optional[float] = Field(default=None, gt=0)
    stop: Optional[float] = Field(default=None, gt=0)


class BotSettingsRequest(BaseModel):
    enabled: Optional[bool] = None
    tickers: Optional[List[str]] = None
    budget_per_trade: Optional[float] = None
    max_positions: Optional[int] = None


def _bad_request(e: Exception) -> HTTPException:
    return HTTPException(status_code=400, detail=str(e))


def _normalize(ticker: str) -> str:
    return TickerNormalizer.normalize(ticker.strip())


def _account_view(username: str) -> dict:
    now = paper_store.market_now()
    market_open = pt.is_market_open(now)
    if market_open:
        try:
            paper_bot.run_exit_checks(username, now)
        except Exception as e:  # a failed catch-up must not hide the account
            logger.warning(f"Paper catch-up exit check failed for {username}: {e}")
    account = paper_store.load(username)
    prices = paper_bot.get_prices(p["ticker"] for p in account["positions"])
    positions = []
    for p in account["positions"]:
        price = prices.get(p["ticker"])
        value_price = price if price is not None else p["avg_cost"]
        positions.append({
            **p,
            "price": price,
            "market_value": round(p["quantity"] * value_price, 2),
            "unrealized_pnl": round(p["quantity"] * (value_price - p["avg_cost"]), 2),
            "unrealized_pnl_pct": round((value_price / p["avg_cost"] - 1) * 100, 2) if p["avg_cost"] else 0.0,
        })
    bot = account["bot"]
    return {
        "market_open": market_open,
        "as_of": now.isoformat(),
        "summary": pt.summary(account, prices),
        "positions": positions,
        "recent_trades": account["trades"][:20],
        "bot": {k: bot.get(k) for k in ("enabled", "tickers", "budget_per_trade", "max_positions", "last_run_at")},
    }


@router.get("/account")
def get_account(authorization: Optional[str] = Header(None)):
    return _account_view(_current_username(authorization))


@router.post("/orders")
def place_order(order: OrderRequest, authorization: Optional[str] = Header(None)):
    username = _current_username(authorization)
    now = paper_store.market_now()
    if not pt.is_market_open(now):
        raise HTTPException(status_code=400, detail="The market is closed. Paper orders fill during NSE hours, Mon-Fri 9:15 AM - 3:30 PM IST.")
    if order.side == "BUY" and order.owner != "YOU":
        raise HTTPException(status_code=400, detail="Only the bot can buy for the bot.")

    ticker = _normalize(order.ticker)
    quote = paper_bot.get_quote(ticker)
    if quote is None:
        raise HTTPException(status_code=400, detail=f"Couldn't get a live price for {ticker}. Check the symbol and try again.")
    price = quote["price"]

    def apply(acc):
        if order.side == "BUY":
            return pt.buy(acc, ticker, order.quantity, price, now, owner="YOU",
                          target=order.target, stop=order.stop,
                          company_name=order.company_name or paper_bot.company_name_for(ticker))
        return pt.sell(acc, ticker, order.quantity, price, now, owner=order.owner, reason="MANUAL")

    try:
        trade = paper_store.mutate(username, apply)
    except pt.PaperTradingError as e:
        raise _bad_request(e)
    return {"trade": trade}


@router.put("/positions/{owner}/{ticker}/levels")
def set_levels(owner: Literal["YOU", "BOT"], ticker: str, body: LevelsRequest,
               authorization: Optional[str] = Header(None)):
    username = _current_username(authorization)
    ticker = _normalize(ticker)
    quote = paper_bot.get_quote(ticker)
    if quote is None:
        raise HTTPException(status_code=400, detail=f"Couldn't get a live price for {ticker}.")
    try:
        position = paper_store.mutate(
            username, lambda acc: pt.set_levels(acc, ticker, owner, body.target, body.stop, quote["price"]))
    except pt.PaperTradingError as e:
        raise _bad_request(e)
    return {"position": position}


@router.get("/history")
def get_history(limit: int = Query(default=200, ge=1, le=pt.MAX_TRADES),
                authorization: Optional[str] = Header(None)):
    account = paper_store.load(_current_username(authorization))
    return {"trades": account["trades"][:limit]}


@router.get("/history.csv")
def export_history(authorization: Optional[str] = Header(None)):
    account = paper_store.load(_current_username(authorization))
    buf = io.StringIO()
    fields = ["time", "owner", "side", "ticker", "company_name", "quantity", "price", "value",
              "realized_pnl", "reason", "note"]
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for t in account["trades"]:
        writer.writerow(t)
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="paper_trades.csv"'})


@router.get("/bot")
def get_bot(authorization: Optional[str] = Header(None)):
    return {"bot": paper_store.load(_current_username(authorization))["bot"]}


@router.put("/bot")
def update_bot(body: BotSettingsRequest, authorization: Optional[str] = Header(None)):
    username = _current_username(authorization)
    changes = body.model_dump(exclude_none=True)
    if "tickers" in changes:
        changes["tickers"] = [_normalize(t) for t in changes["tickers"] if t and t.strip()]
    try:
        bot = paper_store.mutate(username, lambda acc: pt.update_bot_settings(acc, changes))
    except (pt.PaperTradingError, ValueError, TypeError) as e:
        raise _bad_request(e)
    return {"bot": bot}


@router.post("/reset")
def reset(authorization: Optional[str] = Header(None)):
    username = _current_username(authorization)
    paper_store.replace(username, lambda acc: pt.reset_account(acc, paper_store.market_now()))
    return _account_view(username)
