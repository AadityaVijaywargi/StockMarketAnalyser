"""
Backtesting engine, strategies, metrics and the /backtest/run endpoint.

Engine tests use hand-built OHLC bars and a scripted strategy so every fill
price can be checked exactly - a backtest that silently fills at the wrong
price still renders a perfectly plausible-looking equity curve.
"""
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from analysis.indicators import calculate_all_indicators
from api.api import create_app
from api.deps import get_cache, get_downloader
from backtesting.engine import BacktestEngine
from backtesting.metrics import BacktestMetrics
from backtesting.strategy import BaseStrategy, MeanReversionStrategy, TrendMomentumStrategy
from config.settings import settings


class ScriptedStrategy(BaseStrategy):
    name = "Scripted"

    def __init__(self, signals):
        self.signals = signals

    def generate_signals(self, df):
        return pd.Series(self.signals, index=df.index)


def bars(ohlc, atr=10.0):
    """ohlc: list of (open, high, low, close)."""
    dates = pd.date_range("2025-01-01", periods=len(ohlc), freq="B")
    df = pd.DataFrame(ohlc, columns=["Open", "High", "Low", "Close"], index=dates, dtype=float)
    df["ATR_14"] = atr
    return df


def run(ohlc, signals, atr=10.0, cost_pct=0.0, slippage_pct=0.0, capital=100000.0):
    engine = BacktestEngine(
        bars(ohlc, atr), ScriptedStrategy(signals),
        initial_capital=capital, cost_pct=cost_pct, slippage_pct=slippage_pct,
    )
    return engine.run()


FLAT = (100, 101, 99, 100)


# ---------------------------------------------------------------------------
# Execution model
# ---------------------------------------------------------------------------

def test_buy_signal_fills_at_next_bars_open_not_the_signal_close():
    result = run(
        [FLAT, (105, 106, 104, 105), (105, 106, 104, 105)],
        ["BUY", "HOLD", "HOLD"],
    )
    assert result["open_position"]["entry_price"] == 105.0
    assert result["open_position"]["entry_date"] == "2025-01-02"


def test_sell_signal_exits_at_next_open_with_correct_pnl():
    result = run(
        [FLAT, (100, 101, 99, 100), (110, 111, 109, 110), (120, 121, 119, 120)],
        ["BUY", "HOLD", "SELL", "HOLD"],
        atr=100.0,  # keep stop/target far away
    )
    [trade] = result["trades"]
    assert (trade["entry_price"], trade["exit_price"]) == (100.0, 120.0)
    assert trade["exit_reason"] == "Signal Exit"
    assert trade["pnl_pct"] == 20.0
    assert result["open_position"] is None
    assert result["metrics"]["final_value"] == 120000.0


def test_stop_loss_triggers_intraday_at_the_stop_price():
    # Entry 100, ATR 10 -> stop 80. Bar low touches 79 but closes at 95:
    # a close-only check would miss this stop entirely.
    result = run([FLAT, FLAT, (98, 99, 79, 95)], ["BUY", "HOLD", "HOLD"])
    [trade] = result["trades"]
    assert trade["exit_reason"] == "Stop Loss"
    assert trade["exit_price"] == 80.0


def test_gap_down_through_stop_fills_at_the_open():
    result = run([FLAT, FLAT, (70, 72, 65, 71)], ["BUY", "HOLD", "HOLD"])
    [trade] = result["trades"]
    assert trade["exit_reason"] == "Stop Loss"
    assert trade["exit_price"] == 70.0
    assert trade["pnl_pct"] == -30.0


def test_target_triggers_intraday_and_gap_up_fills_at_open():
    # Entry 100, ATR 10 -> target 140.
    intraday = run([FLAT, FLAT, (120, 141, 119, 125)], ["BUY", "HOLD", "HOLD"])
    assert intraday["trades"][0]["exit_reason"] == "Target Hit"
    assert intraday["trades"][0]["exit_price"] == 140.0

    gap = run([FLAT, FLAT, (150, 155, 149, 152)], ["BUY", "HOLD", "HOLD"])
    assert gap["trades"][0]["exit_price"] == 150.0


