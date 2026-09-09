"""
Optional PostgreSQL-backed persistence for user accounts/invites.

api/user_store.py checks is_configured() and routes through here instead of
the flat storage/users.json file when settings.DATABASE_URL is set. That
JSON file lives on local container disk, which most PaaS free tiers
(confirmed live on Render: an invite created before a redeploy was gone
right after it) wipe on every deploy - a real Postgres instance survives
that. Purely additive: with DATABASE_URL unset, nothing in this module is
ever touched and user_store.py's existing JSON-file behavior is unchanged.
"""
import logging
from contextlib import contextmanager
from typing import Iterator

from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

_pool = None


def is_configured() -> bool:
    return bool(settings.DATABASE_URL)


def _get_pool():
    global _pool
    if _pool is None:
        import psycopg2.pool
        _pool = psycopg2.pool.SimpleConnectionPool(1, 5, settings.DATABASE_URL)
        _init_schema()
    return _pool


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
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def _init_schema() -> None:
    pool = _pool
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
        conn.commit()
        logger.info("Postgres schema ensured (users, invites)")
    finally:
        pool.putconn(conn)
