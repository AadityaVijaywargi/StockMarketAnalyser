import logging
import numpy as np
import pandas as pd
from typing import List, Dict, Any
from analysis.models.patterns import PatternDetection
from analysis.support_resistance import find_pivots
from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

# Thresholds loaded from settings with safe fallbacks
TOLERANCE = settings.INDICATOR_PERIODS.get("pattern_tolerance", 0.02)
BREAKOUT_VOL_RATIO = settings.INDICATOR_PERIODS.get("breakout_volume_ratio", 1.5)
MIN_FLAGPOLE_PCT = settings.INDICATOR_PERIODS.get("min_flagpole_pct", 0.08)


def detect_trend_structure(df: pd.DataFrame, pivot_highs: List[dict], pivot_lows: List[dict]) -> List[PatternDetection]:
    """
    Detects Higher Highs (HH), Higher Lows (HL), Lower Highs (LH), and Lower Lows (LL) structures.
    """
    detections = []
    
    # 1. Higher High / Lower High
    if len(pivot_highs) >= 2:
        last_h = pivot_highs[-1]
        prev_h = pivot_highs[-2]
        
        is_higher = last_h["price"] > prev_h["price"]
        name = "Higher High" if is_higher else "Lower High"
        direction = "BULLISH" if is_higher else "BEARISH"
        
        # Confidence formula: based on difference magnitude relative to average price
        avg_price = (last_h["price"] + prev_h["price"]) / 2.0
        diff_pct = abs(last_h["price"] - prev_h["price"]) / avg_price
        # Scale confidence between 0.5 and 1.0 based on how clear the pivot difference is
        confidence = min(0.5 + (diff_pct / 0.05), 1.0)
        
        detections.append(PatternDetection(
            pattern_name=name,
            start_date=prev_h["date"],
            end_date=last_h["date"],
            confidence_score=round(confidence, 2),
            supporting_evidence={"prev_price": prev_h["price"], "curr_price": last_h["price"], "diff_pct": round(diff_pct, 4)},
            key_price_levels=[prev_h["price"], last_h["price"]],
            pattern_direction=direction,
            pattern_status="Confirmed"
        ))

    # 2. Higher Low / Lower Low
    if len(pivot_lows) >= 2:
        last_l = pivot_lows[-1]
        prev_l = pivot_lows[-2]
        
        is_higher = last_l["price"] > prev_l["price"]
        name = "Higher Low" if is_higher else "Lower Low"
        direction = "BULLISH" if is_higher else "BEARISH"
        
        avg_price = (last_l["price"] + prev_l["price"]) / 2.0
        diff_pct = abs(last_l["price"] - prev_l["price"]) / avg_price
        confidence = min(0.5 + (diff_pct / 0.05), 1.0)
        
        detections.append(PatternDetection(
            pattern_name=name,
            start_date=prev_l["date"],
            end_date=last_l["date"],
            confidence_score=round(confidence, 2),
            supporting_evidence={"prev_price": prev_l["price"], "curr_price": last_l["price"], "diff_pct": round(diff_pct, 4)},
            key_price_levels=[prev_l["price"], last_l["price"]],
            pattern_direction=direction,
            pattern_status="Confirmed"
        ))
        
    return detections


