import logging
from datetime import datetime, timedelta
import pandas as pd
import yfinance as yf
from analysis.interfaces import BaseDownloader
from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

class YahooDownloader(BaseDownloader):
    """
    Data downloader implementation utilizing the Yahoo Finance API.
    Handles data download, cleaning, corporate actions adjustments, and validation.
    """
    def __init__(self):
        super().__init__()

    def _clean_and_validate(self, df: pd.DataFrame, ticker: str) -> pd.DataFrame:
        """
        Cleans and validates downloaded data.
        - Handles missing values (forward fill then backward fill)
        - Removes duplicate rows in index
        - Timezone normalization (convert to UTC, reset timezone information)
        - Validates relationship rules: High >= Low, High >= Open/Close, Low <= Open/Close.
        """
        if df.empty:
            logger.warning(f"Downloaded empty DataFrame for {ticker}", extra={"ticker": ticker})
            return df

        # Copy to avoid modifications to slices
        df = df.copy()

        # Ensure index is timezone-naive date strings or datetime
        if isinstance(df.index, pd.DatetimeIndex):
            # Normalize to UTC first then remove tz info
            if df.index.tz is not None:
                df.index = df.index.tz_convert('UTC').tz_localize(None)
            else:
                df.index = df.index.tz_localize(None)

        # Drop duplicate index entries
        df = df[~df.index.duplicated(keep='last')]

        # Fill missing values
        df.ffill(inplace=True)
        df.bfill(inplace=True)

        # Ensure standard OHLCV columns exist
        required_cols = ["Open", "High", "Low", "Close", "Adj Close", "Volume"]
        for col in required_cols:
            if col not in df.columns:
                if col == "Adj Close" and "Close" in df.columns:
                    df["Adj Close"] = df["Close"]
                else:
                    raise ValueError(f"Required column {col} missing from downloaded data for {ticker}")

        # Drop rows where critical columns are NaN
        df.dropna(subset=["Open", "High", "Low", "Close", "Volume"], inplace=True)

        # Validate price relationships
        # 1. Prices must be positive
        for col in ["Open", "High", "Low", "Close", "Adj Close"]:
            df = df[df[col] > 0]

        # 2. Volume must be non-negative
        df = df[df["Volume"] >= 0]

        # 3. High must be the absolute highest of the day, Low must be the absolute lowest
        df["High"] = df[["Open", "High", "Low", "Close"]].max(axis=1)
        df["Low"] = df[["Open", "High", "Low", "Close"]].min(axis=1)

        # Log completion
        logger.info(
            f"Successfully cleaned and validated data for {ticker}. Rows: {len(df)}", 
            extra={"ticker": ticker}
        )
        return df

    def download_ticker_data(
        self, 
        ticker: str, 
        years: int = None,
        interval: str = "1d",
        period: str = None
    ) -> pd.DataFrame:
        """
        Downloads stock data for the given ticker symbol with customizable interval and period.
        """
        if period is None:
            if years is not None:
                period = f"{years}y"
            else:
                # Timeframe-aware lookup
                if interval == "1m":
                    period = "7d"
                elif interval in ["5m", "15m", "30m"]:
                    period = "60d"
                elif interval in ["60m", "1h"]:
                    period = "730d"
                else:
                    period = "5y"
        
        logger.info(
            f"Downloading ticker data from yfinance: {ticker} (Interval: {interval}, Period: {period})", 
            extra={"ticker": ticker}
        )
        
        try:
            # Download with auto_adjust=False to retrieve both raw Close and Adj Close
            df = yf.download(
                ticker, 
                period=period,
                interval=interval,
                auto_adjust=False,
                progress=False
            )
            
            # Flatten columns if multi-indexed (happens in some yfinance versions)
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
                
            df = self._clean_and_validate(df, ticker)
            return df
        except Exception as e:
            logger.error(
                f"Failed to download ticker data for {ticker}: {str(e)}", 
                extra={"ticker": ticker}
            )
            raise

    def download_index_data(self, index_symbol: str, years: int = settings.DEFAULT_YEARS_DATA) -> pd.DataFrame:
        """
        Downloads historical data for index/macro symbols (e.g. NIFTY 50, INDIA VIX).
        """
        # Indices don't have corporate actions splits, but we use the same downloader logic
        return self.download_ticker_data(index_symbol, years=years)
