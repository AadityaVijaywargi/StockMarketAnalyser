import logging
import numpy as np
import pandas as pd
import pandas_ta_classic as ta
from typing import Dict, Any

logger = logging.getLogger("AIEquityResearchPlatform")

def calculate_moving_averages(df: pd.DataFrame, settings_dict: Dict[str, Any]) -> pd.DataFrame:
    """
    Computes requested Simple and Exponential Moving Averages (SMA & EMA).
    """
    features = pd.DataFrame(index=df.index)
    close_series = df["Close"]
    
    sma_periods = settings_dict.get("sma_periods", [10, 20, 50, 100, 150, 200])
    for period in sma_periods:
        col_name = f"SMA_{period}"
        features[col_name] = ta.sma(close_series, length=period)
        
    ema_periods = settings_dict.get("ema_periods", [9, 12, 20, 26, 50, 100, 200])
    for period in ema_periods:
        col_name = f"EMA_{period}"
        features[col_name] = ta.ema(close_series, length=period)
        
    return features


def calculate_momentum_indicators(df: pd.DataFrame, settings_dict: Dict[str, Any]) -> pd.DataFrame:
    """
    Computes Momentum indicators: RSI, MACD, ROC, Momentum, CCI, Williams %R, Stochastic RSI, Awesome Oscillator.
    """
    features = pd.DataFrame(index=df.index)
    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    
    # 1. RSI
    rsi_len = settings_dict.get("rsi_period", 14)
    features[f"RSI_{rsi_len}"] = ta.rsi(close, length=rsi_len)
    
    # 2. MACD
    fast = settings_dict.get("macd_fast", 12)
    slow = settings_dict.get("macd_slow", 26)
    sig = settings_dict.get("macd_signal", 9)
    macd_df = ta.macd(close, fast=fast, slow=slow, signal=sig)
    if macd_df is not None:
        features[f"MACD_{fast}_{slow}_{sig}"] = macd_df[f"MACD_{fast}_{slow}_{sig}"]
        features[f"MACD_Signal_{fast}_{slow}_{sig}"] = macd_df[f"MACDs_{fast}_{slow}_{sig}"]
        features[f"MACD_Hist_{fast}_{slow}_{sig}"] = macd_df[f"MACDh_{fast}_{slow}_{sig}"]
        
    # 3. ROC
    roc_len = settings_dict.get("roc_period", 12)
    features[f"ROC_{roc_len}"] = ta.roc(close, length=roc_len)
    
    # 4. Momentum (MOM)
    mom_len = settings_dict.get("momentum_period", 10)
    features[f"Momentum_{mom_len}"] = ta.mom(close, length=mom_len)
    
    # 5. CCI
    cci_len = settings_dict.get("cci_period", 20)
    features[f"CCI_{cci_len}"] = ta.cci(high, low, close, length=cci_len)
    
    # 6. Williams %R
    willr_len = settings_dict.get("willr_period", 14)
    features[f"WilliamsR_{willr_len}"] = ta.willr(high, low, close, length=willr_len)
    
    # 7. Stochastic RSI
    stoch_rsi_len = settings_dict.get("stoch_rsi_period", 14)
    stoch_rsi_df = ta.stochrsi(close, length=stoch_rsi_len)
    if stoch_rsi_df is not None:
        # Columns depend on settings; search by prefix or handle standard names
        k_col = [col for col in stoch_rsi_df.columns if col.startswith("STOCHRSIk")][0]
        d_col = [col for col in stoch_rsi_df.columns if col.startswith("STOCHRSId")][0]
        features[f"StochRSI_K_{stoch_rsi_len}"] = stoch_rsi_df[k_col]
        features[f"StochRSI_D_{stoch_rsi_len}"] = stoch_rsi_df[d_col]
        
    # 8. Awesome Oscillator
    ao_series = ta.ao(high, low)
    features["Awesome_Oscillator"] = ao_series
    
    return features