def detect_double_top_bottom(df: pd.DataFrame, pivot_highs: List[dict], pivot_lows: List[dict]) -> List[PatternDetection]:
    """
    Detects Double Top (reversal bearish) and Double Bottom (reversal bullish).
    Confidence scoring formula:
        Shape symmetry (differences in peaks) + Volume breakout validation
        Symmetry Score = 1.0 - (abs(Peak1 - Peak2) / Peak1) / TOLERANCE
        Volume Score = min(Current_Volume / Avg_Volume, 2.0) / 2.0
        Total Confidence = 0.7 * Symmetry + 0.3 * Volume
    """
    detections = []
    current_close = float(df["Close"].iloc[-1])
    current_vol = float(df["Volume"].iloc[-1])
    avg_vol = float(df["Volume"].rolling(20).mean().iloc[-1])
    
    # 1. Double Top (Requires at least 2 highs and 1 intervening low valley)
    if len(pivot_highs) >= 2 and len(pivot_lows) >= 1:
        h1, h2 = pivot_highs[-2], pivot_highs[-1]
        # Intervening low (valley/neckline)
        valleys = [l for l in pivot_lows if h1["index"] < l["index"] < h2["index"]]
        
        if valleys:
            neckline = min([v["price"] for v in valleys])
            price_diff = abs(h1["price"] - h2["price"]) / h1["price"]
            
            # Check if peaks are nearly equal
            if price_diff <= TOLERANCE:
                # Determine status
                if current_close < neckline:
                    status = "Confirmed"
                elif current_close > max(h1["price"], h2["price"]):
                    status = "Invalidated"
                else:
                    status = "Forming"
                    
                # Confidence calculations
                symmetry = max(0.0, 1.0 - (price_diff / TOLERANCE))
                vol_ratio = current_vol / avg_vol if avg_vol > 0 else 1.0
                vol_score = min(vol_ratio / BREAKOUT_VOL_RATIO, 1.0)
                
                # Weighted confidence formula
                confidence = 0.7 * symmetry + 0.3 * vol_score
                
                detections.append(PatternDetection(
                    pattern_name="Double Top",
                    start_date=h1["date"],
                    end_date=h2["date"],
                    confidence_score=round(max(0.3, confidence), 2),
                    supporting_evidence={
                        "peak1": h1["price"],
                        "peak2": h2["price"],
                        "neckline": neckline,
                        "breakout_volume_ratio": round(vol_ratio, 2)
                    },
                    key_price_levels=[h1["price"], h2["price"], neckline],
                    pattern_direction="BEARISH",
                    pattern_status=status
                ))

    # 2. Double Bottom
    if len(pivot_lows) >= 2 and len(pivot_highs) >= 1:
        l1, l2 = pivot_lows[-2], pivot_lows[-1]
        peaks = [h for h in pivot_highs if l1["index"] < h["index"] < l2["index"]]
        
        if peaks:
            neckline = max([p["price"] for p in peaks])
            price_diff = abs(l1["price"] - l2["price"]) / l1["price"]
            
            if price_diff <= TOLERANCE:
                if current_close > neckline:
                    status = "Confirmed"
                elif current_close < min(l1["price"], l2["price"]):
                    status = "Invalidated"
                else:
                    status = "Forming"
                    
                symmetry = max(0.0, 1.0 - (price_diff / TOLERANCE))
                vol_ratio = current_vol / avg_vol if avg_vol > 0 else 1.0
                vol_score = min(vol_ratio / BREAKOUT_VOL_RATIO, 1.0)
                
                confidence = 0.7 * symmetry + 0.3 * vol_score
                
                detections.append(PatternDetection(
                    pattern_name="Double Bottom",
                    start_date=l1["date"],
                    end_date=l2["date"],
                    confidence_score=round(max(0.3, confidence), 2),
                    supporting_evidence={
                        "trough1": l1["price"],
                        "trough2": l2["price"],
                        "neckline": neckline,
                        "breakout_volume_ratio": round(vol_ratio, 2)
                    },
                    key_price_levels=[l1["price"], l2["price"], neckline],
                    pattern_direction="BULLISH",
                    pattern_status=status
                ))
                
    return detections


