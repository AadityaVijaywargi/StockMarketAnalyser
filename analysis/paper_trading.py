"""
Paper trading rules: a virtual-cash account with long-only market orders,
target/stop auto-exits and a signal-following bot.

Pure logic, no I/O. An account is a plain JSON-serialisable dict (it's
persisted as one document per user by api/paper_store.py); every function
here either reads it or mutates it in place. Validation happens before any
mutation, so a raised PaperTradingError leaves the account untouched.

This is the only place the trading rules live - the frontend displays
results and submits orders, it never computes fills or exits itself.
"""
import math
import uuid
from datetime import datetime, time as dt_time
from typing import Any, Dict, List, Optional

STARTING_CASH = 1_000_000.0
OWNERS = ("YOU", "BOT")
MAX_TRADES = 1000
MAX_BOT_LOG = 50
MAX_BOT_TICKERS = 15
# An exit filled further than this past its trigger gets an explanatory note
# (typically the server was asleep and the price moved on in the meantime).
GAP_NOTE_PCT = 1.0

DEFAULT_BOT_TICKERS = [
    "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
    "SBIN.NS", "BHARTIARTL.NS", "LT.NS", "ITC.NS", "ASIANPAINT.NS",
]

Account = Dict[str, Any]


class PaperTradingError(ValueError):
    """An order or setting the rules reject. The message is shown to the user."""


def is_market_open(now: datetime) -> bool:
    """NSE regular session, Mon-Fri 09:15-15:30 in the market timezone. No holiday calendar."""
    return now.weekday() < 5 and dt_time(9, 15) <= now.time() <= dt_time(15, 30)


def _money(x: float) -> float:
    return round(float(x), 2)


def _rupees(x: float) -> str:
    return f"₹{x:,.2f}"


def _default_bot() -> Dict[str, Any]:
    return {
        "enabled": False,
        "tickers": list(DEFAULT_BOT_TICKERS),
        "budget_per_trade": 100_000.0,
        "max_positions": 5,
        "last_run_at": None,
        "log": [],
    }


def new_account(now: datetime) -> Account:
    return {
        "version": 1,
        "created_at": now.isoformat(),
        "starting_cash": STARTING_CASH,
        "cash": STARTING_CASH,
        "positions": [],
        "trades": [],
        "realized": {"YOU": 0.0, "BOT": 0.0},
        "wins": {"YOU": 0, "BOT": 0},
        "losses": {"YOU": 0, "BOT": 0},
        "bot": _default_bot(),
    }


def reset_account(account: Account, now: datetime) -> Account:
    """Fresh cash and history; keeps the bot's settings but switches it off."""
    fresh = new_account(now)
    old_bot = account.get("bot") or {}
    for key in ("tickers", "budget_per_trade", "max_positions"):
        if key in old_bot:
            fresh["bot"][key] = old_bot[key]
    return fresh


def find_position(account: Account, ticker: str, owner: str) -> Optional[Dict[str, Any]]:
    for p in account["positions"]:
        if p["ticker"] == ticker and p["owner"] == owner:
            return p
    return None


def _check_owner(owner: str) -> None:
    if owner not in OWNERS:
        raise PaperTradingError(f"Unknown owner {owner!r}")


def _check_quantity(quantity: Any) -> int:
    if isinstance(quantity, bool) or not isinstance(quantity, (int, float)) or quantity != int(quantity) or quantity < 1:
        raise PaperTradingError("Quantity must be a whole number of at least 1 share.")
    return int(quantity)


def _check_price(price: float) -> float:
    if price is None or not math.isfinite(price) or price <= 0:
        raise PaperTradingError("No valid live price for this stock right now.")
    return float(price)


def _check_levels(price: float, target: Optional[float], stop: Optional[float]) -> None:
    if target is not None and not target > price:
        raise PaperTradingError(f"Target must be above the current price ({_rupees(price)}).")
    if stop is not None and not (0 < stop < price):
        raise PaperTradingError(f"Stop-loss must be below the current price ({_rupees(price)}).")


def _record(account: Account, trade: Dict[str, Any]) -> Dict[str, Any]:
    account["trades"].insert(0, trade)
    del account["trades"][MAX_TRADES:]
    return trade