def test_bar_touching_both_stop_and_target_assumes_the_stop():
    result = run([FLAT, FLAT, (100, 150, 70, 100)], ["BUY", "HOLD", "HOLD"])
    assert result["trades"][0]["exit_reason"] == "Stop Loss"


def test_stop_and_target_are_sized_from_the_fill_price():
    # Signal close 100, but fills at a 110 open -> stop 90 (not 80).
    result = run([FLAT, (110, 111, 109, 110), (100, 101, 89, 95)], ["BUY", "HOLD", "HOLD"])
    assert result["trades"][0]["exit_price"] == 90.0


def test_buy_signal_on_last_bar_is_never_filled():
    result = run([FLAT, FLAT], ["HOLD", "BUY"])
    assert result["trades"] == []
    assert result["open_position"] is None
    assert result["metrics"]["final_value"] == 100000.0


def test_open_position_is_marked_to_market_without_a_synthetic_trade():
    result = run([FLAT, FLAT, (110, 111, 109, 112)], ["BUY", "HOLD", "HOLD"], atr=100.0)
    assert result["trades"] == []
    assert result["open_position"]["unrealized_pnl_pct"] == 12.0
    assert result["equity_curve"][-1]["value"] == 112000.0


# ---------------------------------------------------------------------------
# Costs and slippage
# ---------------------------------------------------------------------------

def test_flat_round_trip_loses_exactly_the_costs():
    result = run(
        [FLAT, FLAT, FLAT, FLAT], ["BUY", "HOLD", "SELL", "HOLD"],
        atr=100.0, cost_pct=0.1,
    )
    # Buy: 100000 buys 100000/1.001 of stock. Sell: that, minus 0.1%.
    expected_final = 100000 / 1.001 * 0.999
    assert result["metrics"]["final_value"] == pytest.approx(expected_final, abs=0.01)
    assert result["metrics"]["total_costs"] == pytest.approx(100000 - expected_final, abs=0.01)
    assert result["trades"][0]["pnl_pct"] == pytest.approx((expected_final / 100000 - 1) * 100, abs=0.01)


def test_slippage_moves_both_fills_against_the_trader():
    result = run(
        [FLAT, FLAT, FLAT, FLAT], ["BUY", "HOLD", "SELL", "HOLD"],
        atr=100.0, slippage_pct=1.0,
    )
    [trade] = result["trades"]
    assert trade["entry_price"] == 101.0
    assert trade["exit_price"] == 99.0
    assert trade["pnl_pct"] < 0


def test_reported_assumptions_match_the_run():
    result = run([FLAT, FLAT], ["HOLD", "HOLD"], cost_pct=0.2, slippage_pct=0.05)
    assert result["assumptions"]["cost_pct_per_side"] == 0.2
    assert result["assumptions"]["slippage_pct_per_side"] == 0.05


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def features():
    rng = np.random.default_rng(42)
    n = 600
    close = 1000 * np.exp(np.cumsum(rng.normal(0.0004, 0.018, n)))
    open_ = close * (1 + rng.normal(0, 0.004, n))
    df = pd.DataFrame({
        "Open": open_,
        "High": np.maximum(open_, close) * (1 + rng.uniform(0, 0.01, n)),
        "Low": np.minimum(open_, close) * (1 - rng.uniform(0, 0.01, n)),
        "Close": close,
        "Volume": rng.integers(100_000, 1_000_000, n),
    }, index=pd.date_range("2022-01-03", periods=n, freq="B"))
    return df.join(calculate_all_indicators(df, settings.INDICATOR_PERIODS))


@pytest.mark.parametrize("strategy_cls", [TrendMomentumStrategy, MeanReversionStrategy])
def test_strategy_signals_never_use_future_data(features, strategy_cls):
    full = strategy_cls().generate_signals(features)
    cutoff = 450
    truncated = strategy_cls().generate_signals(features.iloc[:cutoff])
    pd.testing.assert_series_equal(full.iloc[:cutoff], truncated)