def detect_triple_top_bottom(df: pd.DataFrame, pivot_highs: List[dict], pivot_lows: List[dict]) -> List[PatternDetection]:
    """
    Detects Triple Top and Triple Bottom.
    Confidence formula:
        Symmetry between 3 peaks/troughs + Volume ratio
    """
    detections = []
    current_close = float(df["Close"].iloc[-1])
    current_vol = float(df["Volume"].iloc[-1])
    avg_vol = float(df["Volume"].rolling(20).mean().iloc[-1])
    
    # 1. Triple Top
    if len(pivot_highs) >= 3 and len(pivot_lows) >= 2:
        h1, h2, h3 = pivot_highs[-3], pivot_highs[-2], pivot_highs[-1]
        valleys = [l for l in pivot_lows if h1["index"] < l["index"] < h3["index"]]
        
        if valleys:
            neckline = min([v["price"] for v in valleys])
            
            # Check maximum variance among the three peaks
            prices = [h1["price"], h2["price"], h3["price"]]
            variance = (max(prices) - min(prices)) / min(prices)
            
            if variance <= TOLERANCE:
                status = "Confirmed" if current_close < neckline else "Forming"
                
                symmetry = max(0.0, 1.0 - (variance / TOLERANCE))
                vol_ratio = current_vol / avg_vol if avg_vol > 0 else 1.0
                vol_score = min(vol_ratio / BREAKOUT_VOL_RATIO, 1.0)
                
                confidence = 0.8 * symmetry + 0.2 * vol_score
                
                detections.append(PatternDetection(
                    pattern_name="Triple Top",
                    start_date=h1["date"],
                    end_date=h3["date"],
                    confidence_score=round(max(0.3, confidence), 2),
                    supporting_evidence={"peaks": prices, "neckline": neckline, "breakout_volume_ratio": round(vol_ratio, 2)},
                    key_price_levels=prices + [neckline],
                    pattern_direction="BEARISH",
                    pattern_status=status
                ))

    # 2. Triple Bottom
    if len(pivot_lows) >= 3 and len(pivot_highs) >= 2:
        l1, l2, l3 = pivot_lows[-3], pivot_lows[-2], pivot_lows[-1]
        peaks = [h for h in pivot_highs if l1["index"] < h["index"] < l3["index"]]
        
        if peaks:
            neckline = max([p["price"] for p in peaks])
            prices = [l1["price"], l2["price"], l3["price"]]
            variance = (max(prices) - min(prices)) / min(prices)
            
            if variance <= TOLERANCE:
                status = "Confirmed" if current_close > neckline else "Forming"
                
                symmetry = max(0.0, 1.0 - (variance / TOLERANCE))
                vol_ratio = current_vol / avg_vol if avg_vol > 0 else 1.0
                vol_score = min(vol_ratio / BREAKOUT_VOL_RATIO, 1.0)
                
                confidence = 0.8 * symmetry + 0.2 * vol_score
                
                detections.append(PatternDetection(
                    pattern_name="Triple Bottom",
                    start_date=l1["date"],
                    end_date=l3["date"],
                    confidence_score=round(max(0.3, confidence), 2),
                    supporting_evidence={"troughs": prices, "neckline": neckline, "breakout_volume_ratio": round(vol_ratio, 2)},
                    key_price_levels=prices + [neckline],
                    pattern_direction="BULLISH",
                    pattern_status=status
                ))
                
    return detections


