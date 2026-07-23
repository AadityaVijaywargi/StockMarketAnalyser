from typing import Dict, List

# Indian Market Settings
MARKET_TIMEZONE = "Asia/Kolkata"
MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 15
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 30

# Default Indices & Tickers
DEFAULT_BENCHMARK_INDEX = "^NSEI"  # NIFTY 50
BANK_NIFTY_INDEX = "^NSEBANK"      # BANK NIFTY
INDIA_VIX_INDEX = "^INDIAVIX"      # India VIX

# Sector Index Map for Key NSE Stocks
SECTOR_MAP: Dict[str, str] = {
    # Ticker -> Sector Index yfinance symbol
    "RELIANCE.NS": "^CNXENERGY",   # Nifty Energy
    "TCS.NS": "^CNXIT",          # Nifty IT
    "INFY.NS": "^CNXIT",         # Nifty IT
    "HDFCBANK.NS": "^NSEBANK",   # Nifty Bank
    "SBIN.NS": "^NSEBANK",       # Nifty Bank
    "ICICIBANK.NS": "^NSEBANK",  # Nifty Bank
    "LT.NS": "^CNXINFRA",        # Nifty Infrastructure
    "BHARTIARTL.NS": "^CNXREALTY",  # Telecommunication/Realty
    "ITC.NS": "^CNXFMCG",        # Nifty FMCG
    "HINDUNILVR.NS": "^CNXFMCG",  # Nifty FMCG
}

# Sector names mapping for display/reporting
SECTOR_NAMES: Dict[str, str] = {
    "^CNXENERGY": "Energy",
    "^CNXIT": "Information Technology",
    "^NSEBANK": "Banking & Financials",
    "^CNXINFRA": "Infrastructure",
    "^CNXFMCG": "FMCG",
    "UNKNOWN": "General Market",
}

# Standard timeframes supported by the platform
TIMEFRAME_1M = "1M"
TIMEFRAME_3M = "3M"
TIMEFRAME_6M = "6M"
TIMEFRAME_1Y = "1Y"
TIMEFRAME_LONG = "LONG"

SUPPORTED_TIMEFRAMES = [TIMEFRAME_1M, TIMEFRAME_3M, TIMEFRAME_6M, TIMEFRAME_1Y, TIMEFRAME_LONG]
