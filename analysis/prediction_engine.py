from typing import Any, Dict, List, Tuple
from datetime import datetime
import pandas as pd

from analysis.models.prediction import PredictionResult, get_recommendation_from_probability
from analysis.interfaces import BasePredictionEngine
from config.settings import settings


class DeterministicPredictionEngine(BasePredictionEngine):
    """
    Modular, Horizon-Aware Deterministic Live AI Trading Recommendation Engine.
    Processes technical, market, sector, volume, and news catalysts to compute
    probability-driven 7-level recommendations.
    """

    HORIZON_MOVE_MULTIPLIERS = {"5m": 0.25, "10m": 0.35, "15m": 0.45, "30m": 0.65, "1d": 1.0, "1w": 2.2, "1mo": 4.5}

    def _event_signal(self, intelligence_pack: Any) -> Tuple[float, float, List[str], bool]:
        events = getattr(intelligence_pack, "key_events", []) if intelligence_pack else []
        sentiment = getattr(getattr(intelligence_pack, "overall_sentiment", None), "primary_sentiment", "Neutral") if intelligence_pack else "Neutral"
        
        event_score = 50.0
        importance = 0.0
        reasons: List[str] = []

        for event in events:
            # Scale impact levels: High (95.0), Medium (72.0), Low (50.0)
            impact = {"High": 95.0, "Medium": 72.0, "Low": 50.0}.get(event.impact_level, 50.0)
            importance = max(importance, impact)

            if event.sentiment == "Bullish":
                # High impact bullish events boost catalyst score up to 95.0
                event_score += (impact - 50.0) * 0.95
                reasons.append(f"✓ {event.title}")
            elif event.sentiment == "Bearish":
                # High impact bearish events drag catalyst score down to 5.0
                event_score -= (impact - 50.0) * 0.95
                reasons.append(f"⚠ {event.title}")

        if sentiment == "Bullish":
            event_score += 10.0
        elif sentiment == "Bearish":
            event_score -= 10.0

        event_score = max(0.0, min(100.0, event_score))
        event_override = importance >= settings.EVENT_OVERRIDE_IMPORTANCE_THRESHOLD
        return event_score, importance, reasons[:3], event_override

    def predict(
        self, 
        ticker: str, 
        horizon: str, 
        features_df: pd.DataFrame, 
        scores: Any, 
        risk: Any, 
        market_context: Dict[str, Any], 
        intelligence_pack: Any
    ) -> PredictionResult:
        horizon_clean = horizon.lower()
        if horizon_clean not in settings.PREDICTION_HORIZON_WEIGHTS:
            horizon_clean = "1d"

        weights = settings.PREDICTION_HORIZON_WEIGHTS[horizon_clean]
        event_score, event_importance, event_reasons, event_override = self._event_signal(intelligence_pack)
        sentiment = getattr(getattr(intelligence_pack, "overall_sentiment", None), "primary_sentiment", "Neutral") if intelligence_pack else "Neutral"
        sentiment_score = {"Bullish": 85.0, "Bearish": 15.0}.get(sentiment, 50.0)

        signal_scores = {
            "technical": scores.overall_score,
            "price_action": scores.trend.value,
            "volume": scores.volume.value,
            "momentum": scores.momentum.value,
            "market": scores.market.value,
            "sector": scores.sector.value,
            "news": event_score,
            "sentiment": sentiment_score,
            "volatility": scores.volatility.value,
        }

        # Calculate base weighted score
        weighted_score = sum(signal_scores[name] * weight for name, weight in weights.items() if name in signal_scores)

        # High impact event override logic: catalyst score leads direction with technical confluence
        if event_override:
            weighted_score = (event_score * 0.70) + (scores.overall_score * 0.30)

        # Map weighted score to continuous probability (0.0 to 100.0%)
        probability = round(max(0.0, min(100.0, weighted_score)), 1)

        # Direction classification based on probability
        direction = "UP" if probability >= 55.0 else ("DOWN" if probability <= 45.0 else "NEUTRAL")

        # 7-Level Probability-Driven Recommendation Mapping
        recommendation = get_recommendation_from_probability(probability)

        # Calculate signal agreement for confidence rating
        signed_groups = [score - 50.0 for score in signal_scores.values() if abs(score - 50.0) >= 5.0]
        agreement = abs(sum(1 if score > 0 else -1 for score in signed_groups)) / len(signed_groups) if signed_groups else 0.0
        confidence = round(min(max(50.0 + agreement * 45.0, 50.0), 98.0), 1)

        # Calculate target price, stop-loss, and expected move %
        close = float(features_df["Close"].iloc[-1])
        atr_col = next((col for col in features_df.columns if col.startswith("ATR_")), None)
        atr_pct = float(features_df[atr_col].iloc[-1]) / close * 100.0 if atr_col else 2.0
        
        move_mult = self.HORIZON_MOVE_MULTIPLIERS.get(horizon_clean, 1.0)
        move_pct = atr_pct * move_mult * (1.0 if direction == "UP" else (-1.0 if direction == "DOWN" else 0.0))

        target = close * (1.0 + move_pct / 100.0) if direction != "NEUTRAL" else close * 1.02
        stop = close * (1.0 - abs(move_pct) / 100.0) if direction != "NEUTRAL" else close * 0.98

        # Synthesize clear, bulleted reasons
        reasons = list(event_reasons)
        if scores.overall_score >= 60.0:
            reasons.append(f"✓ Technical score strong ({scores.overall_score:.0f}/100)")
        elif scores.overall_score <= 40.0:
            reasons.append(f"⚠ Technical score weak ({scores.overall_score:.0f}/100)")

        if scores.volume.value >= 65.0:
            reasons.append(f"✓ High volume accumulation verified ({scores.volume.value:.0f}/100)")
        if scores.momentum.value >= 65.0:
            reasons.append(f"✓ Bullish momentum acceleration ({scores.momentum.value:.0f}/100)")

        if not reasons:
            reasons = ["✓ Market signals balanced", f"Technical score {scores.overall_score:.0f}/100"]

        return PredictionResult(
            ticker=ticker,
            horizon=horizon,
            direction=direction,
            recommendation=recommendation,
            probability=probability,
            confidence=confidence,
            expected_move_pct=round(move_pct, 2),
            target_price=round(target, 2),
            stop_loss=round(stop, 2),
            risk=risk.level,
            reasons=reasons[:6],
            signal_scores={key: round(value, 2) for key, value in signal_scores.items()},
            event_override_applied=event_override,
            last_updated=datetime.now().strftime("%H:%M:%S")
        )
