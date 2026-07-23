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

# Configurable Thresholds for Recommendation
DEFAULT_BUY_THRESHOLD = 70.0
DEFAULT_WATCH_THRESHOLD = 50.0

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
