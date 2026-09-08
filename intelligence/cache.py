import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from intelligence.schemas import EvidencePack

logger = logging.getLogger("AIEquityResearchPlatform")


class BaseLLMCache(ABC):
    """
    Abstract interface for LLM response cache storage.
    Enables seamless persistent migration (e.g. Redis, PostgreSQL, SQLite)
    without modifying ReportGenerator or Provider logic.
    """

    @abstractmethod
    def get_cached_report(self, ticker: str, timeframe: str, timestamp: str, evidence: EvidencePack) -> Optional[Dict[str, Any]]:
        """Retrieves a cached AI research report if valid for the given timestamp key and quantitative state."""
        pass

    @abstractmethod
    def set_cached_report(self, ticker: str, timeframe: str, timestamp: str, evidence: EvidencePack, ai_report: Dict[str, Any]) -> None:
        """Stores an AI research report in cache keyed by ticker, timeframe, and timestamp."""
        pass

    @abstractmethod
    def clear(self) -> None:
        """Clears the cache."""
        pass


class InMemoryLLMCache(BaseLLMCache):
    """
    In-memory persistent-ready cache implementation for LLM Research Reports.
    Uses composite key: (ticker.upper(), timeframe, latest_candle_timestamp).
    Performs invalidate checks if recommendation, score, or regime shifts materially.
    """

    def __init__(self):
        # Key: (ticker, timeframe, timestamp) -> { "scores": dict, "report": dict }
        self._cache: Dict[tuple, Dict[str, Any]] = {}

    def _build_key(self, ticker: str, timeframe: str, timestamp: str) -> tuple:
        t_clean = ticker.upper().strip()
        tf_clean = timeframe.lower().strip()
        ts_clean = str(timestamp).strip()
        return (t_clean, tf_clean, ts_clean)

    def get_cached_report(self, ticker: str, timeframe: str, timestamp: str, evidence: EvidencePack) -> Optional[Dict[str, Any]]:
        key = self._build_key(ticker, timeframe, timestamp)
        cached = self._cache.get(key)

        if not cached:
            # Also check fallback lookup without timestamp if timestamp is empty or fuzzy
            if not timestamp:
                for (t, tf, ts), item in self._cache.items():
                    if t == ticker.upper().strip() and tf == timeframe.lower().strip():
                        cached = item
                        break

        if not cached:
            logger.debug(f"LLM cache MISS for key: {key}")
            return None

        cached_scores = cached["scores"]

        # Quantitative invalidation safety checks
        rec_changed = cached_scores.get("recommendation") != evidence.recommendation
        score_moved = abs(cached_scores.get("overall_score", 0.0) - evidence.technical_score) > 5.0
        conf_moved = abs(cached_scores.get("confidence", 0.0) - evidence.confidence) > 5.0
        regime_changed = cached_scores.get("regime") != evidence.market_regime

        if rec_changed or score_moved or conf_moved or regime_changed:
            logger.info(f"LLM cache INVALIDATED for {ticker} ({timeframe}) due to quantitative parameter drift.")
            self._cache.pop(key, None)
            return None

        logger.info(f"LLM cache HIT for {ticker} ({timeframe}, timestamp: {timestamp})")
        report_copy = dict(cached["report"])
        if "metadata" not in report_copy or not isinstance(report_copy["metadata"], dict):
            report_copy["metadata"] = {}
        else:
            report_copy["metadata"] = dict(report_copy["metadata"])
        report_copy["metadata"]["cached"] = True
        return report_copy

    def set_cached_report(self, ticker: str, timeframe: str, timestamp: str, evidence: EvidencePack, ai_report: Dict[str, Any]) -> None:
        key = self._build_key(ticker, timeframe, timestamp)
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
        logger.info(f"Cached LLM research report for {ticker} ({timeframe}, timestamp: {timestamp})")

    def clear(self) -> None:
        self._cache.clear()


# Backward compatibility alias
LLMResponseCache = InMemoryLLMCache
