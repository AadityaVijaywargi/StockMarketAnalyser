import os
import json
import time
import logging
from datetime import datetime
from typing import Dict, Any, Optional, Type
from pydantic import BaseModel

from config.settings import settings
from intelligence.provider import LLMProvider
from intelligence.exceptions import (
    LLMProviderError, LLMKeyMissingError, LLMJSONParseError
)
from intelligence.schemas import (
    AIResearchReportModel, SectionWithEvidence, FactorEvidenceModel,
    TradingStrategyModel, AIMetadataModel, EvidencePack
)
from intelligence.prompt_builder import PROMPT_VERSION

logger = logging.getLogger("AIEquityResearchPlatform")


class GeminiProvider(LLMProvider):
    """
    Production implementation of LLMProvider using the new google-genai SDK.
    Strictly enforces grounded Pydantic schema validation, low temperature sampling,
    and automatic single-retry handling on malformed JSON outputs.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        super().__init__("Gemini")
        # Priority: explicit arg -> GOOGLE_API_KEY env -> GEMINI_API_KEY settings
        self.api_key = (
            api_key or 
            os.environ.get("GOOGLE_API_KEY") or 
            os.environ.get("GEMINI_API_KEY") or 
            getattr(settings, "GEMINI_API_KEY", "")
        )
        self.model_name = model or getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")
        self.temperature = getattr(settings, "GEMINI_TEMPERATURE", 0.1)
        self.max_tokens = getattr(settings, "GEMINI_MAX_OUTPUT_TOKENS", 2048)
        
        self.client = None
        if self.api_key:
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key)
                logger.info(f"Initialized Gemini Client with model '{self.model_name}'")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini Client: {e}")

    def generate(self, prompt: str, schema: Optional[Type[BaseModel]] = None) -> Dict[str, Any]:
        """
        Queries Gemini for a structured report with single-retry logic on JSON parsing failure.
        """
        target_schema = schema or AIResearchReportModel
        t0 = time.time()

        if not self.client:
            logger.warning("Gemini Client uninitialized (missing API Key). Returning LLMKeyMissingError context.")
            raise LLMKeyMissingError("Gemini", "GOOGLE_API_KEY")

        # Attempt 1 & Attempt 2 (retry on malformed JSON)
        last_error = None
        for attempt in range(1, 3):
            try:
                from google.genai import types
                
                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=self.temperature,
                        max_output_tokens=self.max_tokens,
                        response_mime_type="application/json",
                        response_schema=target_schema,
                    )
                )

                elapsed_ms = round((time.time() - t0) * 1000, 2)
                raw_text = response.text

                # Validate JSON & Pydantic conformance
                parsed_data = json.loads(raw_text)
                validated = target_schema.model_validate(parsed_data)
                result_dict = validated.model_dump()

                # Attach metadata
                result_dict["metadata"] = {
                    "model": self.model_name,
                    "prompt_version": PROMPT_VERSION,
                    "generated_at": datetime.now().isoformat(),
                    "cached": False,
                    "response_time_ms": elapsed_ms,
                    "token_usage": {
                        "input_tokens": response.usage_metadata.prompt_token_count if response.usage_metadata else 0,
                        "output_tokens": response.usage_metadata.candidates_token_count if response.usage_metadata else 0
                    }
                }
                logger.info(f"Gemini generation succeeded on attempt {attempt} in {elapsed_ms}ms")
                return result_dict

            except json.JSONDecodeError as json_err:
                last_error = LLMJSONParseError(f"JSON decode error on attempt {attempt}: {json_err}", raw_response=getattr(response, 'text', None))
                logger.warning(f"Gemini attempt {attempt} returned invalid JSON: {json_err}. {'Retrying...' if attempt == 1 else 'Failing.'}")
            except Exception as e:
                last_error = LLMProviderError("Gemini", f"Generation error on attempt {attempt}: {str(e)}", original_error=e)
                logger.warning(f"Gemini attempt {attempt} failed: {e}. {'Retrying...' if attempt == 1 else 'Failing.'}")

        # If both attempts failed, raise last error
        raise last_error

    def generate_fallback_report(self, evidence: EvidencePack, fallback_reason: str) -> Dict[str, Any]:
        """
        Generates a deterministic rule-based research report with evidence attribution.
        Guarantees system continuity when no API key is provided or Gemini is unreachable.
        """
        t0 = time.time()
        name = evidence.company_name
        ticker = evidence.ticker
        rec = evidence.recommendation
        score = evidence.technical_score

        summary = (
            f"Quantitative research summary for {name} ({ticker}). "
            f"The deterministic scoring engine has calculated an overall technical score of {score:.1f}/100 "
            f"and issued a {rec} rating based on systematic factor alignments across 80+ indicator metrics."
        )

        thesis = SectionWithEvidence(
            text=(
                f"The investment thesis for {name} is governed by its current location in a {evidence.market_regime} market regime. "
                f"Price action is interacting with key pivot boundaries, with systematic beta at {evidence.market_context.get('stock_beta', 1.0):.2f} "
                f"and benchmark correlation at {evidence.market_context.get('stock_correlation', 0.7):.2f}. "
                f"Indicator structure supports a {rec} bias with quantitative confidence at {evidence.confidence:.1f}%."
            ),
            evidence=["technical_score", "market_regime", "stock_beta", "stock_correlation", "confidence"]
        )

        # Bullish factors with evidence (Deduplicated & Ranked)
        bull_factors = []
        seen_bull = set()

        for f in evidence.positive_contributors:
            clean_t = f.split("(")[0].strip()
            if clean_t and clean_t not in seen_bull and len(bull_factors) < 5:
                seen_bull.add(clean_t)
                bull_factors.append(FactorEvidenceModel(
                    title=clean_t,
                    explanation=f"Systematic quantitative evidence: {f}",
                    evidence=["positive_contributors", "trend_score"]
                ))

        if "Strong Trend Structure" not in seen_bull and evidence.category_scores.get("trend", 0) >= 55 and len(bull_factors) < 5:
            seen_bull.add("Strong Trend Structure")
            bull_factors.append(FactorEvidenceModel(
                title="Strong Trend Structure",
                explanation=f"Uptrend momentum sustained with trend quality score of {evidence.category_scores.get('trend', 0):.0f}/100.",
                evidence=["trend_score"]
            ))

        if "Institutional Volume Accumulation" not in seen_bull and evidence.category_scores.get("volume", 0) >= 55 and len(bull_factors) < 5:
            seen_bull.add("Institutional Volume Accumulation")
            bull_factors.append(FactorEvidenceModel(
                title="Institutional Volume Accumulation",
                explanation=f"Institutional buying interest confirmed with volume score of {evidence.category_scores.get('volume', 0):.0f}/100.",
                evidence=["volume_score"]
            ))

        if "Benchmark Outperformance" not in seen_bull and evidence.category_scores.get("relative_strength", 0) >= 55 and len(bull_factors) < 5:
            seen_bull.add("Benchmark Outperformance")
            bull_factors.append(FactorEvidenceModel(
                title="Benchmark Outperformance",
                explanation=f"Outperforming Nifty 50 benchmark with relative strength rating of {evidence.category_scores.get('relative_strength', 0):.0f}/100.",
                evidence=["relative_strength_rating"]
            ))

        if "Support Zone Holding" not in seen_bull and evidence.support_levels and len(bull_factors) < 5:
            seen_bull.add("Support Zone Holding")
            bull_factors.append(FactorEvidenceModel(
                title="Support Zone Holding",
                explanation=f"Price supported above primary demand pivot zone near {evidence.support_levels[0]:.2f}.",
                evidence=["support_levels"]
            ))

        # Bearish factors with evidence (Deduplicated & Ranked)
        bear_factors = []
        seen_bear = set()

        for f in evidence.negative_contributors:
            clean_t = f.split("(")[0].strip()
            if clean_t and clean_t not in seen_bear and len(bear_factors) < 5:
                seen_bear.add(clean_t)
                bear_factors.append(FactorEvidenceModel(
                    title=clean_t,
                    explanation=f"Systematic drag flagged: {f}",
                    evidence=["negative_contributors", "momentum_score"]
                ))

        if "Overhead Supply Resistance" not in seen_bear and evidence.resistance_levels and len(bear_factors) < 5:
            seen_bear.add("Overhead Supply Resistance")
            bear_factors.append(FactorEvidenceModel(
                title="Overhead Supply Resistance",
                explanation=f"Price headroom remains capped near key supply ceiling at {evidence.resistance_levels[0]:.2f}.",
                evidence=["resistance_levels"]
            ))

        if "Trend Deceleration" not in seen_bear and evidence.category_scores.get("trend", 50) < 45 and len(bear_factors) < 5:
            seen_bear.add("Trend Deceleration")
            bear_factors.append(FactorEvidenceModel(
                title="Trend Deceleration",
                explanation=f"Downtrend pressure active with low trend score of {evidence.category_scores.get('trend', 50):.0f}/100.",
                evidence=["trend_score"]
            ))

        if "Volume Distribution Drag" not in seen_bear and evidence.category_scores.get("volume", 50) < 45 and len(bear_factors) < 5:
            seen_bear.add("Volume Distribution Drag")
            bear_factors.append(FactorEvidenceModel(
                title="Volume Distribution Drag",
                explanation=f"Selling volume distribution flagged with volume score of {evidence.category_scores.get('volume', 50):.0f}/100.",
                evidence=["volume_score"]
            ))

        # Key risks with evidence (Deduplicated & Ranked)
        key_risks = []
        seen_risk = set()

        for r in evidence.risk_factors:
            clean_t = r.split(":")[0].strip()
            if clean_t and clean_t not in seen_risk and len(key_risks) < 5:
                seen_risk.add(clean_t)
                key_risks.append(FactorEvidenceModel(
                    title=clean_t,
                    explanation=f"Risk metric boundary: {r}",
                    evidence=["risk_factors", "volatility_score"]
                ))

        if "Benchmark Correlation Risk" not in seen_risk and len(key_risks) < 5:
            seen_risk.add("Benchmark Correlation Risk")
            key_risks.append(FactorEvidenceModel(
                title="Benchmark Correlation Risk",
                explanation=f"Systematic drawdowns in Nifty 50 will transmit volatility to price action.",
                evidence=["stock_correlation", "nifty_direction"]
            ))

        if "Overhead Supply Ceiling Risk" not in seen_risk and evidence.resistance_levels and len(key_risks) < 5:
            seen_risk.add("Overhead Supply Ceiling Risk")
            key_risks.append(FactorEvidenceModel(
                title="Overhead Supply Ceiling Risk",
                explanation=f"Rejection risk remains active near key resistance levels at {evidence.resistance_levels[0]:.2f}.",
                evidence=["resistance_levels"]
            ))

        tech_outlook = SectionWithEvidence(
            text=(
                f"Moving average horizons show Trend at {evidence.category_scores.get('trend', 50.0):.1f}/100 "
                f"and Momentum at {evidence.category_scores.get('momentum', 50.0):.1f}/100. "
                f"Detected patterns: {', '.join(evidence.detected_patterns) if evidence.detected_patterns else 'None'}."
            ),
            evidence=["trend_score", "momentum_score", "detected_patterns"]
        )

        st_outlook = SectionWithEvidence(
            text=(
                f"Tactical short-term (1-5 days) bias is {rec} with active signal agreement: "
                f"{evidence.signal_agreement.get('bullish_signals', 0)} bullish vs {evidence.signal_agreement.get('bearish_signals', 0)} bearish indicators."
            ),
            evidence=["signal_agreement", "positive_contributors"]
        )

        mt_outlook = SectionWithEvidence(
            text=(
                f"Strategic medium-term (1-3 months) outlook depends on holding support levels near {evidence.support_levels[0] if evidence.support_levels else 'pivot'}. "
                f"Relative strength rating stands at {evidence.market_context.get('relative_strength_rating', 50.0):.1f}/100."
            ),
            evidence=["support_levels", "relative_strength_rating"]
        )

        action_plan = SectionWithEvidence(
            text=(
                f"Execution Strategy: {evidence.strategy.get('entry', 'N/A')}. "
                f"Stop Loss: {evidence.strategy.get('stop_loss', 'N/A')}. "
                f"Targets: {evidence.strategy.get('target_1', 'N/A')} / {evidence.strategy.get('target_2', 'N/A')}. "
                f"Holding Horizon: {evidence.strategy.get('holding_period', '1-3 Months')}."
            ),
            evidence=["strategy_entry", "strategy_stop_loss", "strategy_targets"]
        )

        strategy_obj = TradingStrategyModel(
            entry=evidence.strategy.get("entry", "N/A"),
            stop_loss=evidence.strategy.get("stop_loss", "N/A"),
            target_1=evidence.strategy.get("target_1", "N/A"),
            target_2=evidence.strategy.get("target_2", "N/A"),
            expected_holding_period=evidence.strategy.get("holding_period", "1-3 Months")
        )

        disclaimer = (
            "This report is generated strictly for informational and educational purposes by an automated quantitative analysis engine. "
            "It does not constitute financial advice, an offer to buy or sell securities, or a personalized investment recommendation."
        )

        report_model = AIResearchReportModel(
            executive_summary=summary,
            investment_thesis=thesis,
            bull_case=bull_factors,
            bear_case=bear_factors,
            key_risks=key_risks,
            technical_outlook=tech_outlook,
            short_term_outlook=st_outlook,
            medium_term_outlook=mt_outlook,
            action_plan=action_plan,
            disclaimer=disclaimer,
            trading_strategy=strategy_obj,
            recommendation_explanation=f"Deterministic rating: {rec} (Score: {score:.1f}/100, Confidence: {evidence.confidence:.1f}%).",
            final_verdict=f"Strict risk boundaries must be maintained. Final Rating: {rec}."
        )

        elapsed_ms = round((time.time() - t0) * 1000, 2)
        report_dict = report_model.model_dump()
        report_dict["metadata"] = {
            "model": "rule_based_fallback",
            "prompt_version": PROMPT_VERSION,
            "generated_at": datetime.now().isoformat(),
            "cached": False,
            "response_time_ms": elapsed_ms,
            "token_usage": None,
            "fallback_reason": fallback_reason
        }
        return report_dict