def detect_head_shoulders(df: pd.DataFrame, pivot_highs: List[dict], pivot_lows: List[dict]) -> List[PatternDetection]:
    """
    Detects Head & Shoulders and Inverse Head & Shoulders.
    Condition for H&S:
        - Peak 2 (Head) > Peak 1 (Left Shoulder)
        - Peak 2 (Head) > Peak 3 (Right Shoulder)
        - Peak 1 & Peak 3 are nearly equal (within 3% tolerance)
    Confidence scoring formula:
        Symmetry = 1.0 - abs(Shoulder1 - Shoulder3) / Shoulder1 / 0.03
        HeadHeightRatio = min(Head / max(S1, S3) - 1.0, 0.1) / 0.1  # Head must be distinct
        Confidence = 0.6 * Symmetry + 0.4 * HeadHeightRatio
    """
    detections = []
    current_close = float(df["Close"].iloc[-1])
    
    # 1. Head and Shoulders
    if len(pivot_highs) >= 3 and len(pivot_lows) >= 2:
        s1, head, s3 = pivot_highs[-3], pivot_highs[-2], pivot_highs[-1]
        
        # Verify indices order
        if s1["index"] < head["index"] < s3["index"]:
            # Valleys to draw neckline
            valleys = [l for l in pivot_lows if s1["index"] < l["index"] < s3["index"]]
            
            if len(valleys) >= 2:
                v1, v2 = valleys[-2], valleys[-1]
                neckline = (v1["price"] + v2["price"]) / 2.0
                
                # Verify Head is highest and shoulders are symmetric
                if head["price"] > s1["price"] and head["price"] > s3["price"]:
                    shoulder_diff = abs(s1["price"] - s3["price"]) / s1["price"]
                    
                    if shoulder_diff <= 0.05:  # 5% shoulder symmetry limit
                        status = "Confirmed" if current_close < neckline else "Forming"
                        
                        symmetry = max(0.0, 1.0 - (shoulder_diff / 0.05))
                        head_ratio = (head["price"] / max(s1["price"], s3["price"])) - 1.0
                        head_score = min(head_ratio / 0.05, 1.0)
                        
                        confidence = 0.6 * symmetry + 0.4 * head_score
                        
                        detections.append(PatternDetection(
                            pattern_name="Head and Shoulders",
                            start_date=s1["date"],
                            end_date=s3["date"],
                            confidence_score=round(max(0.3, confidence), 2),
                            supporting_evidence={
                                "left_shoulder": s1["price"],
                                "head": head["price"],
                                "right_shoulder": s3["price"],
                                "neckline": neckline
                            },
                            key_price_levels=[s1["price"], head["price"], s3["price"], neckline],
                            pattern_direction="BEARISH",
                            pattern_status=status
                        ))

    # 2. Inverse Head and Shoulders
    if len(pivot_lows) >= 3 and len(pivot_highs) >= 2:
        s1, head, s3 = pivot_lows[-3], pivot_lows[-2], pivot_lows[-1]
        
        if s1["index"] < head["index"] < s3["index"]:
            peaks = [h for h in pivot_highs if s1["index"] < h["index"] < s3["index"]]
            
            if len(peaks) >= 2:
                p1, p2 = peaks[-2], peaks[-1]
                neckline = (p1["price"] + p2["price"]) / 2.0
                
                if head["price"] < s1["price"] and head["price"] < s3["price"]:
                    shoulder_diff = abs(s1["price"] - s3["price"]) / s1["price"]
                    
                    if shoulder_diff <= 0.05:
                        status = "Confirmed" if current_close > neckline else "Forming"
                        
                        symmetry = max(0.0, 1.0 - (shoulder_diff / 0.05))
                        head_ratio = 1.0 - (head["price"] / min(s1["price"], s3["price"]))
                        head_score = min(head_ratio / 0.05, 1.0)
                        
                        confidence = 0.6 * symmetry + 0.4 * head_score
                        
                        detections.append(PatternDetection(
                            pattern_name="Inverse Head and Shoulders",
                            start_date=s1["date"],
                            end_date=s3["date"],
                            confidence_score=round(max(0.3, confidence), 2),
                            supporting_evidence={
                                "left_shoulder": s1["price"],
                                "head": head["price"],
                                "right_shoulder": s3["price"],
                                "neckline": neckline
                            },
                            key_price_levels=[s1["price"], head["price"], s3["price"], neckline],
                            pattern_direction="BULLISH",
                            pattern_status=status
                        ))
                        
    return detections


