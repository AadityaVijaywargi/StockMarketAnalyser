from abc import ABC, abstractmethod
from typing import List, Dict, Any
import pandas as pd

class BaseDownloader(ABC):
    """
    Abstract interface for downloading historical market data.
    """
    @abstractmethod
    def download_ticker_data(
        self, 
        ticker: str, 
        years: int = 5
    ) -> pd.DataFrame:
        """
        Downloads daily historical OHLCV data for a given ticker symbol.
        Returns a cleaned Pandas DataFrame indexed by Date (UTC/Localized).
        """
        pass

    @abstractmethod
    def download_index_data(
        self, 
        index_symbol: str, 
        years: int = 5
    ) -> pd.DataFrame:
        """
        Downloads historical data for index/macro symbols (e.g. NIFTY 50, INDIA VIX).
        """
        pass


class BaseScorer(ABC):
    """
    Abstract interface for stock scoring engines.
    """
    @abstractmethod
    def calculate_scores(
        self, 
        features_df: pd.DataFrame, 
        market_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Evaluates a stock based on computed features and market context.
        Returns a dictionary of scores (Trend, Momentum, Volume, etc.) and overall rating.
        """
        pass
