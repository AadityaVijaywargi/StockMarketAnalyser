import os
import logging
import time as py_time
from datetime import datetime, time, timedelta
from typing import Optional
import pandas as pd
import pytz
from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

class FileCacheManager:
    """
    Manages lightweight file-based caching for raw stock and index historical data.
    Implements intelligent cache invalidation based on market hours.
    """
    def __init__(self, cache_dir: str = settings.CACHE_DIR, tz_name: str = settings.MARKET_TIMEZONE):
        self.cache_dir = cache_dir
        self.timezone = pytz.timezone(tz_name)
        os.makedirs(self.cache_dir, exist_ok=True)

    def get_cache_path(self, ticker: str, interval: str = "1d") -> str:
        """Get absolute path to the cached CSV file for a given ticker and interval."""
        # Clean ticker name for filesystem safety (e.g. remove ^ or .NS)
        safe_name = ticker.replace("^", "INDEX_").replace(".", "_")
        if interval != "1d":
            safe_name = f"{safe_name}_{interval}"
        return os.path.join(self.cache_dir, f"{safe_name}.csv")

    def is_cache_valid(self, ticker: str, interval: str = "1d") -> bool:
        """
        Determines if the cache is valid for the current trading day.
        Rules:
        - If cache file does not exist -> Invalid (Miss)
        - If today is weekend -> Cache is valid if it contains Friday's data.
        - If today is weekday and before market close (3:45 PM IST) -> Valid if it contains yesterday's data.
        - If today is weekday and after market close -> Valid if it contains today's data.
        - For intraday timeframes (1m, 5m, 15m, 1h), check if the file modification time is within the interval TTL.
        """
        cache_path = self.get_cache_path(ticker, interval)
        if not os.path.exists(cache_path):
            return False

        if interval != "1d":
            import time as py_time
            mtime = os.path.getmtime(cache_path)
            now_ts = py_time.time()
            if interval == "1m":
                ttl = 60
            elif interval == "5m":
                ttl = 300
            elif interval == "15m":
                ttl = 900
            elif interval in ["60m", "1h"]:
                ttl = 3600
            else:
                ttl = 86400
            return (now_ts - mtime) < ttl

        try:
            # Read the last line of the CSV to inspect the most recent date
            with open(cache_path, 'rb') as f:
                try:
                    # Seek to the end of the file minus 2 bytes
                    f.seek(-2, os.SEEK_END)
                    # Keep seeking backward until we find a newline character
                    while f.read(1) != b'\n':
                        f.seek(-2, os.SEEK_CUR)
                except OSError:
                    # File is very small, seek to start
                    f.seek(0)
                last_line = f.readline().decode('utf-8').strip()
            
            if not last_line:
                return False
                
            parts = last_line.split(",")
            last_date_str = parts[0].strip()
            if last_date_str == "Date":
                return False
            last_date = datetime.strptime(last_date_str, "%Y-%m-%d").date()
        except Exception as e:
            logger.warning(f"Error reading cache end date for {ticker}: {e}", extra={"ticker": ticker})
            return False

        # Get current time in market timezone
        now = datetime.now(self.timezone)
        today = now.date()

        # Check if today is a weekend
        # Monday=0, Sunday=6
        if now.weekday() >= 5:
            # Weekend: cache is valid if it has data up to the last Friday
            days_to_subtract = 1 if now.weekday() == 5 else 2  # Saturday=1, Sunday=2
            last_friday = today - timedelta(days=days_to_subtract)
            return last_date >= last_friday

        # Weekday: check market hours
        # Market closes at 3:30 PM (15:30) IST, allow 15 mins for data processing on yfinance (3:45 PM / 15:45)
        cutoff_time = time(15, 45)
        if now.time() < cutoff_time:
            # Today's market is still open or yfinance hasn't updated.
            # Cache is valid if it contains yesterday's data (or Friday's data if today is Monday).
            days_to_subtract = 3 if now.weekday() == 0 else 1
            required_date = today - timedelta(days=days_to_subtract)
            return last_date >= required_date
        else:
            # Today's market is closed and data is final.
            # Cache is valid only if it contains today's data.
            return last_date >= today

    def get(self, ticker: str, interval: str = "1d") -> Optional[pd.DataFrame]:
        """Loads cached DataFrame for ticker if valid, else returns None."""
        if not self.is_cache_valid(ticker, interval):
            return None

        cache_path = self.get_cache_path(ticker, interval)
        try:
            df = pd.read_csv(cache_path)
            # Ensure 'Date' is set as index and formatted as datetime
            df['Date'] = pd.to_datetime(df['Date'])
            df.set_index('Date', inplace=True)
            logger.info(f"Cache HIT for ticker {ticker} ({interval})", extra={"ticker": ticker})
            return df
        except Exception as e:
            logger.error(f"Failed to read valid cache for {ticker}: {e}", extra={"ticker": ticker})
            return None

    def set(self, ticker: str, df: pd.DataFrame, interval: str = "1d") -> bool:
        """Saves stock DataFrame to the cache folder."""
        if df.empty:
            logger.warning(f"Attempted to cache empty DataFrame for {ticker}", extra={"ticker": ticker})
            return False

        cache_path = self.get_cache_path(ticker, interval)
        try:
            # Make sure Date index is formatted as YYYY-MM-DD
            df_to_save = df.copy()
            if not isinstance(df_to_save.index, pd.DatetimeIndex):
                df_to_save.index = pd.to_datetime(df_to_save.index)
            
            # Reset index to write Date as column in CSV
            df_to_save.index.name = "Date"
            df_to_save.reset_index(inplace=True)
            # For intraday data, write full timestamp format. For daily, write date format.
            if interval == "1d":
                df_to_save['Date'] = df_to_save['Date'].dt.strftime('%Y-%m-%d')
            else:
                df_to_save['Date'] = df_to_save['Date'].dt.strftime('%Y-%m-%d %H:%M:%S')
            df_to_save.to_csv(cache_path, index=False)
            logger.info(f"Cached data saved for ticker {ticker} ({interval})", extra={"ticker": ticker})
            return True
        except Exception as e:
            logger.error(f"Failed to write cache for {ticker}: {e}", extra={"ticker": ticker})
            return False