def buy(
    account: Account,
    ticker: str,
    quantity: Any,
    price: float,
    now: datetime,
    owner: str = "YOU",
    target: Optional[float] = None,
    stop: Optional[float] = None,
    reason: str = "MANUAL",
    company_name: Optional[str] = None,
) -> Dict[str, Any]:
    _check_owner(owner)
    qty = _check_quantity(quantity)
    price = _check_price(price)
    _check_levels(price, target, stop)
    cost = _money(qty * price)
    if cost > account["cash"] + 1e-9:
        raise PaperTradingError(
            f"Not enough cash: need {_rupees(cost)}, have {_rupees(account['cash'])}."
        )

    account["cash"] = _money(account["cash"] - cost)
    pos = find_position(account, ticker, owner)
    if pos is None:
        pos = {
            "ticker": ticker,
            "company_name": company_name or ticker,
            "owner": owner,
            "quantity": 0,
            "avg_cost": 0.0,
            "target": None,
            "stop": None,
            "opened_at": now.isoformat(),
        }
        account["positions"].append(pos)
    total_qty = pos["quantity"] + qty
    pos["avg_cost"] = round((pos["quantity"] * pos["avg_cost"] + qty * price) / total_qty, 4)
    pos["quantity"] = total_qty
    if target is not None:
        pos["target"] = float(target)
    if stop is not None:
        pos["stop"] = float(stop)
    pos["updated_at"] = now.isoformat()

    return _record(account, {
        "id": uuid.uuid4().hex[:12],
        "time": now.isoformat(),
        "ticker": ticker,
        "company_name": pos["company_name"],
        "owner": owner,
        "side": "BUY",
        "quantity": qty,
        "price": price,
        "value": cost,
        "realized_pnl": None,
        "reason": reason,
        "note": None,
    })


def sell(
    account: Account,
    ticker: str,
    quantity: Any,
    price: float,
    now: datetime,
    owner: str = "YOU",
    reason: str = "MANUAL",
    note: Optional[str] = None,
) -> Dict[str, Any]:
    _check_owner(owner)
    qty = _check_quantity(quantity)
    price = _check_price(price)
    pos = find_position(account, ticker, owner)
    who = "You" if owner == "YOU" else "The bot"
    if pos is None:
        raise PaperTradingError(f"{who} don't hold any {ticker}." if owner == "YOU" else f"{who} doesn't hold any {ticker}.")
    if qty > pos["quantity"]:
        raise PaperTradingError(f"{who} only hold {pos['quantity']} shares of {ticker}." if owner == "YOU"
                                else f"{who} only holds {pos['quantity']} shares of {ticker}.")

    proceeds = _money(qty * price)
    pnl = _money(qty * (price - pos["avg_cost"]))
    account["cash"] = _money(account["cash"] + proceeds)
    account["realized"][owner] = _money(account["realized"][owner] + pnl)
    if pnl > 0:
        account["wins"][owner] += 1
    else:
        account["losses"][owner] += 1

    pos["quantity"] -= qty
    pos["updated_at"] = now.isoformat()
    if pos["quantity"] == 0:
        account["positions"].remove(pos)

    return _record(account, {
        "id": uuid.uuid4().hex[:12],
        "time": now.isoformat(),
        "ticker": ticker,
        "company_name": pos["company_name"],
        "owner": owner,
        "side": "SELL",
        "quantity": qty,
        "price": price,
        "value": proceeds,
        "realized_pnl": pnl,
        "reason": reason,
        "note": note,
    })


def set_levels(
    account: Account,
    ticker: str,
    owner: str,
    target: Optional[float],
    stop: Optional[float],
    price: float,
) -> Dict[str, Any]:
    """Replaces (or clears, with None) the target/stop on one of your positions."""
    _check_owner(owner)
    if owner != "YOU":
        raise PaperTradingError("The bot manages its own target and stop-loss.")
    pos = find_position(account, ticker, owner)
    if pos is None:
        raise PaperTradingError(f"You don't hold any {ticker}.")
    _check_levels(_check_price(price), target, stop)
    pos["target"] = float(target) if target is not None else None
    pos["stop"] = float(stop) if stop is not None else None
    return pos


def check_exits(account: Account, prices: Dict[str, float], now: datetime) -> List[Dict[str, Any]]:
    """Sells every position whose target or stop the latest price has reached."""
    trades = []
    for pos in list(account["positions"]):
        price = prices.get(pos["ticker"])
        if price is None or not math.isfinite(price) or price <= 0:
            continue
        if pos.get("target") is not None and price >= pos["target"]:
            reason, trigger, label = "TARGET", pos["target"], "Target"
        elif pos.get("stop") is not None and price <= pos["stop"]:
            reason, trigger, label = "STOP", pos["stop"], "Stop"
        else:
            continue
        note = None
        if abs(price - trigger) / trigger * 100 > GAP_NOTE_PCT:
            note = (f"{label} {_rupees(trigger)}, filled at {_rupees(price)} "
                    f"(price moved past the {label.lower()} before it could be checked).")
        trades.append(sell(account, pos["ticker"], pos["quantity"], price, now,
                           owner=pos["owner"], reason=reason, note=note))
    return trades


def bot_log(account: Account, now: datetime, ticker: str, action: str, message: str) -> Dict[str, Any]:
    entry = {"time": now.isoformat(), "ticker": ticker, "action": action, "message": message}
    log = account["bot"].setdefault("log", [])
    log.insert(0, entry)
    del log[MAX_BOT_LOG:]
    return entry


