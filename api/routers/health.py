from fastapi import APIRouter
import sys
import os
from datetime import datetime
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


@router.get("/health")
async def health():
    """
    Exposes platform health stats. Checks cache storage folders,
    python runtimes, and yfinance connectivity.
    """
    # Check yfinance provider connectivity (ping Yahoo homepage)
    provider_ok = False
    try:
        urllib.request.urlopen("https://query1.finance.yahoo.com", timeout=3)
        provider_ok = True
    except Exception:
        provider_ok = False

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
