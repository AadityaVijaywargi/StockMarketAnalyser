import re
import logging
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, TimeoutError

logger = logging.getLogger("AIEquityResearchPlatform")

# Generic clean-up maps for common acronyms and prefixes
COMMON_SYMBOL_MAP = {
    "RELIANCE": "Reliance Industries",
    "TCS": "Tata Consultancy Services",
    "INFY": "Infosys",
    "HDFCBANK": "HDFC Bank",
    "ICICIBANK": "ICICI Bank",
    "SBIN": "State Bank of India",
    "TATAMOTORS": "Tata Motors",
    "TATASTEEL": "Tata Steel",
    "BHARTIARTL": "Bharti Airtel",
    "SUNPHARMA": "Sun Pharma",
    "MARUTI": "Maruti Suzuki",
    "ASIANPAINT": "Asian Paints",
    "BAJFINANCE": "Bajaj Finance",
    "HINDUNILVR": "Hindustan Unilever",
    "LT": "Larsen & Toubro",
    "TITAN": "Titan Company",
    "ITC": "ITC Limited",
}


class CompanyResolver:
    """
    Generic Company Resolver for any NSE-listed stock.
    Priority:
    1. Pre-configured clean map (fast lookup for common top tickers)
    2. Dynamic yfinance info/fast_info metadata lookup with quick timeout
    3. Symbol string formatting (stripping .NS/.BO and expanding camelcase)
    4. Generic query generation
    """
    @staticmethod
    def resolve_company_name(ticker: str, timeout_seconds: float = 1.0) -> str:
        clean_symbol = ticker.replace(".NS", "").replace(".BO", "").upper().strip()

        # 1. Quick lookup map
        if clean_symbol in COMMON_SYMBOL_MAP:
            return COMMON_SYMBOL_MAP[clean_symbol]

        # 2. Dynamic yfinance metadata resolution
        def _fetch_yf_name() -> Optional[str]:
            try:
                import yfinance as yf
                stock = yf.Ticker(ticker)
                # Check fast_info first
                info = getattr(stock, "fast_info", None)
                if info:
                    name = getattr(info, "company_name", None) or getattr(info, "long_name", None)
                    if name and isinstance(name, str):
                        return name
                # Fall back to info dict
                info_dict = getattr(stock, "info", {}) or {}
                name = info_dict.get("longName") or info_dict.get("shortName")
                if name and isinstance(name, str):
                    return name
            except Exception:
                pass
            return None

        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_fetch_yf_name)
                resolved_name = future.result(timeout=timeout_seconds)
                if resolved_name:
                    # Clean up common corporate suffixes for better search queries
                    cleaned = re.sub(r"\b(Limited|Ltd|Inc|Corp|Corporation)\b\.?", "", resolved_name, flags=re.IGNORECASE).strip()
                    return cleaned or resolved_name
        except (TimeoutError, Exception) as e:
            logger.debug(f"Dynamic company resolution skipped/timed out for {ticker}: {e}")

        # 3. Fallback string formatting
        # Expand camelcase or spaced symbols (e.g., ICICIBANK -> ICICI Bank)
        formatted = re.sub(r"([a-z])([A-Z])", r"\1 \2", clean_symbol)
        formatted = formatted.replace("BANK", " Bank").replace("MOTORS", " Motors").replace("PHARMA", " Pharma").strip()
        return formatted or clean_symbol

    @staticmethod
    def generate_search_queries(ticker: str, company_name: str = "", sector: str = "") -> List[str]:
        clean_symbol = ticker.replace(".NS", "").replace(".BO", "").strip()
        c_name = company_name or CompanyResolver.resolve_company_name(ticker)

        queries = [
            f'"{c_name}"',
            f'"{c_name}" NSE',
            f'"{clean_symbol}" stock news',
            f'"{c_name}" earnings profit',
        ]

        if sector and sector.lower() != "general market":
            queries.append(f'"{sector}" sector news India')

        # Remove duplicate query strings while preserving order
        seen = set()
        unique_queries = []
        for q in queries:
            if q not in seen:
                seen.add(q)
                unique_queries.append(q)

        return unique_queries
