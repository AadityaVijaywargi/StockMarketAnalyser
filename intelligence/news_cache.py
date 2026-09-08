import os
import json
import time
import logging
from typing import Dict, Any, List, Optional
from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")


class NewsCacheManager:
    """
    Disk cache manager for market intelligence data stored in storage/news/ directory.
    Maintains current-day cache and rolling 30-day article history per ticker.
    """
    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = cache_dir or settings.NEWS_DIR
        os.makedirs(self.cache_dir, exist_ok=True)

    def _get_file_path(self, ticker: str, date_str: str = "") -> str:
        if not date_str:
            date_str = time.strftime("%Y-%m-%d", time.gmtime())
        clean_ticker = ticker.replace(".NS", "_NS").replace(".BO", "_BO")
        filename = f"{clean_ticker}_{date_str}.json"
        return os.path.join(self.cache_dir, filename)

    def _get_history_file_path(self, ticker: str) -> str:
        clean_ticker = ticker.replace(".NS", "_NS").replace(".BO", "_BO")
        return os.path.join(self.cache_dir, f"{clean_ticker}_history.json")

    def get(self, ticker: str, date_str: str = "") -> Optional[Dict[str, Any]]:
        file_path = self._get_file_path(ticker, date_str)
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    logger.info(f"News cache HIT for {ticker} ({date_str})", extra={"ticker": ticker})
                    return data
            except Exception as e:
                logger.warning(f"Failed to read news cache file {file_path}: {e}")
        return None

    def set(self, ticker: str, data: Dict[str, Any], date_str: str = ""):
        file_path = self._get_file_path(ticker, date_str)
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
                logger.info(f"Saved news cache for {ticker} -> {file_path}")
            
            # Update rolling 30-day history log
            self._update_rolling_history(ticker, data)
        except Exception as e:
            logger.warning(f"Failed to write news cache file {file_path}: {e}")

    def _update_rolling_history(self, ticker: str, new_pack_dict: Dict[str, Any], max_history_days: int = 30):
        history_path = self._get_history_file_path(ticker)
        history_entries: List[Dict[str, Any]] = []

        if os.path.exists(history_path):
            try:
                with open(history_path, "r", encoding="utf-8") as f:
                    history_entries = json.load(f)
            except Exception:
                history_entries = []

        today_date = time.strftime("%Y-%m-%d", time.gmtime())
        # Filter out existing entry for today if present
        history_entries = [h for h in history_entries if h.get("date") != today_date]
        
        history_entries.append({
            "date": today_date,
            "fetched_at": new_pack_dict.get("fetched_at"),
            "company_news_count": len(new_pack_dict.get("company_news", [])),
            "primary_sentiment": new_pack_dict.get("overall_sentiment", {}).get("primary_sentiment"),
            "pack": new_pack_dict
        })

        # Keep rolling window of last 30 days
        history_entries = history_entries[-max_history_days:]

        try:
            with open(history_path, "w", encoding="utf-8") as f:
                json.dump(history_entries, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to update rolling 30-day history for {ticker}: {e}")

    def get_rolling_history(self, ticker: str) -> List[Dict[str, Any]]:
        history_path = self._get_history_file_path(ticker)
        if os.path.exists(history_path):
            try:
                with open(history_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read rolling history for {ticker}: {e}")
        return []
