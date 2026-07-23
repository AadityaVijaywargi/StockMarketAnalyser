import logging
import pandas as pd
from analysis.downloader import YahooDownloader
from analysis.cache import FileCacheManager
from config.settings import settings
from config.constants import DEFAULT_BENCHMARK_INDEX, BANK_NIFTY_INDEX, INDIA_VIX_INDEX

logger = logging.getLogger("AIEquityResearchPlatform")

class MarketDownloader:
    """
    Downloader for index/macro parameters.
    Saves downloaded data to storage/market/ cache.
    """
    def __init__(self):
        self.downloader = YahooDownloader()
        # Direct cache to storage/market/ instead of default raw stock storage/cache/
        self.cache = FileCacheManager(cache_dir=settings.MARKET_DIR)

    def get_index_data(self, symbol: str, years: int = settings.DEFAULT_YEARS_DATA) -> pd.DataFrame:
        """
        Retrieves index data from cache or downloads it from yfinance.
        """
        cached_df = self.cache.get(symbol)
        if cached_df is not None:
            return cached_df

        logger.info(f"Market index cache miss for {symbol}. Downloading...", extra={"ticker": symbol})
        df = self.downloader.download_index_data(symbol, years=years)
        self.cache.set(symbol, df)
        return df

    def download_all_market_indices(self, years: int = settings.DEFAULT_YEARS_DATA) -> dict:
        """
        Retrieves all key market indexes: Nifty 50, Bank Nifty, and India VIX.
        """
        results = {}
        for name, symbol in [
            ("nifty_50", DEFAULT_BENCHMARK_INDEX),
            ("bank_nifty", BANK_NIFTY_INDEX),
            ("india_vix", INDIA_VIX_INDEX)
        ]:
            try:
                results[name] = self.get_index_data(symbol, years=years)
            except Exception as e:
                logger.error(f"Failed to retrieve index {name} ({symbol}): {e}", extra={"ticker": symbol})
        return results