def calculate_trend_indicators(df: pd.DataFrame, settings_dict: Dict[str, Any]) -> pd.DataFrame:
    """
    Computes Trend indicators: ADX, DI+, DI-, Parabolic SAR, Supertrend, Ichimoku Cloud.
    """
    features = pd.DataFrame(index=df.index)
    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    
    # 1. ADX (ADX, DMP, DMN)
    adx_len = settings_dict.get("adx_period", 14)
    adx_df = ta.adx(high, low, close, length=adx_len)
    if adx_df is not None:
        features[f"ADX_{adx_len}"] = adx_df[f"ADX_{adx_len}"]
        features[f"DI_Plus_{adx_len}"] = adx_df[f"DMP_{adx_len}"]
        features[f"DI_Minus_{adx_len}"] = adx_df[f"DMN_{adx_len}"]
        
    # 2. Parabolic SAR
    psar_df = ta.psar(high, low, close)
    if psar_df is not None:
        # Merge long/short PSAR into single column (PSARl contains values for long trend, PSARs for short)
        psar_long_col = [col for col in psar_df.columns if col.startswith("PSARl")][0]
        psar_short_col = [col for col in psar_df.columns if col.startswith("PSARs")][0]
        features["PSAR"] = psar_df[psar_long_col].fillna(psar_df[psar_short_col])
        
    # 3. Supertrend
    st_period = settings_dict.get("supertrend_period", 10)
    st_mult = settings_dict.get("supertrend_multiplier", 3.0)
    st_df = ta.supertrend(high, low, close, period=st_period, multiplier=st_mult)
    if st_df is not None:
        st_val_col = [col for col in st_df.columns if col.startswith("SUPERT_")][0]
        st_dir_col = [col for col in st_df.columns if col.startswith("SUPERTd_")][0]
        features[f"Supertrend_{st_period}_{st_mult}"] = st_df[st_val_col]
        features[f"Supertrend_Dir_{st_period}_{st_mult}"] = st_df[st_dir_col]
        
    # 4. Ichimoku Cloud
    ichimoku_res = ta.ichimoku(high, low, close)
    if ichimoku_res is not None:
        # In this env, it returns a single DataFrame
        ichimoku_df = ichimoku_res[0] if isinstance(ichimoku_res, tuple) else ichimoku_res
        features["Ichimoku_Span_A"] = ichimoku_df["ISA_9"]
        features["Ichimoku_Span_B"] = ichimoku_df["ISB_26"]
        features["Ichimoku_Tenkan"] = ichimoku_df["ITS_9"]
        features["Ichimoku_Kijun"] = ichimoku_df["IKS_26"]
        features["Ichimoku_Chikou"] = ichimoku_df["ICS_26"]
        
    return features


def calculate_volume_indicators(df: pd.DataFrame, settings_dict: Dict[str, Any]) -> pd.DataFrame:
    """
    Computes Volume indicators: OBV, VWAP, CMF, MFI, ADL (AD), Volume Oscillator, Average Volume, Relative Volume.
    """
    features = pd.DataFrame(index=df.index)
    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    volume = df["Volume"]
    
    # 1. OBV
    features["OBV"] = ta.obv(close, volume)
    
    # 2. VWAP (volume weighted average price)
    vwap_series = ta.vwap(high, low, close, volume)
    features["VWAP"] = vwap_series
    
    # 3. Chaikin Money Flow (CMF)
    cmf_len = settings_dict.get("cmf_period", 20)
    features[f"CMF_{cmf_len}"] = ta.cmf(high, low, close, volume, length=cmf_len)
    
    # 4. Money Flow Index (MFI)
    mfi_len = settings_dict.get("mfi_period", 14)
    features[f"MFI_{mfi_len}"] = ta.mfi(high, low, close, volume, length=mfi_len)
    
    # 5. Accumulation Distribution Line (ADL/AD)
    features["ADL"] = ta.ad(high, low, close, volume)
    
    # 6. Volume Oscillator
    # PVO: percentage volume oscillator (slow=26, fast=12, signal=9)
    pvo_df = ta.pvo(volume)
    if pvo_df is not None:
        pvo_col = [col for col in pvo_df.columns if col.startswith("PVO_")][0]
        features["Volume_Oscillator"] = pvo_df[pvo_col]
        
    # 7. Average Volume (20 days)
    avg_vol_len = settings_dict.get("average_volume_period", 20)
    features[f"Average_Volume_{avg_vol_len}"] = volume.rolling(window=avg_vol_len).mean()
    
    # 8. Relative Volume (RVOL)
    features["Relative_Volume"] = volume / features[f"Average_Volume_{avg_vol_len}"]
    
    return features


def calculate_volatility_indicators(df: pd.DataFrame, settings_dict: Dict[str, Any]) -> pd.DataFrame:
    """
    Computes Volatility indicators: ATR, Bollinger Bands, Keltner Channels, Donchian Channels, Standard Deviation, Historical Volatility.
    """
    features = pd.DataFrame(index=df.index)
    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    
    # 1. ATR
    atr_len = settings_dict.get("atr_period", 14)
    features[f"ATR_{atr_len}"] = ta.atr(high, low, close, length=atr_len)
    
    # 2. Bollinger Bands
    bb_len = settings_dict.get("bb_period", 20)
    bb_std = settings_dict.get("bb_std", 2.0)
    bb_df = ta.bbands(close, length=bb_len, std=bb_std)
    if bb_df is not None:
        bbl_col = [col for col in bb_df.columns if col.startswith("BBL")][0]
        bbm_col = [col for col in bb_df.columns if col.startswith("BBM")][0]
        bbu_col = [col for col in bb_df.columns if col.startswith("BBU")][0]
        features[f"BB_Lower_{bb_len}"] = bb_df[bbl_col]
        features[f"BB_Middle_{bb_len}"] = bb_df[bbm_col]
        features[f"BB_Upper_{bb_len}"] = bb_df[bbu_col]
        
    # 3. Keltner Channels
    kc_len = settings_dict.get("kc_period", 20)
    kc_df = ta.kc(high, low, close, length=kc_len)
    if kc_df is not None:
        # Search by suffix/prefix to match column names
        kcl_col = [col for col in kc_df.columns if col.startswith("KCL")][0]
        kcb_col = [col for col in kc_df.columns if col.startswith("KCB")][0]
        kcu_col = [col for col in kc_df.columns if col.startswith("KCU")][0]
        features[f"KC_Lower_{kc_len}"] = kc_df[kcl_col]
        features[f"KC_Middle_{kc_len}"] = kc_df[kcb_col]
        features[f"KC_Upper_{kc_len}"] = kc_df[kcu_col]
        
    # 4. Donchian Channels
    dc_len = settings_dict.get("donchian_period", 20)
    dc_df = ta.donchian(high, low, lower_length=dc_len, upper_length=dc_len)
    if dc_df is not None:
        dcl_col = [col for col in dc_df.columns if col.startswith("DCL")][0]
        dcm_col = [col for col in dc_df.columns if col.startswith("DCM")][0]
        dcu_col = [col for col in dc_df.columns if col.startswith("DCU")][0]
        features[f"DC_Lower_{dc_len}"] = dc_df[dcl_col]
        features[f"DC_Middle_{dc_len}"] = dc_df[dcm_col]
        features[f"DC_Upper_{dc_len}"] = dc_df[dcu_col]
        
    # 5. Standard Deviation of Close (20 days)
    sd_len = settings_dict.get("std_period", 20)
    features[f"Std_Dev_{sd_len}"] = close.rolling(window=sd_len).std()
    
    # 6. Historical Volatility (20 days annualized pct change std)
    # Annualized multiplier is sqrt(252) * 100
    features[f"Hist_Vol_{sd_len}"] = close.pct_change().rolling(window=sd_len).std() * np.sqrt(252) * 100
    
    return features


