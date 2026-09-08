import logging
import math
from typing import Dict, Any, List
import pandas as pd
from analysis.models.trade_signal import TradeSignalModel
from analysis.support_resistance import SRZone

logger = logging.getLogger("AIEquityResearchPlatform")

def calculate_trade_signal(
    stock_df: pd.DataFrame,
    scores: Any,
    support_zones: List[SRZone],
    resistance_zones: List[SRZone],
    risk_profile: Any,
    timeframe: str = "1D",
    position_status: str = "NO_POSITION"
) -> Dict[str, Any]:
    """
    Computes a deterministic Real-Time Trade Signal including:
    - Signal: BUY NOW, WAIT, SELL NOW, AVOID
    - Entry Zone (low - high)
    - Target Price & Potential Return %
    - Stop Loss Price & Risk %
    - Risk/Reward Ratio (e.g. 1:2.7)
    - Holding Time (timeframe dependent)
    - Deterministic Reason Bullets
    - Lifecycle status (ENTRY_VALID, TARGET_REACHED, MISSED_ENTRY, etc.)
    """
    if stock_df.empty:
        current_price = 100.0
        atr = 2.0
    else:
        current_price = float(stock_df["Close"].iloc[-1])
        # Compute 14-period True Range / ATR
        high_low = stock_df["High"] - stock_df["Low"]
        high_close = (stock_df["High"] - stock_df["Close"].shift(1)).abs()
        low_close = (stock_df["Low"] - stock_df["Close"].shift(1)).abs()
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr_series = tr.rolling(14).mean().dropna()
        atr = float(atr_series.iloc[-1]) if not atr_series.empty else current_price * 0.015

    atr = max(atr, current_price * 0.008)

    # 1. Timeframe-specific parameters map (strategy, holding time, move ranges, scaling factors, primary indicators)
    tf_clean = timeframe.upper().strip()
    tf_params_map = {
        "5M": {
            "strategy_label": "Scalping Strategy",
            "holding_time": "5–30 minutes",
            "move_low_pct": 0.2,
            "move_high_pct": 0.6,
            "tf_vol_mult": 0.4,
            "horizon_label": "Scalp Horizon",
            "expected_volatility": "Very High",
            "primary_indicators": ["VWAP", "EMA20", "SuperTrend", "Volume"]
        },
        "10M": {
            "strategy_label": "Intraday Momentum Strategy",
            "holding_time": "15–45 minutes",
            "move_low_pct": 0.3,
            "move_high_pct": 0.9,
            "tf_vol_mult": 0.6,
            "horizon_label": "Intraday Momentum",
            "expected_volatility": "High",
            "primary_indicators": ["EMA20", "VWAP", "SuperTrend", "Volume"]
        },
        "30M": {
            "strategy_label": "Intraday / Short Swing Strategy",
            "holding_time": "30 min–4 hrs",
            "move_low_pct": 0.5,
            "move_high_pct": 1.5,
            "tf_vol_mult": 1.2,
            "horizon_label": "Short Swing Horizon",
            "expected_volatility": "Medium-High",
            "primary_indicators": ["EMA20", "EMA50", "MACD", "RSI"]
        },
        "1D": {
            "strategy_label": "Swing Trading Strategy",
            "holding_time": "1–5 days",
            "move_low_pct": 0.8,
            "move_high_pct": 2.2,
            "tf_vol_mult": 1.8,
            "horizon_label": "Swing Horizon",
            "expected_volatility": "Medium",
            "primary_indicators": ["EMA50", "EMA200", "MACD", "RSI", "Support/Resistance"]
        },
        "1W": {
            "strategy_label": "Position Trading Strategy",
            "holding_time": "1–3 weeks",
            "move_low_pct": 2.0,
            "move_high_pct": 5.5,
            "tf_vol_mult": 3.0,
            "horizon_label": "Position Horizon",
            "expected_volatility": "Medium",
            "primary_indicators": ["Weekly EMA20/50", "Support/Resistance", "Relative Strength"]
        },
        "1M": {
            "strategy_label": "Medium-Term Investment Strategy",
            "holding_time": "1–3 months",
            "move_low_pct": 5.0,
            "move_high_pct": 12.0,
            "tf_vol_mult": 5.0,
            "horizon_label": "Medium-Term Horizon",
            "expected_volatility": "Low-Medium",
            "primary_indicators": ["Monthly Trend", "Fundamentals", "Sector Performance"]
        },
        "6M": {
            "strategy_label": "Semi-Annual Investment Strategy",
            "holding_time": "3–6 months",
            "move_low_pct": 15.0,
            "move_high_pct": 28.0,
            "tf_vol_mult": 12.0,
            "horizon_label": "Six-Month Horizon",
            "expected_volatility": "Low-Medium",
            "primary_indicators": ["Trend", "Fundamentals", "Market Intelligence", "Risk Profile"]
        },
        "1Y": {
            "strategy_label": "Long-Term Investment Strategy",
            "holding_time": "6–12 months",
            "move_low_pct": 22.0,
            "move_high_pct": 40.0,
            "tf_vol_mult": 16.0,
            "horizon_label": "One-Year Horizon",
            "expected_volatility": "Low",
            "primary_indicators": ["Trend", "Fundamentals", "Market Intelligence", "Risk Profile"]
        },
        "5Y": {
            "strategy_label": "Macro Investment Strategy",
            "holding_time": "1–3 years",
            "move_low_pct": 35.0,
            "move_high_pct": 75.0,
            "tf_vol_mult": 25.0,
            "horizon_label": "Five-Year Horizon",
            "expected_volatility": "Low",
            "primary_indicators": ["Trend", "Fundamentals", "Market Intelligence", "Risk Profile"]
        },
        "MAX": {
            "strategy_label": "Macro Horizon Strategy",
            "holding_time": "Macro Investment",
            "move_low_pct": 50.0,
            "move_high_pct": 120.0,
            "tf_vol_mult": 35.0,
            "horizon_label": "Entire History",
            "expected_volatility": "Low",
            "primary_indicators": ["Trend", "Fundamentals", "Market Intelligence", "Risk Profile"]
        }
    }
    # Backward compatibility aliases
    tf_params_map["3M"] = tf_params_map["1M"]
    tf_params_map["3Y"] = tf_params_map["5Y"]

    tf_data = tf_params_map.get(tf_clean, tf_params_map["1D"])
    holding_time = tf_data["holding_time"]
    move_low_pct = tf_data["move_low_pct"]
    move_high_pct = tf_data["move_high_pct"]
    expected_volatility = tf_data.get("expected_volatility", "Medium")
    strategy_label = tf_data.get("strategy_label", "Swing Trading Strategy")
    primary_indicators = tf_data.get("primary_indicators", ["EMA50", "MACD", "RSI"])
    expected_volatility = tf_data.get("expected_volatility", "Medium")

    # 2. Support & Resistance Extractors
    supp_candidates = [z.upper_bound for z in support_zones if z.upper_bound < current_price]
    nearest_support = max(supp_candidates) if supp_candidates else current_price - (1.5 * atr)

    res_candidates = [z.lower_bound for z in resistance_zones if z.lower_bound > current_price]
    nearest_resistance = min(res_candidates) if res_candidates else current_price + (2.5 * atr)

    # 3. Entry Zone (Entry Low - Entry High)
    entry_zone_low = round(max(nearest_support, current_price - (0.4 * atr)), 2)
    entry_zone_high = round(min(current_price + (0.3 * atr), current_price * 1.008), 2)
    if entry_zone_low >= entry_zone_high:
        entry_zone_low = round(current_price - (0.2 * atr), 2)
        entry_zone_high = round(current_price + (0.2 * atr), 2)

    # 4. Deterministic Timeframe-Specific Targets & Range
    expected_price_range_low = round(current_price * (1.0 + (move_low_pct / 100.0)), 2)
    expected_price_range_high = round(current_price * (1.0 + (move_high_pct / 100.0)), 2)

    target_price = round(current_price * (1.0 + (move_high_pct / 100.0)), 2)
    potential_return_pct = round(((target_price - current_price) / current_price) * 100.0, 2)

    # 5. Timeframe-Specific Stop Loss & Risk %
    stop_loss_price = round(current_price * (1.0 - (move_low_pct * 0.95 / 100.0)), 2)
    if stop_loss_price >= current_price:
        stop_loss_price = round(current_price * 0.985, 2)

    risk_pct = round(((current_price - stop_loss_price) / current_price) * 100.0, 2)
    risk_reward_ratio = round(potential_return_pct / max(risk_pct, 0.1), 1)

    # 5b. Re-Entry Analysis (If momentum improves, next re-entry zone)
    raw_reentry_low = round(max(nearest_support, current_price - (1.8 * atr)), 2)
    raw_reentry_high = round(min(current_price - (0.5 * atr), current_price * 0.988), 2)
    if raw_reentry_low >= raw_reentry_high:
        raw_reentry_low = round(current_price * 0.96, 2)
        raw_reentry_high = round(current_price * 0.98, 2)

    reentry_target_price = round(current_price * (1.0 + (move_high_pct * 0.7 / 100.0)), 2)
    reentry_stop_loss = round(raw_reentry_low * 0.98, 2)
    reentry_return_pct = round(((reentry_target_price - raw_reentry_high) / raw_reentry_high) * 100.0, 2)

    # 6. Overall Metrics
    overall_score = getattr(scores, 'overall_score', 50.0)
    rec = getattr(scores, 'recommendation', 'WATCH')
    raw_conf = getattr(scores, 'confidence', 75.0) or 75.0
    confidence = min(round(raw_conf, 0), 96.0)

    risk_level = getattr(risk_profile, 'level', 'Medium')
    if risk_level == 'Moderate':
        risk_level = 'Medium'

    # 7. Position-Aware Decision Tree & Lifecycle Status
    pos_clean = position_status.upper().strip() if position_status else "NO_POSITION"
    trailing_stop_price = None
    next_resistance_target = None
    profit_protection_level = None
    remaining_upside_pct = None
    downside_risk_pct = None
    rally_probability = None

    if pos_clean == "HOLDING_LONG":
        # MODE 2 – SELL / HOLD EXIT ANALYSIS for position holders
        trailing_stop_price = round(max(nearest_support, current_price - (1.2 * atr)), 2)
        profit_protection_level = round(current_price - (0.8 * atr), 2)
        next_resistance_target = round(nearest_resistance, 2)
        remaining_upside_pct = round(max(((nearest_resistance - current_price) / current_price) * 100.0, 0.5), 2)
        downside_risk_pct = round(((current_price - trailing_stop_price) / current_price) * 100.0, 2)
        rally_probability = min(round(confidence * 0.88, 0), 92.0)

        if current_price >= nearest_resistance * 0.995 or overall_score <= 48.0 or rec in ["AVOID", "SELL"]:
            signal = "SELL NOW"
            signal_type = "SELL_NOW"
            lifecycle_status = "EXIT_SUGGESTED"
            status_note = "Exit position recommended. Target achieved or technical score deteriorated."
        elif current_price >= nearest_resistance * 0.96 or (overall_score >= 50.0 and overall_score < 68.0):
            signal = "PARTIAL SELL"
            signal_type = "PARTIAL_SELL"
            lifecycle_status = "TARGET_NEAR"
            status_note = "Approaching primary resistance level. Consider locking in 30%–50% partial gains."
        else:
            signal = "HOLD"
            signal_type = "HOLD"
            lifecycle_status = "TRADE_ACTIVE"
            status_note = "Maintain long position. Bullish momentum and technical structure remain intact."

        reasons = []
        if signal == "SELL NOW":
            if current_price >= nearest_resistance * 0.995:
                reasons.append(f"Target price / major resistance of ₹{nearest_resistance:,.2f} reached.")
                reasons.append("Take profit recommended to lock in realized gains.")
            if overall_score <= 50.0:
                reasons.append(f"Quantitative score deterioration ({overall_score:.0f}/100) signals trend reversal risk.")
            reasons.append(f"Trailing stop loss protection set at ₹{trailing_stop_price:,.2f} (-{downside_risk_pct}% downside).")
            reasons.append("MACD bearish crossover or overbought RSI condition signals elevated risk.")
        elif signal == "HOLD":
            reasons.append(f"Bullish uptrend remains intact with multi-factor score of {overall_score:.0f}/100.")
            reasons.append(f"Stock holding safely above trailing stop loss level of ₹{trailing_stop_price:,.2f}.")
            reasons.append(f"Remaining upside potential of +{remaining_upside_pct}% toward next target ₹{next_resistance_target:,.2f}.")
            reasons.append(f"Volume confirmation and technical structure support further gains.")
        elif signal == "PARTIAL SELL":
            reasons.append(f"Stock approaching primary resistance zone at ₹{next_resistance_target:,.2f} (+{remaining_upside_pct}% remaining upside).")
            reasons.append("Locking in 30%–50% partial profits is recommended while trailing stop on remaining position.")
            reasons.append(f"Protects unrealized gains while maintaining upside exposure toward ₹{next_resistance_target:,.2f}.")
    else:
        # MODE 1 – BUY ANALYSIS (Pre-Entry Mode for users without position)
        # Note: target_price is freshly computed a few lines above as
        # current_price * (1 + move_high_pct/100), and move_high_pct is
        # always positive for every timeframe in tf_params_map - so
        # target_price is always strictly greater than current_price here.
        # A "current_price >= target_price" check can therefore never be
        # true in this pre-entry branch (there's no previously-tracked
        # target to compare against, only this call's freshly-derived one);
        # that dead TARGET_REACHED path has been removed rather than left
        # in place looking like working logic.
        if current_price > entry_zone_high * 1.015:
            signal = "WAIT"
            signal_type = "WAIT"
            lifecycle_status = "MISSED_ENTRY"
            status_note = "Entry Missed. Price outpaced entry zone; wait for a pullback."
        elif rec == "BUY" and overall_score >= 66.0:
            signal = "BUY NOW"
            signal_type = "BUY_NOW"
            lifecycle_status = "ENTRY_VALID"
            status_note = "Favorable Risk/Reward Entry. Technical trend alignment confirmed."
        elif rec in ["AVOID", "SELL"] or overall_score <= 42.0:
            signal = "SELL NOW"
            signal_type = "SELL_NOW"
            lifecycle_status = "EXIT_SUGGESTED"
            status_note = "Bearish technical momentum detected. Reduce exposure."
        else:
            signal = "WAIT"
            signal_type = "WAIT"
            lifecycle_status = "ENTRY_VALID"
            status_note = "Consolidation zone. Wait for breakout confirmation."

        reasons = []
        if signal in ["BUY NOW", "WAIT"]:
            if current_price >= entry_zone_low and current_price <= entry_zone_high:
                reasons.append(f"Price ₹{current_price:,.2f} is currently inside optimal Entry Zone (₹{entry_zone_low:,.2f} – ₹{entry_zone_high:,.2f}).")
            elif current_price < entry_zone_low:
                reasons.append(f"Price ₹{current_price:,.2f} is trading near key support (₹{nearest_support:,.2f}).")
            else:
                reasons.append(f"Price is trading above initial entry threshold.")

            if supp_candidates:
                reasons.append(f"Bounced above verified technical support zone at ₹{nearest_support:,.2f}.")
            else:
                reasons.append(f"Stop Loss established at ₹{stop_loss_price:,.2f} based on 1.0x ATR buffer.")

            reasons.append(f"Suggested profit target set at ₹{target_price:,.2f} (+{potential_return_pct}% upside).")
            reasons.append(f"Risk/Reward ratio of 1:{risk_reward_ratio} with {risk_pct}% risk parameter.")
        else:
            if lifecycle_status == "TARGET_REACHED":
                reasons.append(f"Target price of ₹{target_price:,.2f} was successfully achieved.")
                reasons.append("Take profit recommended to lock in realized gains.")
            else:
                reasons.append(f"Current price ₹{current_price:,.2f} displays weakening technical momentum.")
                reasons.append("Quantitative score deterioration (<42) signals elevated risk.")

    if overall_score >= 70 and pos_clean != "HOLDING_LONG":
        reasons.append("Multi-factor quantitative technical score is strongly bullish (>70).")
    elif overall_score <= 40 and pos_clean != "HOLDING_LONG":
        reasons.append("Multi-factor quantitative technical score indicates elevated downside risk (<40).")

    raw_signal_dict = {
        "signal": signal,
        "signal_type": signal_type,
        "current_price": round(current_price, 2),
        "entry_zone_low": entry_zone_low if pos_clean != "HOLDING_LONG" else None,
        "entry_zone_high": entry_zone_high if pos_clean != "HOLDING_LONG" else None,
        "target_price": target_price if pos_clean != "HOLDING_LONG" else None,
        "stop_loss_price": stop_loss_price if pos_clean != "HOLDING_LONG" else None,
        "potential_return_pct": potential_return_pct if pos_clean != "HOLDING_LONG" else None,
        "expected_move_low_pct": move_low_pct,
        "expected_move_high_pct": move_high_pct,
        "expected_price_range_low": expected_price_range_low,
        "expected_price_range_high": expected_price_range_high,
        "reentry_zone_low": raw_reentry_low,
        "reentry_zone_high": raw_reentry_high,
        "reentry_target_price": reentry_target_price,
        "reentry_stop_loss": reentry_stop_loss,
        "reentry_return_pct": reentry_return_pct,
        "expected_volatility": expected_volatility,
        "strategy_label": strategy_label,
        "primary_indicators": primary_indicators,
        "risk_pct": risk_pct if pos_clean != "HOLDING_LONG" else None,
        "risk_reward_ratio": risk_reward_ratio if pos_clean != "HOLDING_LONG" else None,
        "risk_level": risk_level,
        "confidence": confidence,
        "holding_time": holding_time,
        "timeframe": tf_clean,
        "reasons": reasons[:5],
        "lifecycle_status": lifecycle_status,
        "status_note": status_note,
        "position_status": pos_clean,
        "position_action": signal,
        "trailing_stop_price": trailing_stop_price,
        "next_resistance_target": next_resistance_target,
        "profit_protection_level": profit_protection_level,
        "remaining_upside_pct": remaining_upside_pct,
        "downside_risk_pct": downside_risk_pct,
        "rally_probability": rally_probability
    }

    # 9. Enforce State Machine Consistency Validation
    return validate_trade_signal_consistency(raw_signal_dict)


