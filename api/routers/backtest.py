from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from typing import Optional

from analysis.downloader import YahooDownloader
from analysis.cache import FileCacheManager
from analysis.indicators import calculate_all_indicators
from analysis.normalizer import TickerNormalizer
from config.settings import settings
from api.deps import get_downloader, get_cache
from api.exceptions import InsufficientDataError, TickerNotFoundError
from backtesting.strategy import TrendMomentumStrategy
from backtesting.engine import BacktestEngine

router = APIRouter(prefix="/backtest", tags=["Backtesting"])

# Approximate trading-day counts per requested period, used to decide whether
# cached data actually satisfies the request (see run_backtest below).
_PERIOD_MIN_BARS = {"1y": 240, "2y": 480, "5y": 1200, "max": 250}


class BacktestRequest(BaseModel):
    ticker: str
    period: str = Field(default="5y", description="Historical lookback: 1y, 2y, 5y, or max")
    initial_capital: float = Field(default=100000.0, gt=0)


@router.post("/run")
async def run_backtest(
    request: BacktestRequest,
    downloader: YahooDownloader = Depends(get_downloader),
    cache: FileCacheManager = Depends(get_cache),
):
    """
    Runs a long-only Trend + Momentum (SMA50/200, RSI14) strategy simulation
    over historical daily data, with an ATR-based stop loss and target.
    """
    processed_ticker = TickerNormalizer.normalize(request.ticker)
    period = request.period if request.period in ("1y", "2y", "5y", "max") else "5y"

    # The cache key is just (ticker, interval) - it has no notion of period.
    # A flat "at least 250 bars" check would happily reuse data cached from
    # an unrelated ~1y fetch elsewhere in the app for a "5y" backtest
    # request, silently running the simulation on a fraction of the history
    # the user actually selected. Require enough bars for the period asked.
    min_bars_required = _PERIOD_MIN_BARS.get(period, 250)
    stock_df = cache.get(processed_ticker, interval="1d")
    if stock_df is None or len(stock_df) < min_bars_required:
        stock_df = downloader.download_ticker_data(processed_ticker, interval="1d", period=period)
        if stock_df is not None:
            cache.set(processed_ticker, stock_df, interval="1d")

    if stock_df is None or stock_df.empty:
        raise TickerNotFoundError(processed_ticker)
    if len(stock_df) < 250:
        raise InsufficientDataError(processed_ticker, len(stock_df))

    raw_cols = ["Open", "High", "Low", "Close", "Volume"]
    indicator_df = calculate_all_indicators(stock_df[raw_cols], settings.INDICATOR_PERIODS)
    features_df = stock_df[raw_cols].join(indicator_df)

    # Indicators need a warmup window (SMA_200 needs 200 bars); trim the
    # unusable leading rows rather than simulating on incomplete signals.
    features_df = features_df[features_df["SMA_200"].notna() & features_df["RSI_14"].notna() & features_df["ATR_14"].notna()]
    if len(features_df) < 30:
        raise InsufficientDataError(processed_ticker, len(features_df))

    strategy = TrendMomentumStrategy()
    engine = BacktestEngine(data=features_df, strategy=strategy, initial_capital=request.initial_capital)
    result = engine.run()

    return {
        "ticker": processed_ticker,
        "period": period,
        "bars_simulated": len(features_df),
        **result,
    }
