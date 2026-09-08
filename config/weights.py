from typing import Dict

# Configurable Weights for Scoring (must sum to 1.0)
DEFAULT_SCORE_WEIGHTS: Dict[str, float] = {
    "trend": 0.25,
    "momentum": 0.20,
    "volume": 0.15,
    "patterns": 0.15,
    "support": 0.10,
    "resistance": 0.10,
    "volatility": 0.05,
}

# Configurable 7-Level Recommendation Probability Thresholds
RECOMMENDATION_PROBABILITY_THRESHOLDS: Dict[str, float] = {
    "STRONG BUY": 90.0,   # 90–100%
    "BUY": 75.0,          # 75–89%
    "ACCUMULATE": 60.0,   # 60–74%
    "HOLD": 40.0,         # 40–59%
    "REDUCE": 25.0,       # 25–39%
    "SELL": 10.0,         # 10–24%
    "STRONG SELL": 0.0,   # 0–9%
}

# Configurable Thresholds for Scoring Fallback
DEFAULT_BUY_THRESHOLD = 65.0
DEFAULT_WATCH_THRESHOLD = 45.0

PREDICTION_HORIZON_WEIGHTS: Dict[str, Dict[str, float]] = {
    "5m": {"technical": 0.25, "price_action": 0.10, "volume": 0.20, "momentum": 0.15, "market": 0.10, "sector": 0.05, "news": 0.07, "sentiment": 0.03, "volatility": 0.05},
    "15m": {"technical": 0.24, "price_action": 0.10, "volume": 0.18, "momentum": 0.14, "market": 0.10, "sector": 0.06, "news": 0.08, "sentiment": 0.05, "volatility": 0.05},
    "30m": {"technical": 0.22, "price_action": 0.10, "volume": 0.16, "momentum": 0.12, "market": 0.10, "sector": 0.08, "news": 0.12, "sentiment": 0.05, "volatility": 0.05},
    "1d": {"technical": 0.20, "price_action": 0.10, "volume": 0.15, "momentum": 0.10, "market": 0.10, "sector": 0.10, "news": 0.15, "sentiment": 0.05, "volatility": 0.05},
    "1w": {"technical": 0.18, "price_action": 0.10, "volume": 0.10, "momentum": 0.10, "market": 0.12, "sector": 0.12, "news": 0.18, "sentiment": 0.06, "volatility": 0.04},
    "1mo": {"technical": 0.15, "price_action": 0.10, "volume": 0.08, "momentum": 0.08, "market": 0.14, "sector": 0.14, "news": 0.20, "sentiment": 0.07, "volatility": 0.04},
}

EVENT_OVERRIDE_IMPORTANCE_THRESHOLD = 85.0

# Indicator settings (default periods/lengths)
INDICATOR_SETTINGS = {
    "sma_periods": [10, 20, 50, 100, 150, 200],
    "ema_periods": [9, 12, 20, 26, 50, 100, 200],
    "rsi_period": 14,
    "macd_fast": 12,
    "macd_slow": 26,
    "macd_signal": 9,
    "roc_period": 12,
    "cci_period": 20,
    "willr_period": 14,
    "stoch_rsi_period": 14,
    "adx_period": 14,
    "atr_period": 14,
    "bb_period": 20,
    "bb_std": 2,
    "kc_period": 20,
    "donchian_period": 20,
    "supertrend_period": 10,
    "supertrend_multiplier": 3.0,
    "mfi_period": 14,
    "cmf_period": 20,
}
