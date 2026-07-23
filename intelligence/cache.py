import logging
from typing import Dict, Any, Optional
from intelligence.schemas import AIResearchReportModel

logger = logging.getLogger("AIEquityResearchPlatform")

class LLMResponseCache:
    """
    Cache layer for LLM Research Reports to avoid expensive model regeneration.
    Tracks quantitative parameters and invalidates entries when data changes materially.
    """
    def __init__(self):
        # key: (ticker, timeframe) -> {
        #   "scores": {
        #      "recommendation": str,
        #      "overall_score": float,
        #      "confidence": float,
        #      "regime": str,
        #      "patterns_count": int,
        #      "support_count": int,
        #      "resistance_count": int
        #   },
        #   "report": dict
        # }
        self._cache = {}

    def get_cached_report(self, ticker: str, timeframe: str, evidence: Any) -> Optional[Dict[str, Any]]:
        key = (ticker.upper().strip(), timeframe)
        cached = self._cache.get(key)
        if not cached:
            return None

        cached_scores = cached["scores"]
        
        # Check invalidation thresholds against current evidence pack
        rec_changed = cached_scores["recommendation"] != evidence.recommendation
        score_moved = abs(cached_scores["overall_score"] - evidence.technical_score) > 5.0
        conf_moved = abs(cached_scores["confidence"] - evidence.confidence) > 5.0
        
        regime_changed = cached_scores["regime"] != evidence.market_regime
        patterns_changed = cached_scores["patterns_count"] != len(evidence.detected_patterns)
        
        support_changed = cached_scores["support_count"] != len(evidence.support_levels)
        resistance_changed = cached_scores["resistance_count"] != len(evidence.resistance_levels)

        if (rec_changed or score_moved or conf_moved or regime_changed or 
            patterns_changed or support_changed or resistance_changed):
            logger.info(f"LLM cache INVALIDATED for {ticker} ({timeframe}) due to quantitative change.")
            return None
            
        logger.info(f"LLM cache HIT for {ticker} ({timeframe})")
        return cached["report"]

    def set_cached_report(self, ticker: str, timeframe: str, evidence: Any, ai_report: Dict[str, Any]):
        key = (ticker.upper().strip(), timeframe)
        self._cache[key] = {
            "scores": {
                "recommendation": evidence.recommendation,
                "overall_score": evidence.technical_score,
                "confidence": evidence.confidence,
                "regime": evidence.market_regime,
                "patterns_count": len(evidence.detected_patterns),
                "support_count": len(evidence.support_levels),
                "resistance_count": len(evidence.resistance_levels)
            },
            "report": ai_report
        }
        logger.info(f"Cached new LLM analysis report for {ticker} ({timeframe})")
