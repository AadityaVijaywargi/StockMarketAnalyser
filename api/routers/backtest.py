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
from backtesting.strategy import TrendMomentumStrategy, MeanReversionStrategy
from backtesting.engine import BacktestEngine, DEFAULT_COST_PCT, DEFAULT_SLIPPAGE_PCT
from backtesting.metrics import BacktestMetrics
import pandas as pd

router = APIRouter(prefix="/backtest", tags=["Backtesting"])

# Approximate trading-day counts per requested period, used to decide whether
# cached data actually satisfies the request (see run_backtest below).
_PERIOD_MIN_BARS = {"1y": 240, "2y": 480, "5y": 1200, "max": 250}

_STRATEGIES = {
    "trend_momentum": TrendMomentumStrategy,
    "mean_reversion": MeanReversionStrategy,
}


class BacktestRequest(BaseModel):
    ticker: str
    period: str = Field(default="5y", description="Historical lookback: 1y, 2y, 5y, or max")
    initial_capital: float = Field(default=100000.0, gt=0)
    strategy: str = Field(default="trend_momentum", description="trend_momentum or mean_reversion")
    cost_pct: float = Field(default=DEFAULT_COST_PCT, ge=0, le=2, description="Transaction costs (brokerage, STT, charges) as % per side")
    slippage_pct: float = Field(default=DEFAULT_SLIPPAGE_PCT, ge=0, le=2, description="Slippage as % per side")


@router.post("/run")
async def run_backtest(
    request: BacktestRequest,
    downloader: YahooDownloader = Depends(get_downloader),
    cache: FileCacheManager = Depends(get_cache),
):
    """
    Runs a long-only strategy simulation over historical daily data, with an
    ATR-based stop loss and target, next-day-open execution, and per-side
    transaction costs and slippage (see backtesting/engine.py).
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
    # Kept uniform across strategy choices (even though MeanReversion only
    # needs the much shorter BB_20/RSI_14 warmup) so switching strategies on
    # the same ticker/period simulates the exact same date range - otherwise
    # a shorter warmup would let mean reversion "see" extra history the
    # trend strategy couldn't, making any comparison between them unfair.
    features_df = features_df[features_df["SMA_200"].notna() & features_df["RSI_14"].notna() & features_df["ATR_14"].notna() & features_df["BB_Lower_20"].notna()]
    if len(features_df) < 30:
        raise InsufficientDataError(processed_ticker, len(features_df))

    strategy_key = request.strategy if request.strategy in _STRATEGIES else "trend_momentum"
    strategy = _STRATEGIES[strategy_key]()
    engine = BacktestEngine(
        data=features_df,
        strategy=strategy,
        initial_capital=request.initial_capital,
        cost_pct=request.cost_pct,
        slippage_pct=request.slippage_pct,
    )
    result = engine.run()

    # Buy & Hold benchmark - the question every backtest result needs to
    # answer is "did the strategy actually beat just holding the stock?".
    # Computed over the exact same trimmed date range as the strategy run
    # (features_df, not the raw untrimmed stock_df) so the comparison is
    # apples-to-apples rather than the benchmark getting extra warmup days.
    # Pays the same entry slippage and costs as the strategy, filled at the
    # first bar's open, so the strategy isn't flattered by a free benchmark.
    cost_rate = request.cost_pct / 100.0
    bh_fill = float(features_df["Open"].iloc[0]) * (1 + request.slippage_pct / 100.0)
    bh_shares = request.initial_capital / (1 + cost_rate) / bh_fill
    bh_equity_values = (features_df["Close"].astype(float) * bh_shares).tolist()
    bh_equity_dates = [d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d) for d in features_df.index]
    bh_equity_series = pd.Series(bh_equity_values, index=pd.to_datetime(bh_equity_dates))
    bh_metrics = BacktestMetrics.summarize(bh_equity_series, [], request.initial_capital)

    strategy_return = result["metrics"]["total_return_pct"]
    benchmark_return = bh_metrics["total_return_pct"]

    return {
        "ticker": processed_ticker,
        "period": period,
        "bars_simulated": len(features_df),
        **result,
        "benchmark": {
            "name": "Buy & Hold",
            "equity_curve": [{"date": d, "value": round(v, 2)} for d, v in zip(bh_equity_dates, bh_equity_values)],
            "metrics": bh_metrics,
        },
        "alpha_pct": round(strategy_return - benchmark_return, 2),
    }
