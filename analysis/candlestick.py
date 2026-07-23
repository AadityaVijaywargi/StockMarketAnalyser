import logging
import pandas as pd
import numpy as np

logger = logging.getLogger("AIEquityResearchPlatform")

def calculate_returns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculates returns features over multiple time horizons:
    - Daily Returns
    - Weekly Returns (5 trading days)
    - Monthly Returns (21 trading days)
    """
    features = pd.DataFrame(index=df.index)
    close = df["Close"]
    
    features["Return_Daily"] = close.pct_change()
    features["Return_Weekly"] = close.pct_change(periods=5)
    features["Return_Monthly"] = close.pct_change(periods=21)
    
    return features


def calculate_gaps(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detects Gap Up and Gap Down occurrences.
    - Gap Up: Today's Open is strictly higher than yesterday's High.
    - Gap Down: Today's Open is strictly lower than yesterday's Low.
    """
    features = pd.DataFrame(index=df.index)
    open_series = df["Open"]
    high = df["High"]
    low = df["Low"]
    
    features["Gap_Up"] = (open_series > high.shift(1)).astype(int)
    features["Gap_Down"] = (open_series < low.shift(1)).astype(int)
    
    return features


def calculate_bar_types(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detects Inside Bars and Outside Bars.
    - Inside Bar: Today's High/Low is completely within yesterday's range.
    - Outside Bar: Today's High/Low completely engulfs yesterday's range.
    """
    features = pd.DataFrame(index=df.index)
    high = df["High"]
    low = df["Low"]
    
    features["Inside_Bar"] = ((high < high.shift(1)) & (low > low.shift(1))).astype(int)
    features["Outside_Bar"] = ((high > high.shift(1)) & (low < low.shift(1))).astype(int)
    
    return features


def calculate_single_candle_patterns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detects single candle patterns:
    - Doji (body is <= 10% of range)
    - Marubozu (body is >= 90% of range)
    - Hammer (small body, long lower shadow, tiny upper shadow)
    - Shooting Star (small body, long upper shadow, tiny lower shadow)
    """
    features = pd.DataFrame(index=df.index)
    o = df["Open"]
    h = df["High"]
    l = df["Low"]
    c = df["Close"]
    
    body = (c - o).abs()
    rng = h - l
    
    # Safe division handler (avoid divide-by-zero on flat candles)
    rng_safe = rng.replace(0, 1e-6)
    
    # 1. Doji
    features["Doji"] = ((body <= 0.1 * rng) & (rng > 0)).astype(int)
    
    # 2. Marubozu
    features["Marubozu"] = ((body >= 0.9 * rng) & (rng > 0)).astype(int)
    
    # 3. Hammer
    # Body is in the upper part of the range. Lower shadow is at least 60% of range. Upper shadow is <= 10% of range.
    lower_shadow = o.combine(c, min) - l
    upper_shadow = h - o.combine(c, max)
    features["Hammer"] = (
        (body <= 0.3 * rng_safe) & 
        (lower_shadow >= 0.6 * rng_safe) & 
        (upper_shadow <= 0.1 * rng_safe) & 
        (rng > 0)
    ).astype(int)
    
    # 4. Shooting Star
    # Body is in the lower part of the range. Upper shadow is at least 60% of range. Lower shadow is <= 10% of range.
    features["Shooting_Star"] = (
        (body <= 0.3 * rng_safe) & 
        (upper_shadow >= 0.6 * rng_safe) & 
        (lower_shadow <= 0.1 * rng_safe) & 
        (rng > 0)
    ).astype(int)
    
    return features


def calculate_engulfing_patterns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detects Bullish and Bearish Engulfing patterns.
    """
    features = pd.DataFrame(index=df.index)
    o = df["Open"]
    c = df["Close"]
    
    # 1. Bullish Engulfing
    # Yesterday was bearish, today is bullish, today's body engulfs yesterday's body.
    prev_bearish = c.shift(1) < o.shift(1)
    curr_bullish = c > o
    engulfs_body = (o <= c.shift(1)) & (c >= o.shift(1))
    features["Bullish_Engulfing"] = (prev_bearish & curr_bullish & engulfs_body).astype(int)
    
    # 2. Bearish Engulfing
    # Yesterday was bullish, today is bearish, today's body engulfs yesterday's body.
    prev_bullish = c.shift(1) > o.shift(1)
    curr_bearish = c < o
    engulfs_body_bear = (o >= c.shift(1)) & (c <= o.shift(1))
    features["Bearish_Engulfing"] = (prev_bullish & curr_bearish & engulfs_body_bear).astype(int)
    
    return features


def calculate_multi_candle_patterns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detects three-candle patterns: Morning Star and Evening Star.
    """
    features = pd.DataFrame(index=df.index)
    o = df["Open"]
    h = df["High"]
    l = df["Low"]
    c = df["Close"]
    
    body = (c - o).abs()
    rng = h - l
    
    # 1. Morning Star (Bullish Reversal)
    # Day 1: Large bearish candle
    day1_bearish = (c.shift(2) < o.shift(2)) & (body.shift(2) >= 0.5 * (h.shift(2) - l.shift(2)))
    # Day 2: Small body candle that gaps down
    day2_star = (body.shift(1) <= 0.3 * (h.shift(1) - l.shift(1))) & (o.shift(1) < c.shift(2))
    # Day 3: Large bullish candle that closes above midpoint of Day 1 body
    day3_bullish = (c > o) & (c >= o.shift(2) - 0.5 * body.shift(2))
    features["Morning_Star"] = (day1_bearish & day2_star & day3_bullish).astype(int)
    
    # 2. Evening Star (Bearish Reversal)
    # Day 1: Large bullish candle
    day1_bullish = (c.shift(2) > o.shift(2)) & (body.shift(2) >= 0.5 * (h.shift(2) - l.shift(2)))
    # Day 2: Small body candle that gaps up
    day2_star_up = (body.shift(1) <= 0.3 * (h.shift(1) - l.shift(1))) & (o.shift(1) > c.shift(2))
    # Day 3: Large bearish candle that closes below midpoint of Day 1 body
    day3_bearish = (c < o) & (c <= o.shift(2) + 0.5 * body.shift(2))
    features["Evening_Star"] = (day1_bullish & day2_star_up & day3_bearish).astype(int)
    
    return features


def calculate_all_candlestick_patterns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Main entry point. Runs all candlestick/bar calculations.
    """
    logger.info("Computing price action returns and candlestick patterns...")
    
    ret_df = calculate_returns(df)
    gap_df = calculate_gaps(df)
    bar_df = calculate_bar_types(df)
    single_df = calculate_single_candle_patterns(df)
    engulf_df = calculate_engulfing_patterns(df)
    multi_df = calculate_multi_candle_patterns(df)
    
    combined = pd.concat([ret_df, gap_df, bar_df, single_df, engulf_df, multi_df], axis=1)
    
    # Fill boundary NaNs
    combined.ffill(inplace=True)
    combined.bfill(inplace=True)
    
    logger.info(f"Successfully computed {len(combined.columns)} price action / pattern columns.")
    return combined
