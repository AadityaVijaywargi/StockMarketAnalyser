from fastapi import APIRouter
import sys
import os
from datetime import datetime
import urllib.error
import urllib.request
import pytz
from config.settings import settings

router = APIRouter(tags=["System health"])

@router.get("/")
async def root():
    """Returns basic system registration details."""
    return {
        "service": "AI Equity Research Platform",
        "status": "running",
        "version": "1.0.0"
    }


YAHOO_PROBE_URL = "https://query1.finance.yahoo.com"


def _provider_reachable() -> bool:
    """True if Yahoo's API host answers at all. Any HTTP status counts: the
    bare host returns 404/429 to unauthenticated probes, which proves it is
    reachable. Only network-level failures (DNS, refused, timeout) are down."""
    try:
        urllib.request.urlopen(YAHOO_PROBE_URL, timeout=3)
        return True
    except urllib.error.HTTPError:
        return True
    except Exception:
        return False


@router.get("/health")
def health():
    """
    Exposes platform health stats. Checks cache storage folders,
    python runtimes, and yfinance connectivity.

    Sync `def` on purpose: the probe is blocking I/O, so FastAPI runs it in
    the threadpool instead of stalling the event loop for up to 3s.
    """
    provider_ok = _provider_reachable()

    # Check cache directory write permissions
    cache_ok = os.path.exists(settings.CACHE_DIR) and os.access(settings.CACHE_DIR, os.W_OK)
    
    status = "healthy" if (provider_ok and cache_ok) else "degraded"
    
    return {
        "status": status,
        "python_version": sys.version.split(" ")[0],
        "timestamp": datetime.now(pytz.timezone(settings.MARKET_TIMEZONE)).isoformat(),
        "data_provider": {
            "name": settings.DATA_PROVIDER,
            "connected": provider_ok
        },
        "cache": {
            "path": settings.CACHE_DIR,
            "writable": cache_ok
        }
    }