def _bot_sold_today(account: Account, ticker: str, now: datetime) -> bool:
    for t in account["trades"]:
        if t["owner"] == "BOT" and t["side"] == "SELL" and t["ticker"] == ticker:
            sold_at = datetime.fromisoformat(t["time"])
            if now.tzinfo is not None:
                sold_at = sold_at.astimezone(now.tzinfo)
            if sold_at.date() == now.date():
                return True
    return False


def bot_consider(
    account: Account,
    ticker: str,
    signal: Optional[Dict[str, Any]],
    price: float,
    now: datetime,
    company_name: Optional[str] = None,
) -> Dict[str, Any]:
    """One bot decision for one stock: buy on a valid BUY_NOW signal, otherwise log why not."""
    def skip(message: str) -> Dict[str, Any]:
        return {"action": "SKIP", "message": message, "trade": None,
                "log": bot_log(account, now, ticker, "SKIP", message)}

    bot = account["bot"]
    if find_position(account, ticker, "BOT") is not None:
        return skip("Already holding it.")
    signal_type = (signal or {}).get("signal_type")
    if signal_type != "BUY_NOW":
        label = (signal or {}).get("signal") or signal_type or "unavailable"
        return skip(f"Signal is {label}, not BUY NOW.")
    target = signal.get("target_price")
    stop = signal.get("stop_loss_price")
    if target is None or stop is None or not (0 < stop < price < target):
        return skip("Signal's target/stop don't bracket the current price.")
    open_bot = sum(1 for p in account["positions"] if p["owner"] == "BOT")
    if open_bot >= bot["max_positions"]:
        return skip(f"Already at the max of {bot['max_positions']} bot positions.")
    if _bot_sold_today(account, ticker, now):
        return skip("Sold it earlier today; waiting until tomorrow to re-enter.")

    spend = min(bot["budget_per_trade"], account["cash"])
    qty = int(spend // price)
    if qty < 1:
        return skip(f"Not enough budget/cash for one share at {_rupees(price)}.")

    trade = buy(account, ticker, qty, price, now, owner="BOT", target=float(target),
                stop=float(stop), reason="BOT_SIGNAL", company_name=company_name)
    message = (f"Bought {qty} at {_rupees(price)} (target {_rupees(target)}, "
               f"stop {_rupees(stop)}).")
    return {"action": "BUY", "message": message, "trade": trade,
            "log": bot_log(account, now, ticker, "BUY", message)}


def update_bot_settings(account: Account, changes: Dict[str, Any]) -> Dict[str, Any]:
    """Validates and applies bot settings. `changes` holds only the fields being set."""
    bot = account["bot"]
    updated = dict(bot)
    if "enabled" in changes:
        updated["enabled"] = bool(changes["enabled"])
    if "tickers" in changes:
        tickers = []
        for t in changes["tickers"]:
            if t and t not in tickers:
                tickers.append(t)
        if len(tickers) > MAX_BOT_TICKERS:
            raise PaperTradingError(f"The bot can watch at most {MAX_BOT_TICKERS} stocks.")
        updated["tickers"] = tickers
    if "budget_per_trade" in changes:
        budget = float(changes["budget_per_trade"])
        if not (0 < budget <= account["starting_cash"]):
            raise PaperTradingError(
                f"Budget per trade must be between ₹1 and {_rupees(account['starting_cash'])}.")
        updated["budget_per_trade"] = _money(budget)
    if "max_positions" in changes:
        mp = changes["max_positions"]
        if isinstance(mp, bool) or int(mp) != mp or not (1 <= int(mp) <= MAX_BOT_TICKERS):
            raise PaperTradingError(f"Max positions must be a whole number from 1 to {MAX_BOT_TICKERS}.")
        updated["max_positions"] = int(mp)
    bot.update(updated)
    return bot


def summary(account: Account, prices: Dict[str, float]) -> Dict[str, Any]:
    """Account totals at the given prices (positions without a price are valued at cost)."""
    market_value = 0.0
    cost_basis = 0.0
    unrealized = {"YOU": 0.0, "BOT": 0.0}
    for p in account["positions"]:
        price = prices.get(p["ticker"])
        if price is None or not math.isfinite(price) or price <= 0:
            price = p["avg_cost"]
        market_value += p["quantity"] * price
        cost_basis += p["quantity"] * p["avg_cost"]
        unrealized[p["owner"]] += p["quantity"] * (price - p["avg_cost"])
    market_value = _money(market_value)
    equity = _money(account["cash"] + market_value)
    return {
        "starting_cash": account["starting_cash"],
        "cash": account["cash"],
        "invested": _money(cost_basis),
        "market_value": market_value,
        "equity": equity,
        "total_pnl": _money(equity - account["starting_cash"]),
        "realized_pnl": {k: _money(v) for k, v in account["realized"].items()},
        "unrealized_pnl": {k: _money(v) for k, v in unrealized.items()},
        "wins": dict(account["wins"]),
        "losses": dict(account["losses"]),
    }