def calculate_ma_ribbon_and_crossovers(df: pd.DataFrame, settings_dict: Dict[str, Any]) -> pd.DataFrame:
    """
    Calculates Moving Average crossovers and ribbons.
    - Golden Cross: SMA 50 > SMA 200 (1 if bullish, 0 otherwise)
    - Death Cross: SMA 50 < SMA 200 (1 if bearish, 0 otherwise)
    - EMA Crossovers: EMA 9 vs EMA 21 (1 if EMA 9 > EMA 21, 0 otherwise)
    - MA Ribbon dispersion: standard deviation of multiple EMAs (9, 20, 50, 100)
    """
    features = pd.DataFrame(index=df.index)
    close = df["Close"]
    
    # Pre-calculate required moving averages
    sma_50 = ta.sma(close, length=50)
    sma_200 = ta.sma(close, length=200)
    
    ema_9 = ta.ema(close, length=9)
    ema_20 = ta.ema(close, length=20)
    ema_21 = ta.ema(close, length=21)  # standard MACD trigger ribbon
    ema_50 = ta.ema(close, length=50)
    ema_100 = ta.ema(close, length=100)

    # 1. Crossovers
    if sma_50 is not None and sma_200 is not None:
        features["Golden_Cross"] = (sma_50 > sma_200).astype(int)
        features["Death_Cross"] = (sma_50 < sma_200).astype(int)
    else:
        features["Golden_Cross"] = pd.Series(0, index=df.index)
        features["Death_Cross"] = pd.Series(0, index=df.index)
        
    if ema_9 is not None and ema_21 is not None:
        features["EMA_9_21_Crossover"] = (ema_9 > ema_21).astype(int)
    else:
        features["EMA_9_21_Crossover"] = pd.Series(0, index=df.index)
    
    # 2. Moving Average Ribbon dispersion (relative std)
    # A tight dispersion indicates consolidation (potential breakout), wide indicates strong trend.
    ma_cols = [ema_9, ema_20, ema_50, ema_100]
    valid_mas = [m for m in ma_cols if m is not None]
    if valid_mas:
        ma_matrix = pd.concat(valid_mas, axis=1)
        features["MA_Ribbon_Dispersion"] = ma_matrix.std(axis=1) / ma_matrix.mean(axis=1)
    else:
        features["MA_Ribbon_Dispersion"] = pd.Series(0.0, index=df.index)

    return features


def calculate_all_indicators(df: pd.DataFrame, settings_dict: Dict[str, Any]) -> pd.DataFrame:
    """
    Main entry point. Runs all sub-module indicator calculations and returns consolidated DataFrame.
    """
    logger.info("Computing technical indicators across all categories...")
    
    ma_df = calculate_moving_averages(df, settings_dict)
    mom_df = calculate_momentum_indicators(df, settings_dict)
    trend_df = calculate_trend_indicators(df, settings_dict)
    vol_df = calculate_volume_indicators(df, settings_dict)
    vola_df = calculate_volatility_indicators(df, settings_dict)
    cross_df = calculate_ma_ribbon_and_crossovers(df, settings_dict)
    
    # Combine all DataFrames along the same index
    combined = pd.concat([ma_df, mom_df, trend_df, vol_df, vola_df, cross_df], axis=1)
    
    # Forward and backward fill to clean any boundary NaNs from rolling indicators
    combined.ffill(inplace=True)
    combined.bfill(inplace=True)
    
    logger.info(f"Successfully computed {len(combined.columns)} indicator columns.")
    return combined
