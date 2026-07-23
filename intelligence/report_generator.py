import logging
from typing import Dict, Any
from intelligence.schemas import EvidencePack
from intelligence.prompt_builder import PromptBuilder
from intelligence.gemini_client import GeminiClient
from intelligence.cache import LLMResponseCache

logger = logging.getLogger("AIEquityResearchPlatform")

class ReportGenerator:
    """
    Top-level orchestrator for the Intelligence Layer.
    Handles caching, intermediate EvidencePack mapping, prompt assembly, client queries, and fallbacks.
    """
    def __init__(self, client: GeminiClient, prompt_builder: PromptBuilder, cache: LLMResponseCache):
        self.client = client
        self.prompt_builder = prompt_builder
        self.cache = cache

    def generate_report(self, ticker: str, timeframe: str, report_dict: Dict[str, Any]) -> Dict[str, Any]:
        # 1. Map deterministic report details onto normalized EvidencePack
        evidence = self._create_evidence_pack(ticker, report_dict)
        
        # 2. Check Cache
        cached_ai = self.cache.get_cached_report(ticker, timeframe, evidence)
        if cached_ai:
            # Return cached AI report and mark cached = True
            cached_copy = dict(cached_ai)
            if "metadata" in cached_copy:
                cached_copy["metadata"] = dict(cached_copy["metadata"])
                cached_copy["metadata"]["cached"] = True
            return cached_copy

        # 3. Cache Miss - Build prompt
        prompt = self.prompt_builder.build_prompt(evidence)
        
        # 4. Generate report via Gemini client
        ai_report = self.client.generate_research_report(prompt, evidence)
        
        # 5. Save to Cache
        self.cache.set_cached_report(ticker, timeframe, evidence, ai_report)
        
        return ai_report

    def _create_evidence_pack(self, ticker: str, report_dict: Dict[str, Any]) -> EvidencePack:
        # Extract variables from deterministic report dictionary
        closes = report_dict["chart_data"]["close"]
        price = closes[-1] if closes else 0.0
        
        scores = report_dict["scores"]
        risk = report_dict["risk_profile"]
        context = report_dict["market_context"]
        
        # Map category scores safely
        cat_scores = {
            "trend": scores.get("trend", {}).get("value", 50.0),
            "momentum": scores.get("momentum", {}).get("value", 50.0),
            "volume": scores.get("volume", {}).get("value", 50.0),
            "volatility": scores.get("volatility", {}).get("value", 50.0),
            "relative_strength": scores.get("sector", {}).get("value", 50.0), # mapped to sector
            "support": scores.get("support", {}).get("value", 50.0),
            "resistance": scores.get("resistance", {}).get("value", 50.0),
            "patterns": scores.get("pattern", {}).get("value", 50.0),
        }
        
        # Map signal agreement details
        meta = report_dict.get("metadata", {})
        explanation = meta.get("scoring_explanation", {})
        sig = explanation.get("signal_agreement", {})
        
        # Get support & resistance levels
        support_levels = [float((z["upper_bound"] + z["lower_bound"]) / 2.0) for z in report_dict.get("support_zones", [])]
        resistance_levels = [float((z["upper_bound"] + z["lower_bound"]) / 2.0) for z in report_dict.get("resistance_zones", [])]
        
        # Mapped strategy targets
        rec = scores["recommendation"]
        is_buy = rec == "BUY"
        entry_val = price if is_buy else (resistance_levels[0] * 1.01 if resistance_levels else price * 1.05)
        
        # Determine hold period and stop loss bounds
        sl_val = entry_val * (0.94 if is_buy else 0.90)
        t1_val = entry_val * (1.08 if is_buy else 1.12)
        t2_val = entry_val * (1.15 if is_buy else 1.20)
        
        strategy_dict = {
            "entry": f"Market Entry at {entry_val:.2f}" if is_buy else f"Breakout entry above resistance at {entry_val:.2f}",
            "stop_loss": f"Hard stop at {sl_val:.2f} (close below)",
            "target_1": f"First target at {t1_val:.2f}",
            "target_2": f"Second target at {t2_val:.2f}",
            "holding_period": "1 - 3 Months" if is_buy else "Tactical Breakout Hold"
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
            risk_factors=[f"Annualized Volatility: {risk.get('annualized_volatility', 25.0):.1f}%", f"ATR Buffer: {risk.get('atr_percentage', 2.5):.2f}%"],
            trend_summary=f"Stock trend remains supported above pivot zones with score {cat_scores['trend']:.1f}/100",
            market_context=context,
            strategy=strategy_dict
        )