@pytest.mark.parametrize("strategy_cls", [TrendMomentumStrategy, MeanReversionStrategy])
def test_strategy_emits_only_known_signals_and_actually_trades(features, strategy_cls):
    signals = strategy_cls().generate_signals(features)
    assert set(signals.unique()) <= {"BUY", "SELL", "HOLD"}
    assert (signals == "BUY").any()


def test_trend_momentum_buys_only_in_a_bullish_regime(features):
    signals = TrendMomentumStrategy().generate_signals(features)
    buys = features[signals == "BUY"]
    assert (buys["SMA_50"] > buys["SMA_200"]).all()
    assert buys["RSI_14"].between(40, 70).all()


def test_mean_reversion_buys_only_below_lower_band_when_oversold(features):
    signals = MeanReversionStrategy().generate_signals(features)
    buys = features[signals == "BUY"]
    assert (buys["Close"] < buys["BB_Lower_20"]).all()
    assert (buys["RSI_14"] < 35).all()


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def test_max_drawdown_is_the_worst_peak_to_trough_fall():
    curve = pd.Series([100, 120, 90, 130, 104, 140])
    assert BacktestMetrics.calculate_max_drawdown(curve) == -25.0


def test_sharpe_is_zero_for_a_flat_curve():
    assert BacktestMetrics.calculate_sharpe_ratio(pd.Series([0.0] * 50)) == 0.0


def test_summarize_trade_stats_and_cagr():
    curve = pd.Series(np.linspace(100000, 121000, 504), index=pd.date_range("2023-01-02", periods=504, freq="B"))
    trades = [{"pnl_pct": 10.0}, {"pnl_pct": -4.0}, {"pnl_pct": 6.0}, {"pnl_pct": 0.0}]
    m = BacktestMetrics.summarize(curve, trades, 100000)
    assert m["total_return_pct"] == 21.0
    assert m["cagr_pct"] == pytest.approx(10.0, abs=0.05)  # 1.21 over 2 years
    assert m["total_trades"] == 4
    assert m["win_rate_pct"] == 50.0
    assert m["avg_win_pct"] == 8.0
    assert m["avg_loss_pct"] == -2.0


# ---------------------------------------------------------------------------
# /backtest/run endpoint
# ---------------------------------------------------------------------------

class _FakeDownloader:
    def __init__(self, df):
        self.df = df

    def download_ticker_data(self, ticker, years=None, interval="1d", period=None):
        return self.df


class _NoCache:
    def get(self, ticker, interval="1d"):
        return None

    def set(self, ticker, df, interval="1d"):
        return True


@pytest.fixture
def client(features):
    app = create_app()
    raw = features[["Open", "High", "Low", "Close", "Volume"]]
    app.dependency_overrides[get_downloader] = lambda: _FakeDownloader(raw)
    app.dependency_overrides[get_cache] = lambda: _NoCache()
    return TestClient(app)


def test_backtest_endpoint_reports_costs_and_charges_the_benchmark_too(client, features):
    resp = client.post("/backtest/run", json={"ticker": "TEST", "period": "2y", "strategy": "mean_reversion"})
    assert resp.status_code == 200
    body = resp.json()

    assert body["assumptions"]["cost_pct_per_side"] == 0.1
    assert body["assumptions"]["slippage_pct_per_side"] == 0.05
    assert body["metrics"]["total_costs"] > 0
    assert body["alpha_pct"] == round(body["metrics"]["total_return_pct"] - body["benchmark"]["metrics"]["total_return_pct"], 2)

    # Benchmark buys the first simulated bar's open with slippage + costs.
    first_bar = body["benchmark"]["equity_curve"][0]
    row = features.loc[first_bar["date"]]
    expected = 100000 / 1.001 / (row["Open"] * 1.0005) * row["Close"]
    assert first_bar["value"] == pytest.approx(expected, abs=0.01)


def test_backtest_endpoint_rejects_out_of_range_costs(client):
    resp = client.post("/backtest/run", json={"ticker": "TEST", "cost_pct": 5})
    assert resp.status_code == 422