class InMemoryLiveCache:
    """
    In-memory caching layer for Live Quotes and Technical Analysis Reports.
    Implements timeframe-aware cache invalidation and market timezone clock rules.
    """
    def __init__(self, tz_name: str = settings.MARKET_TIMEZONE):
        self.timezone = pytz.timezone(tz_name)
        # dict mapping: ticker -> {"timestamp": float, "quote": dict}
        self.quote_cache = {}
        # dict mapping: (ticker, interval) -> {"last_index_time": datetime, "report": dict}
        self.analysis_cache = {}

    def is_market_open(self, now: datetime) -> bool:
        if now.weekday() >= 5:
            return False
        from datetime import time as dt_time
        return dt_time(9, 15) <= now.time() <= dt_time(15, 30)

    def get_quote(self, ticker: str) -> Optional[dict]:
        cache_item = self.quote_cache.get(ticker)
        if not cache_item:
            return None
            
        now_ts = py_time.time()
        now_dt = datetime.now(self.timezone)
        
        # TTL: 10 seconds if open, 3600 seconds if closed
        ttl = 10.0 if self.is_market_open(now_dt) else 3600.0
        
        if now_ts - cache_item["timestamp"] < ttl:
            return cache_item["quote"]
        return None

    def set_quote(self, ticker: str, quote: dict):
        self.quote_cache[ticker] = {
            "timestamp": py_time.time(),
            "quote": quote
        }

    def get_last_completed_candle_time(self, interval: str, now: datetime) -> datetime:
        if interval == "1m":
            minutes = 1
        elif interval == "5m":
            minutes = 5
        elif interval == "15m":
            minutes = 15
        elif interval == "30m":
            minutes = 30
        elif interval in ["60m", "1h"]:
            minutes = 60
        elif interval == "1d":
            cutoff = now.replace(hour=15, minute=30, second=0, microsecond=0)
            if now < cutoff:
                return (now - timedelta(days=3 if now.weekday() == 0 else 1)).replace(hour=15, minute=30, second=0, microsecond=0)
            return cutoff
        else:
            minutes = 1440
            
        delta = now.minute % minutes
        return now.replace(second=0, microsecond=0) - timedelta(minutes=delta)

    def get_analysis(self, ticker: str, interval: str) -> Optional[dict]:
        key = (ticker, interval)
        cache_item = self.analysis_cache.get(key)
        if not cache_item:
            return None
            
        now_dt = datetime.now(self.timezone)
        
        # If market is closed, the last completed candle won't change
        if not self.is_market_open(now_dt):
            return cache_item["report"]
            
        # If market is open, check if a new candle has completed since
        last_completed = self.get_last_completed_candle_time(interval, now_dt)
        cached_index_time = cache_item["last_index_time"]
        
        if cached_index_time >= last_completed:
            return cache_item["report"]
            
        return None

    def set_analysis(self, ticker: str, interval: str, last_index_time: datetime, report: dict):
        key = (ticker, interval)
        self.analysis_cache[key] = {
            "last_index_time": last_index_time,
            "report": report
        }

