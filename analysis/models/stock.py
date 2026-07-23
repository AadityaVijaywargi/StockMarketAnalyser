from pydantic import BaseModel, Field
from typing import List

class OHLCVRow(BaseModel):
    """
    Represents a single daily OHLCV bar.
    """
    date: str = Field(..., description="Date of the bar (YYYY-MM-DD)")
    open: float
    high: float
    low: float
    close: float
    adj_close: float
    volume: int


class StockData(BaseModel):
    """
    Wrapper model containing details and daily historical price actions for a stock.
    """
    ticker: str
    company_name: str
    sector: str
    history: List[OHLCVRow]