def detect_flags(df: pd.DataFrame, pivot_highs: List[dict], pivot_lows: List[dict]) -> List[PatternDetection]:
    """
    Detects Bull Flag and Bear Flag.
    Condition:
        - Flagpole: rapid trend price expansion over last N days.
        - Flag: brief consolidation channel sloping opposite to the flagpole.
    Confidence:
        - flagpole magnitude + slope alignment of flag channel.
    """
    detections = []
    
    if len(df) < 20:
        return []
        
    close = df["Close"].values
    high = df["High"].values
    low = df["Low"].values
    dates = df.index.strftime("%Y-%m-%d").values
    
    # Check for flagpole over last 10 days
    # Look back 15 days, find max price shift over a 5-day window
    for i in range(len(df) - 15, len(df) - 5):
        price_change = (close[i] - close[i - 5]) / close[i - 5]
        
        # 1. Bull Flag flagpole
        if price_change >= MIN_FLAGPOLE_PCT:
            # We found a potential flagpole ending at index i
            # Check for flag consolidation between index i and end
            flag_highs = high[i:]
            flag_lows = low[i:]
            
            # Simple regression slope of flag highs/lows (should be downward-sloping)
            slope_high = np.polyfit(np.arange(len(flag_highs)), flag_highs, 1)[0]
            slope_low = np.polyfit(np.arange(len(flag_lows)), flag_lows, 1)[0]
            
            if slope_high < 0 and slope_low < 0:
                # Consolidation channel sloping down
                current_close = close[-1]
                breakout_level = flag_highs[0] # roughly top of flagpole
                
                status = "Confirmed" if current_close > breakout_level else "Forming"
                confidence = min(0.5 + (price_change / 0.20), 1.0)
                
                detections.append(PatternDetection(
                    pattern_name="Bull Flag",
                    start_date=dates[i - 5],
                    end_date=dates[-1],
                    confidence_score=round(confidence, 2),
                    supporting_evidence={
                        "flagpole_pct": round(price_change * 100, 2),
                        "flag_slope": round(slope_high, 4)
                    },
                    key_price_levels=[breakout_level],
                    pattern_direction="BULLISH",
                    pattern_status=status
                ))
                break # avoid duplicates
                
        # 2. Bear Flag flagpole
        elif price_change <= -MIN_FLAGPOLE_PCT:
            flag_highs = high[i:]
            flag_lows = low[i:]
            
            slope_high = np.polyfit(np.arange(len(flag_highs)), flag_highs, 1)[0]
            slope_low = np.polyfit(np.arange(len(flag_lows)), flag_lows, 1)[0]
            
            if slope_high > 0 and slope_low > 0:
                current_close = close[-1]
                breakout_level = flag_lows[0]
                
                status = "Confirmed" if current_close < breakout_level else "Forming"
                confidence = min(0.5 + (abs(price_change) / 0.20), 1.0)
                
                detections.append(PatternDetection(
                    pattern_name="Bear Flag",
                    start_date=dates[i - 5],
                    end_date=dates[-1],
                    confidence_score=round(confidence, 2),
                    supporting_evidence={
                        "flagpole_pct": round(price_change * 100, 2),
                        "flag_slope": round(slope_high, 4)
                    },
                    key_price_levels=[breakout_level],
                    pattern_direction="BEARISH",
                    pattern_status=status
                ))
                break
                
    return detections


