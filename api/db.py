"""
Optional PostgreSQL-backed persistence for user accounts/invites and
per-user synced data (watchlist, trades, alerts).

api/user_store.py and api/user_data_store.py check is_configured() and route
through here instead of their flat JSON files when settings.DATABASE_URL is
set. That
JSON file lives on local container disk, which most PaaS free tiers
(confirmed live on Render: an invite created before a redeploy was gone
right after it) wipe on every deploy - a real Postgres instance survives
that. Purely additive: with DATABASE_URL unset, nothing in this module is
ever touched and user_store.py's existing JSON-file behavior is unchanged.
"""
import logging
import threading
from contextlib import contextmanager
from typing import Iterator

from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

_pool = None
_pool_lock = threading.Lock()


def is_configured() -> bool:
    return bool(settings.DATABASE_URL)


def _get_pool():
    global _pool
    with _pool_lock:
        if _pool is None:
            import psycopg2.pool
            # Threaded pool: sync FastAPI endpoints run in a thread pool, and
            # SimpleConnectionPool is not safe to share across threads.
            pool = psycopg2.pool.ThreadedConnectionPool(1, 5, settings.DATABASE_URL)
            _init_schema(pool)
            _pool = pool
    return _pool


def reset_pool() -> None:
    """Closes and forgets the pool, so the next use reconnects to settings.DATABASE_URL."""
    global _pool
    with _pool_lock:
        if _pool is not None:
            _pool.closeall()
            _pool = None


@contextmanager
def get_cursor() -> Iterator["psycopg2.extensions.cursor"]:
    """Yields a dict-cursor within a committed (or rolled-back) transaction."""
    import psycopg2.extras
    pool = _get_pool()
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
        conn.commit()
    except Exception:
        if not conn.closed:
            conn.rollback()
        raise
    finally:
        # Don't hand a dead connection (e.g. dropped by the server while idle)
        # back to the pool for the next request to trip over.
        pool.putconn(conn, close=bool(conn.closed))


def _init_schema(pool) -> None:
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    email TEXT,
                    created_at TEXT NOT NULL,
                    invited_by TEXT
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS invites (
                    code TEXT PRIMARY KEY,
                    email TEXT,
                    created_by TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    used BOOLEAN NOT NULL DEFAULT FALSE,
                    used_by TEXT
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS access_requests (
                    id TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    message TEXT,
                    created_at TEXT NOT NULL,
                    source_ip TEXT,
                    status TEXT NOT NULL DEFAULT 'pending'
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_data (
                    username TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value JSONB,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    PRIMARY KEY (username, key)
                )
            """)
        conn.commit()
        logger.info("Postgres schema ensured (users, invites, access_requests, user_data)")
    finally:
        pool.putconn(conn)
