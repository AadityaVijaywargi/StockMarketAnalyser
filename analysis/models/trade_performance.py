from typing import List, Optional
from pydantic import BaseModel, Field

class TrackedTradeModel(BaseModel):
    """
    Represents an actively monitored or completed trade.
    """
    id: str = Field(..., description="Unique trade execution ID")
    ticker: str = Field(..., description="Ticker symbol")
    company_name: str = Field(..., description="Company name")
    entry_price: float = Field(..., description="Trade entry price")
    current_price: float = Field(..., description="Current live asset price")
    entry_time: str = Field(..., description="Trade start timestamp (ISO format)")
    timeframe: str = Field(..., description="Target timeframe (1D, 1W, 1M, 3M, 6M, 1Y)")
    target_price: float = Field(..., description="Target profit price")
    initial_stop_loss: float = Field(..., description="Initial stop loss price")
    trailing_stop_loss: float = Field(..., description="Current dynamic trailing stop loss price")
    initial_confidence: float = Field(..., description="Signal confidence score at entry")
    initial_signal: str = Field(..., description="Signal at entry (BUY NOW, etc.)")
    status: str = Field(..., description="ACTIVE, TARGET_NEAR, TARGET_HIT, EXIT_SUGGESTED, STOP_LOSS_HIT, CLOSED")
    profit_pct: float = Field(..., description="Current profit percentage (%)")
    profit_amount: float = Field(..., description="Current profit absolute amount in currency")
    highest_profit_pct: float = Field(..., description="Highest profit percentage achieved during trade")
    max_drawdown_pct: float = Field(..., description="Maximum drawdown percentage experienced")
    target_progress_pct: float = Field(..., description="Progress percentage towards target (0-100%)")
    holding_time_mins: int = Field(..., description="Holding duration in minutes")
    exit_recommendation: str = Field(..., description="HOLD, EXIT NOW, TAKE PROFIT, STOP LOSS HIT")
    exit_price: Optional[float] = Field(default=None, description="Price at trade exit")
    exit_time: Optional[str] = Field(default=None, description="Trade close timestamp")
    exit_reason: Optional[str] = Field(default=None, description="Reason for trade exit")
    exit_signal: Optional[str] = Field(default=None, description="Signal at trade exit")


class TradePerformanceSummaryModel(BaseModel):
    """
    Aggregated performance dashboard analytics.
    """
    total_trades: int = Field(..., description="Total trades count")
    winning_trades: int = Field(..., description="Number of profitable trades")
    losing_trades: int = Field(..., description="Number of losing trades")
    win_rate_pct: float = Field(..., description="Win rate percentage (%)")
    average_gain_pct: float = Field(..., description="Average winning trade gain %")
    average_loss_pct: float = Field(..., description="Average losing trade loss %")
    largest_win_pct: float = Field(..., description="Largest winning trade gain %")
    largest_loss_pct: float = Field(..., description="Largest losing trade loss %")
    average_holding_time: str = Field(..., description="Average holding time string")