def detect_triangles_and_rectangles(df: pd.DataFrame, pivot_highs: List[dict], pivot_lows: List[dict]) -> List[PatternDetection]:
    """
    Detects Ascending Triangle, Descending Triangle, Symmetrical Triangle, and Rectangle patterns.
    """
    detections = []
    
    if len(pivot_highs) < 3 or len(pivot_lows) < 3:
        return []
        
    # Get last 3 pivots of each type
    highs = pivot_highs[-3:]
    lows = pivot_lows[-3:]
    
    current_close = float(df["Close"].iloc[-1])
    dates = df.index.strftime("%Y-%m-%d").values
    
    # Fit regression line to highs and lows
    high_prices = [h["price"] for h in highs]
    high_indices = [h["index"] for h in highs]
    slope_high, intercept_high = np.polyfit(high_indices, high_prices, 1)
    
    low_prices = [l["price"] for l in lows]
    low_indices = [l["index"] for l in lows]
    slope_low, intercept_low = np.polyfit(low_indices, low_prices, 1)
    
    # Calculate variation (to identify flat lines)
    var_high = (max(high_prices) - min(high_prices)) / min(high_prices)
    var_low = (max(low_prices) - min(low_prices)) / min(low_prices)
    
    # Start date is the earliest of the pivots
    start_date = min(highs[0]["date"], lows[0]["date"])
    end_date = max(highs[-1]["date"], lows[-1]["date"])

    # 1. Rectangle (flat highs and flat lows)
    if var_high <= TOLERANCE and var_low <= TOLERANCE:
        resistance = np.mean(high_prices)
        support = np.mean(low_prices)
        
        status = "Forming"
        if current_close > resistance:
            status = "Confirmed"
        elif current_close < support:
            status = "Confirmed"
            
        detections.append(PatternDetection(
            pattern_name="Rectangle",
            start_date=start_date,
            end_date=end_date,
            confidence_score=0.8,
            supporting_evidence={"resistance": resistance, "support": support, "touches": 6},
            key_price_levels=[resistance, support],
            pattern_direction="NEUTRAL",
            pattern_status=status
        ))
        
    # 2. Ascending Triangle (flat highs, rising lows)
    elif var_high <= TOLERANCE and slope_low > 0.05:
        resistance = np.mean(high_prices)
        status = "Confirmed" if current_close > resistance else "Forming"
        
        detections.append(PatternDetection(
            pattern_name="Ascending Triangle",
            start_date=start_date,
            end_date=end_date,
            confidence_score=0.75,
            supporting_evidence={"resistance": resistance, "slope_low": round(slope_low, 4)},
            key_price_levels=[resistance],
            pattern_direction="BULLISH",
            pattern_status=status
        ))

    # 3. Descending Triangle (falling highs, flat lows)
    elif slope_high < -0.05 and var_low <= TOLERANCE:
        support = np.mean(low_prices)
        status = "Confirmed" if current_close < support else "Forming"
        
        detections.append(PatternDetection(
            pattern_name="Descending Triangle",
            start_date=start_date,
            end_date=end_date,
            confidence_score=0.75,
            supporting_evidence={"support": support, "slope_high": round(slope_high, 4)},
            key_price_levels=[support],
            pattern_direction="BEARISH",
            pattern_status=status
        ))

    # 4. Symmetrical Triangle (falling highs, rising lows)
    elif slope_high < -0.05 and slope_low > 0.05:
        status = "Forming"
        # Symmetrical triangle breakout is confirmed when price breaks the apex boundaries
        detections.append(PatternDetection(
            pattern_name="Symmetrical Triangle",
            start_date=start_date,
            end_date=end_date,
            confidence_score=0.70,
            supporting_evidence={"slope_high": round(slope_high, 4), "slope_low": round(slope_low, 4)},
            key_price_levels=[highs[-1]["price"], lows[-1]["price"]],
            pattern_direction="NEUTRAL",
            pattern_status=status
        ))
        
    return detections


def detect_cup_and_handle(df: pd.DataFrame, pivot_highs: List[dict], pivot_lows: List[dict]) -> List[PatternDetection]:
    """
    Detects Cup and Cup & Handle patterns.
    Rules:
        - Cup: A local high, followed by a decline to a rounded bottom, then recovery back to the high.
        - Handle: A downward sloping channel at the right lip of the cup.
    """
    detections = []
    
    if len(pivot_highs) < 2 or len(pivot_lows) < 2:
        return []
        
    h1, h2 = pivot_highs[-2], pivot_highs[-1]
    
    # Check if we have a deep trough between the two peaks
    troughs = [l for l in pivot_lows if h1["index"] < l["index"] < h2["index"]]
    if troughs:
        min_trough = min(troughs, key=lambda x: x["price"])
        
        # Verify cup depth (rounded bottom means trough is significantly lower)
        depth = h1["price"] - min_trough["price"]
        depth_pct = depth / h1["price"]
        
        if 0.15 <= depth_pct <= 0.50:  # 15% to 50% cup depth
            # Check peak price symmetry (lips of the cup)
            lip_diff = abs(h1["price"] - h2["price"]) / h1["price"]
            
            if lip_diff <= 0.05:  # 5% lip symmetry
                # Determine if we have a handle after h2
                # Handle is a consolidation between h2 and current index
                h2_idx = h2["index"]
                current_close = float(df["Close"].iloc[-1])
                
                # Handle should be a small pullback (10-30% of cup depth)
                pullback = h2["price"] - current_close
                pullback_pct = pullback / depth if depth > 0 else 0.0
                
                if 0.05 <= pullback_pct <= 0.35:
                    # We are in the Handle zone!
                    detections.append(PatternDetection(
                        pattern_name="Cup and Handle",
                        start_date=h1["date"],
                        end_date=df.index[-1].strftime("%Y-%m-%d"),
                        confidence_score=0.80,
                        supporting_evidence={"cup_depth_pct": round(depth_pct, 4), "handle_pullback_pct": round(pullback_pct, 4)},
                        key_price_levels=[h1["price"], h2["price"], min_trough["price"]],
                        pattern_direction="BULLISH",
                        pattern_status="Forming"
                    ))
                else:
                    # Rounded Cup only
                    status = "Confirmed" if current_close > h2["price"] else "Forming"
                    detections.append(PatternDetection(
                        pattern_name="Cup",
                        start_date=h1["date"],
                        end_date=h2["date"],
                        confidence_score=0.70,
                        supporting_evidence={"cup_depth_pct": round(depth_pct, 4)},
                        key_price_levels=[h1["price"], h2["price"], min_trough["price"]],
                        pattern_direction="BULLISH",
                        pattern_status=status
                    ))
                    
    return detections


