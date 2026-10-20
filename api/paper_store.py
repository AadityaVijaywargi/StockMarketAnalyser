"""
Persistence for paper trading accounts (rules live in analysis/paper_trading.py).

Each user's whole account - cash, positions, history, bot settings - is one
JSON document in user_data_store under PAPER_KEY, so it rides on whichever
backend that store uses (Postgres when DATABASE_URL is set, JSON files
otherwise). Every change is load -> modify -> save under that user's lock, so
cash, positions and history always move together: a rule that raises leaves
the stored account untouched. The locks are in-process, which is enough for
the single uvicorn worker this app runs as.

A small registry (a reserved user_data row) lists which users have an
account, so the background bot doesn't need to enumerate every user.
"""
import threading
from datetime import datetime
from typing import Callable, Dict, List, TypeVar

import pytz

from analysis import paper_trading as pt
from api import user_data_store
from config.settings import settings

PAPER_KEY = "paper_account"
_REGISTRY_USER = "_paper_registry"
_REGISTRY_KEY = "accounts"

_locks: Dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()
_registry_lock = threading.Lock()

T = TypeVar("T")


def market_now() -> datetime:
    return datetime.now(pytz.timezone(settings.MARKET_TIMEZONE))


def _lock_for(username: str) -> threading.Lock:
    with _locks_guard:
        lock = _locks.get(username)
        if lock is None:
            lock = _locks[username] = threading.Lock()
        return lock


def _register(username: str) -> None:
    with _registry_lock:
        names = user_data_store.get_value(_REGISTRY_USER, _REGISTRY_KEY) or []
        if username not in names:
            user_data_store.set_value(_REGISTRY_USER, _REGISTRY_KEY, names + [username])


def list_accounts() -> List[str]:
    return list(user_data_store.get_value(_REGISTRY_USER, _REGISTRY_KEY) or [])


def load(username: str) -> pt.Account:
    """The user's account, or a fresh (unsaved) one if they've never traded."""
    stored = user_data_store.get_value(username, PAPER_KEY)
    return stored if isinstance(stored, dict) else pt.new_account(market_now())


def mutate(username: str, fn: Callable[[pt.Account], T]) -> T:
    """Atomically applies fn to the user's account and saves it. If fn raises, nothing is saved."""
    with _lock_for(username):
        account = load(username)
        result = fn(account)
        user_data_store.set_value(username, PAPER_KEY, account)
    _register(username)
    return result


def replace(username: str, fn: Callable[[pt.Account], pt.Account]) -> pt.Account:
    """Like mutate, but fn returns a whole new account (used by reset)."""
    with _lock_for(username):
        account = fn(load(username))
        user_data_store.set_value(username, PAPER_KEY, account)
    _register(username)
    return account
