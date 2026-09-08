import time
import logging
from typing import Dict, Any, Generator
from intelligence.schemas import EvidencePack, AIResearchReportModel, IntelligencePack
from intelligence.prompt_builder import PromptBuilder
from intelligence.provider import LLMProvider
from intelligence.gemini_provider import GeminiProvider
from intelligence.cache import BaseLLMCache
from intelligence.exceptions import LLMKeyMissingError, LLMProviderError, LLMJSONParseError

logger = logging.getLogger("AIEquityResearchPlatform")


class ReportGenerator:
    """
    Top-level orchestrator for the Intelligence Layer.
    Consumes deterministic report payload, constructs EvidencePack, queries cache,
    queries LLMProvider abstraction, handles retries and fallbacks, and returns merged output.
    """

    def __init__(self, provider: LLMProvider, prompt_builder: PromptBuilder, cache: BaseLLMCache):
        self.provider = provider
        self.prompt_builder = prompt_builder
        self.cache = cache

    def generate_report(self, ticker: str, timeframe: str, report_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates or retrieves the AI Research Report for a stock analysis payload.
        Guarantees non-blocking execution via graceful fallback if provider errors or API key is missing.
        """
        # 1. Map deterministic report details onto normalized EvidencePack
        evidence = self._create_evidence_pack(ticker, timeframe, report_dict)
        timestamp = evidence.latest_candle_timestamp

        # 2. Check Cache with timestamp key
        cached_ai = self.cache.get_cached_report(ticker, timeframe, timestamp, evidence)
        if cached_ai:
            return cached_ai

        # 3. Cache Miss - Assemble prompt
        prompt = self.prompt_builder.build_prompt(evidence)

        # 4. Generate report via LLMProvider abstraction with graceful fallback and 5.0s timeout cap
        t_llm_start = time.time()
        logger.info(f"START LLM generation for {ticker}")
        ai_report = None

        try:
            from concurrent.futures import ThreadPoolExecutor, TimeoutError
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(self.provider.generate, prompt, schema=AIResearchReportModel)
                ai_report = future.result(timeout=5.0)
            llm_time_ms = round((time.time() - t_llm_start) * 1000, 2)
            logger.info(f"LLM generation completed for {ticker} ({llm_time_ms} ms)")
        except TimeoutError:
            llm_time_ms = round((time.time() - t_llm_start) * 1000, 2)
            logger.warning(f"[TIMEOUT] LLM generation for {ticker} exceeded 5.0s limit ({llm_time_ms} ms). Routing to rule-based fallback generation.")
            fallback_gen = GeminiProvider()
            ai_report = fallback_gen.generate_fallback_report(evidence, fallback_reason="LLM generation timeout (exceeded 5.0s limit)")
        except (LLMKeyMissingError, LLMProviderError, LLMJSONParseError) as err:
            llm_time_ms = round((time.time() - t_llm_start) * 1000, 2)
            logger.warning(f"LLM Provider execution exception ({err}) ({llm_time_ms} ms). Routing to rule-based fallback generation.")
            fallback_gen = GeminiProvider()
            ai_report = fallback_gen.generate_fallback_report(evidence, fallback_reason=str(err))
        except Exception as unhandled:
            llm_time_ms = round((time.time() - t_llm_start) * 1000, 2)
            logger.error(f"Unexpected exception during LLM generation ({unhandled}) ({llm_time_ms} ms). Routing to fallback.")
            fallback_gen = GeminiProvider()
            ai_report = fallback_gen.generate_fallback_report(evidence, fallback_reason=f"unhandled: {str(unhandled)}")

        # 5. Store in Cache
        t_cache = time.time()
        if ai_report:
            self.cache.set_cached_report(ticker, timeframe, timestamp, evidence, ai_report)
            cache_time_ms = round((time.time() - t_cache) * 1000, 2)
            logger.info(f"Cache write completed ({cache_time_ms} ms)")

        return ai_report

    def generate_report_stream(self, ticker: str, timeframe: str, report_dict: Dict[str, Any]) -> Generator[str, None, None]:
        """
        Streaming-Ready Architecture hook.
        Yields JSON report chunks or progress updates to support Server-Sent Events (SSE) or WebSockets.
        """
        # Step 1: Yield progress notice
        yield '{"status": "processing", "message": "Assembling quantitative evidence pack..."}'
        
        # Step 2: Generate complete report
        ai_report = self.generate_report(ticker, timeframe, report_dict)
        
        # Step 3: Yield completed payload
        import json
        yield json.dumps({"status": "completed", "report": ai_report})

    def _create_evidence_pack(self, ticker: str, timeframe: str, report_dict: Dict[str, Any]) -> EvidencePack:
        """Helper to extract and map deterministic report variables onto normalized EvidencePack."""
        chart_data = report_dict.get("chart_data", {})
        closes = chart_data.get("close", [])
        dates = chart_data.get("dates", [])
        
        price = closes[-1] if closes else 0.0
        latest_timestamp = dates[-1] if dates else ""

        scores = report_dict.get("scores", {})
        risk = report_dict.get("risk_profile", {})
        context = report_dict.get("market_context", {})

        cat_scores = {
            "trend": scores.get("trend", {}).get("value", 50.0),
            "momentum": scores.get("momentum", {}).get("value", 50.0),
            "volume": scores.get("volume", {}).get("value", 50.0),
            "volatility": scores.get("volatility", {}).get("value", 50.0),
            "relative_strength": scores.get("sector", {}).get("value", 50.0),
            "support": scores.get("support", {}).get("value", 50.0),
            "resistance": scores.get("resistance", {}).get("value", 50.0),
            "patterns": scores.get("pattern", {}).get("value", 50.0),
        }

        meta = report_dict.get("metadata", {})
        explanation = meta.get("scoring_explanation", {})
        sig = explanation.get("signal_agreement", {})

        support_levels = [float((z["upper_bound"] + z["lower_bound"]) / 2.0) for z in report_dict.get("support_zones", [])]
        resistance_levels = [float((z["upper_bound"] + z["lower_bound"]) / 2.0) for z in report_dict.get("resistance_zones", [])]

        rec = scores.get("recommendation", "WATCH")
        is_bullish = rec in ["STRONG BUY", "BUY", "ACCUMULATE", "WATCH"]
        
        # Ground entry strictly on current price to prevent invalid stop loss > price setups
        entry_val = price if price > 0 else (resistance_levels[0] if resistance_levels else 100.0)

        sl_val = round(entry_val * 0.95, 2)
        t1_val = round(entry_val * 1.08, 2)
        t2_val = round(entry_val * 1.15, 2)

        strategy_dict = {
            "entry": f"Market Entry at {entry_val:.2f}",
            "stop_loss": f"Hard stop at {sl_val:.2f} (close below)",
            "target_1": f"First target at {t1_val:.2f}",
            "target_2": f"Second target at {t2_val:.2f}",
            "holding_period": "1 - 3 Months" if is_bullish else "Tactical Position Hold"
        }

        detected_patterns = [p["pattern_name"] for p in report_dict.get("patterns", [])]

        return EvidencePack(
            ticker=ticker,
            company_name=report_dict.get("company_name", ticker),
            price=price,
            recommendation=rec,
            confidence=scores.get("confidence", 50.0),
            technical_score=scores.get("overall_score", 50.0),
            market_regime=explanation.get("regime", "trending"),
            signal_agreement=sig,
            category_scores=cat_scores,
            positive_contributors=report_dict.get("positive_factors", []),
            negative_contributors=report_dict.get("negative_factors", []),
            neutral_factors=report_dict.get("neutral_factors", []),
            support_levels=support_levels,
            resistance_levels=resistance_levels,
            detected_patterns=detected_patterns,
            risk_factors=[
                f"Annualized Volatility: {risk.get('annualized_volatility', 25.0):.1f}%",
                f"ATR Buffer: {risk.get('atr_percentage', 2.5):.2f}%"
            ],
            trend_summary=f"Stock trend score: {cat_scores['trend']:.1f}/100",
            market_context=context,
            strategy=strategy_dict,
            timeframe=timeframe,
            latest_candle_timestamp=latest_timestamp,
            intelligence_pack=IntelligencePack(**report_dict["intelligence_pack"]) if report_dict.get("intelligence_pack") else None
        )
