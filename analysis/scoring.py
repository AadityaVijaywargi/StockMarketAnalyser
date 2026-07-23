import logging
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from analysis.interfaces import BaseScorer
from analysis.models.scores import TechnicalScores, ScoreComponent
from analysis.models.risk import RiskProfile
from analysis.support_resistance import calculate_sr_zones, SRZone
from analysis.patterns import detect_all_patterns, PatternDetection
from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

def calculate_slope_and_r2(y: np.ndarray) -> Tuple[float, float]:
    """
    Computes the linear regression slope and R-squared metric for a time series.
    Provides standard trend direction and trend consistency parameters.
    """
    n = len(y)
    if n < 5:
        return 0.0, 0.0
    x = np.arange(n)
    A = np.vstack([x, np.ones(n)]).T
    # Solve linear least squares
    m, c = np.linalg.lstsq(A, y, rcond=-1)[0]
    
    # Calculate R-squared
    y_pred = m * x + c
    residuals = y - y_pred
    ss_res = np.sum(residuals**2)
    ss_tot = np.sum((y - np.mean(y))**2)
    r2 = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0
    
    return float(m), float(r2)


class RuleBasedScorer(BaseScorer):
    """
    Institutional-Grade Calibrated Deterministic Quantitative Scoring Engine.
    Processes engineered sub-features to compute regime-aware categories,
    calculates signal alignment, performs risk adjustments, and executes
    a separated decision logic.
    """
    def __init__(self, weights: Dict[str, float] = None):
        super().__init__()
        # Backtesting Ready Parameters Configuration Block
        self.buy_threshold = settings.BUY_THRESHOLD
        self.watch_threshold = settings.WATCH_THRESHOLD
        
        # Dynamic weighting configurations for different market regimes
        self.regime_weights = {
            "trending": {
                "trend": 0.30,
                "momentum": 0.15,
                "volume": 0.15,
                "patterns": 0.10,
                "support": 0.05,
                "resistance": 0.05,
                "volatility": 0.10,
                "relative_strength": 0.10
            },
            "rangebound": {
                "trend": 0.10,
                "momentum": 0.20,
                "volume": 0.15,
                "patterns": 0.10,
                "support": 0.20,
                "resistance": 0.15,
                "volatility": 0.05,
                "relative_strength": 0.05
            },
            "volatile": {
                "trend": 0.15,
                "momentum": 0.10,
                "volume": 0.10,
                "patterns": 0.05,
                "support": 0.15,
                "resistance": 0.10,
                "volatility": 0.25,
                "relative_strength": 0.10
            }
        }

    def calculate_scores(
        self, 
        features_df: pd.DataFrame, 
        market_context: Dict[str, Any]
    ) -> Tuple[TechnicalScores, RiskProfile, List[str], List[str], List[str]]:
        """
        Calculates normalized category scores, determines market regime, evaluates
        signal alignment for confidence, adjusts for risk, and issues trading decisions.
        """
        if features_df.empty:
            raise ValueError("Feature DataFrame is empty. Cannot compute scores.")

        # Extract basic values
        close = float(features_df["Close"].iloc[-1])
        vol_ratio = float(features_df["Relative_Volume"].iloc[-1]) if "Relative_Volume" in features_df.columns else 1.0
        stockBeta = float(market_context.get("stock_beta", 1.0))
        stockCorrelation = float(market_context.get("stock_correlation", 0.7))
        
        pos_factors = []
        neg_factors = []
        neu_factors = []

        # -------------------------------------------------------------
        # LAYER 1: FEATURE ENGINEERING (Extracting 30+ core indicators)
        # -------------------------------------------------------------
        # Calculate pivots & zones internally for support/resistance scoring
        try:
            support_zones, resistance_zones = calculate_sr_zones(features_df)
        except Exception as e:
            logger.warning(f"S/R calculation failed during scoring: {str(e)}")
            support_zones, resistance_zones = [], []

        # Detect patterns
        try:
            detected_patterns = detect_all_patterns(features_df)
        except Exception as e:
            logger.warning(f"Pattern detection failed during scoring: {str(e)}")
            detected_patterns = []

        # -------------------------------------------------------------
        # LAYER 2: CATEGORY SCORE CALCULATIONS (Normalized to 0-100)
        # -------------------------------------------------------------
        
        # 1. Trend Quality Score
        trend_pts = 0
        trend_total = 0
        
        # SMA 200 Position (Continuous)
        if "SMA_200" in features_df.columns and pd.notnull(features_df["SMA_200"].iloc[-1]):
            sma_200 = float(features_df["SMA_200"].iloc[-1])
            if sma_200 > 0:
                sma_200_dist = (close - sma_200) / sma_200
                trend_pts += min(max((sma_200_dist + 0.05) / 0.10, 0.0), 1.0) * 20.0
                trend_total += 20
        
        # SMA 50 Position (Continuous)
        if "SMA_50" in features_df.columns and pd.notnull(features_df["SMA_50"].iloc[-1]):
            sma_50 = float(features_df["SMA_50"].iloc[-1])
            if sma_50 > 0:
                sma_50_dist = (close - sma_50) / sma_50
                trend_pts += min(max((sma_50_dist + 0.03) / 0.06, 0.0), 1.0) * 15.0
                trend_total += 15
                
        # Golden Cross (Continuous alignment check)
        if "SMA_50" in features_df.columns and "SMA_200" in features_df.columns:
            sma_50 = float(features_df["SMA_50"].iloc[-1])
            sma_200 = float(features_df["SMA_200"].iloc[-1])
            if pd.notnull(sma_50) and pd.notnull(sma_200) and sma_200 > 0:
                gc_dist = (sma_50 - sma_200) / sma_200
                trend_pts += min(max((gc_dist + 0.02) / 0.04, 0.0), 1.0) * 20.0
                trend_total += 20
                
        # Short Term EMA alignment (9 > 21) (Continuous)
        if "EMA_9" in features_df.columns and "EMA_21" in features_df.columns:
            ema_9 = float(features_df["EMA_9"].iloc[-1])
            ema_21 = float(features_df["EMA_21"].iloc[-1])
            if pd.notnull(ema_9) and pd.notnull(ema_21) and ema_21 > 0:
                ema_dist = (ema_9 - ema_21) / ema_21
                trend_pts += min(max((ema_dist + 0.015) / 0.03, 0.0), 1.0) * 15.0
                trend_total += 15
                
        # Trend Consistency (Slope & R-squared over 20 days) (Continuous)
        close_array = features_df["Close"].iloc[-20:].values
        slope_20d, r2_20d = calculate_slope_and_r2(close_array)
        slope_pts = 15.0 * (0.5 + 0.5 * r2_20d) if slope_20d > 0 else 15.0 * max(0.5 - 0.5 * r2_20d, 0.0)
        r2_pts = 15.0 * min(r2_20d / 0.5, 1.0) if slope_20d > 0 else 0.0
        trend_pts += (slope_pts + r2_pts)
        trend_total += 30
        
        trend_score = (trend_pts / trend_total * 100) if trend_total > 0 else 50.0

        # 2. Momentum Quality Score
        mom_pts = 0
        mom_total = 0
        
        # RSI Check (Continuous bell curve)
        rsi_col = [col for col in features_df.columns if col.startswith("RSI_")]
        if rsi_col and pd.notnull(features_df[rsi_col[0]].iloc[-1]):
            rsi = float(features_df[rsi_col[0]].iloc[-1])
            if rsi < 40.0:
                rsi_val_score = min(max((rsi - 30.0) / 10.0, 0.0), 1.0) * 10.0
            elif rsi < 55.0:
                rsi_val_score = 10.0 + ((rsi - 40.0) / 15.0) * 15.0
            elif rsi <= 70.0:
                rsi_val_score = 25.0
            else:
                rsi_val_score = max(25.0 - ((rsi - 70.0) / 15.0) * 10.0, 15.0)
            mom_pts += rsi_val_score
            mom_total += 25
            
            # RSI Slope over last 3 days
            if len(features_df) >= 3 and pd.notnull(features_df[rsi_col[0]].iloc[-3]):
                rsi_slope = float(features_df[rsi_col[0]].iloc[-1] - features_df[rsi_col[0]].iloc[-3])
                mom_pts += min(max((rsi_slope + 5.0) / 10.0, 0.0), 1.0) * 15.0
                mom_total += 15

        # MACD Check (Continuous distance and histogram slope)
        macd_col = [col for col in features_df.columns if col.startswith("MACD_") and not "Signal" in col and not "Hist" in col]
        macd_sig_col = [col for col in features_df.columns if col.startswith("MACD_Signal_")]
        macd_hist_col = [col for col in features_df.columns if col.startswith("MACD_Hist_")]
        if macd_col and macd_sig_col:
            macd = float(features_df[macd_col[0]].iloc[-1])
            sig = float(features_df[macd_sig_col[0]].iloc[-1])
            if pd.notnull(macd) and pd.notnull(sig):
                macd_dist_pct = ((macd - sig) / close) * 100.0
                mom_pts += min(max((macd_dist_pct + 0.5) / 1.0, 0.0), 1.0) * 20.0
                mom_total += 20
            
            if macd_hist_col and len(features_df) >= 2:
                hist = float(features_df[macd_hist_col[0]].iloc[-1])
                prev_hist = float(features_df[macd_hist_col[0]].iloc[-2])
                if pd.notnull(hist) and pd.notnull(prev_hist):
                    hist_change_pct = ((hist - prev_hist) / close) * 100.0
                    mom_pts += min(max((hist_change_pct + 0.1) / 0.2, 0.0), 1.0) * 15.0
                    mom_total += 15

        # Williams %R Check (Continuous)
        willr_col = [col for col in features_df.columns if col.startswith("WilliamsR_")]
        if willr_col and pd.notnull(features_df[willr_col[0]].iloc[-1]):
            willr = float(features_df[willr_col[0]].iloc[-1])
            mom_pts += min(max((willr + 90.0) / 80.0, 0.0), 1.0) * 15.0
            mom_total += 15

        # Stochastic RSI Check (Continuous)
        stoch_k = [col for col in features_df.columns if col.startswith("StochRSI_K_")]
        if stoch_k and pd.notnull(features_df[stoch_k[0]].iloc[-1]):
            k_val = float(features_df[stoch_k[0]].iloc[-1])
            mom_pts += min(max((k_val - 10.0) / 80.0, 0.0), 1.0) * 10.0
            mom_total += 10

        momentum_score = (mom_pts / mom_total * 100) if mom_total > 0 else 50.0

        # 3. Volume Intelligence Score
        vol_pts = 0
        vol_total = 0
        
        # Relative Volume (RVOL) (Continuous)
        vol_pts += min(max((vol_ratio - 0.5) / 1.0, 0.0), 1.0) * 30.0
        vol_total += 30
        
        # Chaikin Money Flow (CMF) (Continuous)
        cmf_col = [col for col in features_df.columns if col.startswith("CMF_")]
        if cmf_col and pd.notnull(features_df[cmf_col[0]].iloc[-1]):
            cmf = float(features_df[cmf_col[0]].iloc[-1])
            vol_pts += min(max((cmf + 0.15) / 0.30, 0.0), 1.0) * 30.0
            vol_total += 30

        # OBV slope over 5 days (Continuous via R-squared adjustment)
        if "OBV" in features_df.columns:
            obv_arr = features_df["OBV"].iloc[-5:].values
            obv_slope, obv_r2 = calculate_slope_and_r2(obv_arr)
            obv_factor = 0.5 + 0.5 * obv_r2 if obv_slope > 0 else max(0.5 - 0.5 * obv_r2, 0.0)
            vol_pts += 20.0 * obv_factor
            vol_total += 20

        # ADL trend direction (Continuous via R-squared adjustment)
        if "ADL" in features_df.columns:
            adl_arr = features_df["ADL"].iloc[-5:].values
            adl_slope, adl_r2 = calculate_slope_and_r2(adl_arr)
            adl_factor = 0.5 + 0.5 * adl_r2 if adl_slope > 0 else max(0.5 - 0.5 * adl_r2, 0.0)
            vol_pts += 20.0 * adl_factor
            vol_total += 20

        volume_score = (vol_pts / vol_total * 100) if vol_total > 0 else 50.0

        # 4. Pattern Quality Score
        pattern_score = 50.0  # Start neutral
        bull_candles = sum(1 for col in ["Hammer", "Bullish_Engulfing", "Morning_Star"] if col in features_df.columns and float(features_df[col].iloc[-1]) == 1)
        bear_candles = sum(1 for col in ["Shooting_Star", "Bearish_Engulfing", "Evening_Star"] if col in features_df.columns and float(features_df[col].iloc[-1]) == 1)
        
        pattern_score += (bull_candles * 15)
        pattern_score -= (bear_candles * 15)
        
        # Evaluate geometric patterns
        if detected_patterns:
            bull_patterns = [p for p in detected_patterns if p.pattern_direction == "BULLISH"]
            bear_patterns = [p for p in detected_patterns if p.pattern_direction == "BEARISH"]
            pattern_score += (len(bull_patterns) * 20)
            pattern_score -= (len(bear_patterns) * 20)
            
        pattern_score = min(max(pattern_score, 0.0), 100.0)

        # 5 & 6. Support & Resistance Scores
        support_score = 50.0
        resistance_score = 50.0
        
        if support_zones:
            # Distance from closest support midpoint
            s_midpoints = [(z.upper_bound + z.lower_bound)/2.0 for z in support_zones]
            s_distances = [abs(close - mid) / close for mid in s_midpoints]
            min_s_idx = np.argmin(s_distances)
            min_s_dist = s_distances[min_s_idx]
            closest_zone = support_zones[min_s_idx]
            
            # Score closer to support high (mean reversion zone)
            support_score = min(max((1.0 - (min_s_dist / 0.10)) * 70 + (closest_zone.touches * 6), 0.0), 100.0)
            
        if resistance_zones:
            r_midpoints = [(z.upper_bound + z.lower_bound)/2.0 for z in resistance_zones]
            r_distances = [(mid - close) / close for mid in r_midpoints]
            # Exclude negative distances (already broken out)
            pos_r_dists = [d for d in r_distances if d >= 0]
            if pos_r_dists:
                min_r_dist = min(pos_r_dists)
                min_r_idx = r_distances.index(min_r_dist)
                closest_zone = resistance_zones[min_r_idx]
                
                # Proportional score: target clearance of 6% to get max base score (80.0)
                # plus touches score (20 pts max, penalizing high touches resistance)
                clearance_factor = min(min_r_dist / 0.06, 1.0)
                base_score = clearance_factor * 80.0
                touches_score = max(20.0 - closest_zone.touches * 3.0, 0.0)
                resistance_score = min(max(base_score + touches_score, 0.0), 100.0)

        # 7. Volatility Score (Continuous)
        vola_pts = 0
        vola_total = 0
        
        # Annualized Volatility
        hist_vol_col = [col for col in features_df.columns if col.startswith("Hist_Vol_")]
        if hist_vol_col and pd.notnull(features_df[hist_vol_col[0]].iloc[-1]):
            hv = float(features_df[hist_vol_col[0]].iloc[-1])
            # Scale continuously: 15% (30 pts) to 45% (0 pts)
            vola_pts += min(max((45.0 - hv) / 30.0, 0.0), 1.0) * 30.0
            vola_total += 30
            
        # ATR Percentage
        atr_col = [col for col in features_df.columns if col.startswith("ATR_")]
        if atr_col and pd.notnull(features_df[atr_col[0]].iloc[-1]):
            atr = float(features_df[atr_col[0]].iloc[-1])
            atr_percent = (atr / close) * 100.0
            # Scale continuously: 1.0% (30 pts) to 5.0% (0 pts)
            vola_pts += min(max((5.0 - atr_percent) / 4.0, 0.0), 1.0) * 30.0
            vola_total += 30
            
        # Sharpe Ratio (20-day returns mean / return standard deviation)
        returns = features_df["Close"].pct_change().iloc[-20:].values
        std_ret = np.std(returns)
        mean_ret = np.mean(returns)
        sharpe = (mean_ret / std_ret) if std_ret > 0 else 0.0
        # Scale continuously: -0.1 (0 pts) to +0.1 (40 pts)
        vola_pts += min(max((sharpe + 0.1) / 0.2, 0.0), 1.0) * 40.0
        vola_total += 40
        
        volatility_score = (vola_pts / vola_total * 100) if vola_total > 0 else 50.0

        # 8. Relative Strength Score
        rs_rating = market_context.get("relative_strength_rating", 50.0)
        rs_score = rs_rating

        # 9. Market Context Score
        nifty_dir = market_context.get("nifty", {}).get("direction", "SIDEWAYS")
        nifty_str = market_context.get("nifty", {}).get("strength", 50.0)
        vix_regime = market_context.get("vix", {}).get("regime", "Normal")
        
        market_pts = 50.0
        if nifty_dir == "BULLISH":
            market_pts += nifty_str * 0.3
        elif nifty_dir == "BEARISH":
            market_pts -= nifty_str * 0.3
            
        if vix_regime == "Extreme":
            market_pts -= 20.0
        elif vix_regime == "Low":
            market_pts += 10.0
            
        market_score = min(max(market_pts, 0.0), 100.0)

        # -------------------------------------------------------------
        # LAYER 3: MARKET REGIME CLASSIFICATION
        # -------------------------------------------------------------
        adx_val = market_context.get("nifty", {}).get("strength", 20.0)
        vix_val = float(market_context.get("vix", {}).get("vix_value", 15.0))
        
        if vix_val >= self.buy_threshold / 4.0 or vix_regime in ["Extreme", "Elevated"]:
            regime = "volatile"
        elif adx_val < 22.0 or nifty_dir == "SIDEWAYS":
            regime = "rangebound"
        else:
            regime = "trending"

        # Apply Dynamic Weight Profiles
        weights = self.regime_weights[regime]

        # -------------------------------------------------------------
        # LAYER 4: SIGNAL AGREEMENT ENGINE (Calculate Confidence Score)
        # -------------------------------------------------------------
        bullish_signals = 0
        bearish_signals = 0
        
        # Evaluate 5 primary indicator classes
        categories = {
            "trend": trend_score,
            "momentum": momentum_score,
            "volume": volume_score,
            "patterns": pattern_score,
            "relative_strength": rs_score
        }
        
        for name_cat, score_cat in categories.items():
            if score_cat > 62.0:
                bullish_signals += 1
            elif score_cat < 38.0:
                bearish_signals += 1

        # Consensus score (0-100)
        total_signals = bullish_signals + bearish_signals
        if total_signals == 0:
            agreement_factor = 50.0
        else:
            agreement_factor = (abs(bullish_signals - bearish_signals) / total_signals) * 100.0

        # Volatility regime discount
        vix_discount = 15.0 if vix_regime == "Extreme" else (5.0 if vix_regime == "Elevated" else 0.0)
        
        # Conflicting signals penalty
        conflict_penalty = 20.0 if (bullish_signals >= 2 and bearish_signals >= 2) else 0.0
        
        confidence_score = round(min(max(agreement_factor + 30.0 - vix_discount - conflict_penalty, 10.0), 100.0), 2)

        # -------------------------------------------------------------
        # LAYER 5: RISK ADJUSTMENTS (Combine to Overall Technical Score)
        # -------------------------------------------------------------
        # Calculate Weighted Raw score
        overall_score = (
            trend_score * weights["trend"] +
            momentum_score * weights["momentum"] +
            volume_score * weights["volume"] +
            pattern_score * weights["patterns"] +
            support_score * weights["support"] +
            resistance_score * weights["resistance"] +
            volatility_score * weights["volatility"] +
            rs_score * weights["relative_strength"]
        )
        
        # Penalties: beta volatility, high stress VIX, low relative volume (smoothed & non-overlapping)
        risk_penalty = 0.0
        beta_penalty = 0.0
        rvol_penalty = 0.0
        vix_penalty = 0.0
        
        if stockBeta > 1.20:
            # Scale continuously: 0 penalty at 1.20 up to 5.0 penalty at 1.45+
            beta_penalty = min((stockBeta - 1.20) * 20.0, 5.0)
            risk_penalty += beta_penalty
            neg_factors.append(f"High systematic volatility (Beta: {stockBeta:.2f}) adds portfolio drag")
            
        if vix_val > 18.0:
            # Scale continuously: 0 penalty at 18.0 up to 8.0 penalty at 38.0+
            vix_penalty = min((vix_val - 18.0) * 0.4, 8.0)
            risk_penalty += vix_penalty
            neg_factors.append("High index volatility regime warrants strict stop levels")
            
        if vol_ratio < 0.8:
            # Scale continuously: 0 penalty at 0.8 down to 4.0 penalty at 0.4-
            rvol_penalty = min((0.8 - vol_ratio) * 10.0, 4.0)
            risk_penalty += rvol_penalty
            neg_factors.append("Low relative volume shows weak breakout validation")

        adjusted_score = round(min(max(overall_score - risk_penalty, 0.0), 100.0), 2)

        # -------------------------------------------------------------
        # LAYER 6: DECISION ENGINE (Separated from scoring)
        # -------------------------------------------------------------
        if adjusted_score >= self.buy_threshold and confidence_score >= 50.0:
            recommendation = "BUY"
        elif adjusted_score >= self.watch_threshold:
            recommendation = "WATCH"
        else:
            recommendation = "AVOID"

        # -------------------------------------------------------------
        # LAYER 7: FEATURE IMPORTANCE & EXPLAINABILITY METADATA
        # -------------------------------------------------------------
        if trend_score > 65.0:
            pos_factors.append(f"Solid uptrend structure (Trend: {trend_score:.0f}/100) supported by moving averages")
        elif trend_score < 35.0:
            neg_factors.append(f"Primary downtrend channel active (Trend: {trend_score:.0f}/100)")
            
        if momentum_score > 60.0:
            pos_factors.append(f"Bullish momentum momentum acceleration (Score: {momentum_score:.0f}/100)")
        elif momentum_score < 40.0:
            neg_factors.append(f"Momentum deceleration (Score: {momentum_score:.0f}/100)")

        if volume_score > 60.0:
            pos_factors.append(f"Institutional accumulation patterns verified on volume nodes (Score: {volume_score:.0f}/100)")
            
        if rs_score > 70.0:
            pos_factors.append(f"Consistent relative strength rating outperformance ({rs_score:.0f}/100) vs Nifty 50")

        # Map to final output components
        scores = TechnicalScores(
            trend=ScoreComponent(value=trend_score, weight=weights["trend"], contribution=round(trend_score * weights["trend"], 2)),
            momentum=ScoreComponent(value=momentum_score, weight=weights["momentum"], contribution=round(momentum_score * weights["momentum"], 2)),
            volume=ScoreComponent(value=volume_score, weight=weights["volume"], contribution=round(volume_score * weights["volume"], 2)),
            volatility=ScoreComponent(value=volatility_score, weight=weights["volatility"], contribution=round(volatility_score * weights["volatility"], 2)),
            pattern=ScoreComponent(value=pattern_score, weight=weights["patterns"], contribution=round(pattern_score * weights["patterns"], 2)),
            support=ScoreComponent(value=support_score, weight=weights["support"], contribution=round(support_score * weights["support"], 2)),
            resistance=ScoreComponent(value=resistance_score, weight=weights["resistance"], contribution=round(resistance_score * weights["resistance"], 2)),
            market=ScoreComponent(value=market_score, weight=0.0, contribution=0.0),
            sector=ScoreComponent(value=rs_score, weight=weights["relative_strength"], contribution=round(rs_score * weights["relative_strength"], 2)),
            risk=ScoreComponent(value=adjusted_score, weight=0.0, contribution=0.0),
            overall_score=adjusted_score,
            confidence=confidence_score,
            recommendation=recommendation
        )

        # Risk level classification
        atr_percent = (float(features_df[atr_col[0]].iloc[-1]) / close) * 100.0 if atr_col else 2.0
        risk_val = (atr_percent * 8.0) + (hv * 0.7) + (vix_val * 0.7) - min(vol_ratio * 2.0, 10.0)
        if risk_val < 30.0:
            risk_level = "Low"
        elif risk_val < 50.0:
            risk_level = "Moderate"
        elif risk_val < 75.0:
            risk_level = "High"
        else:
            risk_level = "Very High"

        risk_profile = RiskProfile(
            level=risk_level,
            atr_percentage=round(atr_percent, 2) if atr_col else 2.0,
            annualized_volatility=round(hv, 2) if hist_vol_col else 20.0,
            vix_regime=vix_regime,
            liquidity_score=round(min(vol_ratio * 40.0, 100.0), 2)
        )

        # Save explainability and backtesting metrics in features store/metadata dictionary
        explainability_meta = {
            "regime": regime,
            "signal_agreement": {
                "bullish_signals": bullish_signals,
                "bearish_signals": bearish_signals,
                "confidence_score": confidence_score
            },
            "applied_weights": weights,
            "risk_penalties": {
                "beta_penalty": round(beta_penalty, 2),
                "resistance_penalty": 0.0,
                "vix_penalty": round(vix_penalty, 2),
                "rvol_penalty": round(rvol_penalty, 2),
                "total_penalty": round(risk_penalty, 2)
            }
        }
        
        self._reasoning_context = explainability_meta

        return scores, risk_profile, pos_factors, neg_factors, neu_factors