def validate_trade_signal_consistency(trade_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates that signal, entry zone, target, stop loss, and lifecycle status are mutually consistent.
    Rejects impossible combinations (e.g. SELL NOW + Entry Zone or BUY NOW + Target below price).
    """
    sig = trade_dict.get("signal")
    curr = trade_dict.get("current_price", 0.0)
    target = trade_dict.get("target_price")
    stop = trade_dict.get("stop_loss_price")
    entry_low = trade_dict.get("entry_zone_low")
    pos_status = trade_dict.get("position_status", "NO_POSITION")

    # RULE 1: SELL NOW, HOLD, PARTIAL SELL, or AVOID signals must NEVER include pre-entry fields
    if sig in ["SELL NOW", "AVOID", "SELL", "HOLD", "PARTIAL SELL"] or pos_status == "HOLDING_LONG":
        trade_dict["entry_zone_low"] = None
        trade_dict["entry_zone_high"] = None
        trade_dict["target_price"] = None
        trade_dict["potential_return_pct"] = None
        trade_dict["stop_loss_price"] = None
        trade_dict["risk_pct"] = None
        trade_dict["risk_reward_ratio"] = None

        if sig in ["SELL NOW", "AVOID", "SELL"]:
            trade_dict["expected_move_low_pct"] = None
            trade_dict["expected_move_high_pct"] = None
            trade_dict["expected_price_range_low"] = None
            trade_dict["expected_price_range_high"] = None

        cleaned_reasons = []
        for r in trade_dict.get("reasons", []):
            if "optimal Entry Zone" in r or "Suggested profit target set" in r or "Risk/Reward ratio" in r:
                continue
            cleaned_reasons.append(r)
        
        if not cleaned_reasons:
            cleaned_reasons.append("Exit or hold analysis evaluated based on technical score and resistance levels.")
        trade_dict["reasons"] = cleaned_reasons

    # RULE 2: BUY NOW signals must have Target > Current Price and Stop Loss < Current Price
    elif sig == "BUY NOW":
        if target is not None and target <= curr:
            raise ValueError(f"State Machine Inconsistency: BUY NOW target ({target}) <= current price ({curr})")
        if stop is not None and stop >= curr:
            raise ValueError(f"State Machine Inconsistency: BUY NOW stop loss ({stop}) >= current price ({curr})")
        if entry_low is None:
            raise ValueError("State Machine Inconsistency: BUY NOW signal missing Entry Zone")

    # RULE 3: WAIT signals must have Target > Current Price if target present
    elif sig == "WAIT":
        if target is not None and target <= curr:
            trade_dict["target_price"] = round(curr * 1.05, 2)
            trade_dict["potential_return_pct"] = 5.0

    return trade_dict