def detect_breakouts(df: pd.DataFrame, pivot_highs: List[dict], pivot_lows: List[dict]) -> List[PatternDetection]:
    """
    Detects pure breakout/breakdown signals of key historical price levels.
    """
    detections = []
    
    if len(df) < 30:
        return []
        
    current_close = float(df["Close"].iloc[-1])
    current_vol = float(df["Volume"].iloc[-1])
    avg_vol = float(df["Volume"].rolling(20).mean().iloc[-1])
    dates = df.index.strftime("%Y-%m-%d").values
    
    # 1. Resistance Breakout
    # Find highest pivot high in last 30 days (excluding today)
    recent_highs = [h for h in pivot_highs if len(df) - 30 <= h["index"] < len(df) - 1]
    if recent_highs:
        max_high = max([h["price"] for h in recent_highs])
        
        # Breakout condition
        if current_close > max_high:
            vol_ratio = current_vol / avg_vol if avg_vol > 0 else 1.0
            
            # Confidence increases with volume
            confidence = min(0.6 + (vol_ratio / 5.0), 1.0)
            
            detections.append(PatternDetection(
                pattern_name="Resistance Breakout",
                start_date=dates[-2],
                end_date=dates[-1],
                confidence_score=round(confidence, 2),
                supporting_evidence={"breakout_level": max_high, "volume_ratio": round(vol_ratio, 2)},
                key_price_levels=[max_high],
                pattern_direction="BULLISH",
                pattern_status="Confirmed"
            ))

    # 2. Support Breakdown
    recent_lows = [l for l in pivot_lows if len(df) - 30 <= l["index"] < len(df) - 1]
    if recent_lows:
        min_low = min([l["price"] for l in recent_lows])
        
        if current_close < min_low:
            vol_ratio = current_vol / avg_vol if avg_vol > 0 else 1.0
            confidence = min(0.6 + (vol_ratio / 5.0), 1.0)
            
            detections.append(PatternDetection(
                pattern_name="Support Breakdown",
                start_date=dates[-2],
                end_date=dates[-1],
                confidence_score=round(confidence, 2),
                supporting_evidence={"breakdown_level": min_low, "volume_ratio": round(vol_ratio, 2)},
                key_price_levels=[min_low],
                pattern_direction="BEARISH",
                pattern_status="Confirmed"
            ))
            
    return detections


def detect_all_patterns(df: pd.DataFrame) -> List[PatternDetection]:
    """
    Combines all pattern detection methods.
    Returns a unified list of detected chart patterns.
    """
    if df.empty:
        return []
        
    pivot_window = settings.INDICATOR_PERIODS.get("pivot_window", 5)
    highs, lows = find_pivots(df, window=pivot_window)
    
    detections = []
    
    # Run all detectors
    detections.extend(detect_trend_structure(df, highs, lows))
    detections.extend(detect_double_top_bottom(df, highs, lows))
    detections.extend(detect_triple_top_bottom(df, highs, lows))
    detections.extend(detect_head_shoulders(df, highs, lows))
    detections.extend(detect_flags(df, highs, lows))
    detections.extend(detect_triangles_and_rectangles(df, highs, lows))
    detections.extend(detect_cup_and_handle(df, highs, lows))
    detections.extend(detect_breakouts(df, highs, lows))
    
    return detections
