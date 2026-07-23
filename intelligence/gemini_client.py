import time
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from google import genai
from google.genai import types
from google.genai.errors import APIError

from config.settings import settings
from intelligence.schemas import AIResearchReportModel, AIMetadataModel, TradingStrategyModel, FactorEvidenceModel
from intelligence.prompt_builder import PROMPT_VERSION

logger = logging.getLogger("AIEquityResearchPlatform")

class GeminiClient:
    """
    Client wrapper for the Google Gemini API using the new google-genai SDK.
    Enforces strict Pydantic JSON schema generation and implements robust graceful fallbacks.
    """
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL
        self.temperature = getattr(settings, "GEMINI_TEMPERATURE", 0.1)
        self.max_tokens = getattr(settings, "GEMINI_MAX_OUTPUT_TOKENS", 2048)
        self.timeout = getattr(settings, "GEMINI_TIMEOUT_SECONDS", 30)
        
        # Initialize client if API key is provided
        self.client = None
        if self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.error(f"Failed to initialize Gemini Client: {e}")

    def generate_research_report(self, prompt: str, evidence: Any) -> Dict[str, Any]:
        """
        Queries Gemini for a structured analyst report.
        Falls back to programmatic generation if client is uninitialized, key is missing, or query errors.
        """
        t0 = time.time()
        
        if not self.client:
            logger.warning("Gemini Client uninitialized (missing API Key). Routing to fallback generation.")
            return self._generate_fallback_report(evidence, t0, "fallback_no_api_key")

        try:
            # Query the model using Pydantic schema constraints
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=self.temperature,
                    max_output_tokens=self.max_tokens,
                    response_mime_type="application/json",
                    response_schema=AIResearchReportModel,
                )
            )
            
            elapsed = (time.time() - t0) * 1000
            
            # Parse the response text as a dict and append metadata
            import json
            report_dict = json.loads(response.text)
            
            # Inject metadata schema
            report_dict["metadata"] = {
                "model": self.model_name,
                "prompt_version": PROMPT_VERSION,
                "generated_at": datetime.now().isoformat(),
                "cached": False,
                "response_time_ms": round(elapsed, 2),
                "token_usage": {
                    "input_tokens": response.usage_metadata.prompt_token_count if response.usage_metadata else 0,
                    "output_tokens": response.usage_metadata.candidates_token_count if response.usage_metadata else 0
                }
            }
            logger.info(f"Successfully generated Gemini research report for {evidence.ticker} in {elapsed:.1f}ms")
            return report_dict

        except APIError as api_err:
            logger.error(f"Gemini API Error occurred: {api_err}. Routing to fallback.")
            return self._generate_fallback_report(evidence, t0, f"fallback_api_error: {str(api_err)}")
        except Exception as e:
            logger.error(f"Failed to run Gemini content generation: {e}. Routing to fallback.")
            return self._generate_fallback_report(evidence, t0, f"fallback_general_error: {str(e)}")

    def _generate_fallback_report(self, evidence: Any, t_start: float, fallback_reason: str) -> Dict[str, Any]:
        """
        Generates a gracefully formatted, deterministic, rule-based research report.
        Guarantees that frontend rendering remains stable and unbroken even if Gemini fails.
        """
        elapsed = (time.time() - t_start) * 1000
        
        name = evidence.company_name
        rec = evidence.recommendation
        score = evidence.technical_score
        
        # Build programmatic text summaries
        summary = (
            f"Automated quantitative summary for {name} ({evidence.ticker}). "
            f"Our deterministic scoring engine has calculated a weighted score of {score:.1f}/100 "
            f"and issued a {rec} recommendation based on systematic alignments."
        )
        
        thesis = (
            f"The investment thesis for {name} is governed by its current position in a {evidence.market_regime} market regime. "
            f"Price action is interacting with historical pivot levels. Systematic beta stands at {evidence.market_context.get('stock_beta', 1.0):.2f} "
            f"with a Nifty correlation of {evidence.market_context.get('stock_correlation', 0.7):.2f}. "
            f"Indicators suggest a {rec.lower()} structure with confidence levels at {evidence.confidence:.1f}%."
        )
        
        rec_exp = (
            f"The {rec} recommendation is determined strictly by indicator convergence. "
            f"Trend indicators score {evidence.category_scores.get('trend', 50.0):.1f}/100 and Momentum "
            f"is at {evidence.category_scores.get('momentum', 50.0):.1f}/100. High-risk beta drag or resistance ceiling proximity "
            f"modulates the final action boundaries."
        )
        
        # Build Bullish Factors
        bull_factors = []
        for i, f in enumerate(evidence.positive_contributors[:5]):
            bull_factors.append(FactorEvidenceModel(
                title=f"Supportive Factor {i+1}: {f}",
                explanation=f"A positive trend alignment is confirmed by '{f}' aligning with bullish demand parameters.",
                evidence=["positive_contributors"]
            ))
        while len(bull_factors) < 5:
            idx = len(bull_factors) + 1
            bull_factors.append(FactorEvidenceModel(
                title=f"Supportive Factor {idx}: Trend Strength",
                explanation=f"Price remains supported above key pivot zones, maintaining raw structure.",
                evidence=["category_scores"]
            ))
            
        # Build Bearish Factors
        bear_factors = []
        for i, f in enumerate(evidence.negative_contributors[:5]):
            bear_factors.append(FactorEvidenceModel(
                title=f"Risk Factor {i+1}: {f}",
                explanation=f"An active risk structure is flagged by '{f}' acting as systematic drag or overhead ceiling.",
                evidence=["negative_contributors"]
            ))
        while len(bear_factors) < 5:
            idx = len(bear_factors) + 1
            bear_factors.append(FactorEvidenceModel(
                title=f"Risk Factor {idx}: Proximity Resistance",
                explanation=f"Price headroom remains capped near resistance ceiling bands.",
                evidence=["resistance_levels"]
            ))
            
        strategy = TradingStrategyModel(
            entry=evidence.strategy.get("entry", "N/A"),
            stop_loss=evidence.strategy.get("stop_loss", "N/A"),
            target_1=evidence.strategy.get("target_1", "N/A"),
            target_2=evidence.strategy.get("target_2", "N/A"),
            expected_holding_period=evidence.strategy.get("holding_period", "1-3 Months")
        )
        
        report = AIResearchReportModel(
            executive_summary=summary,
            investment_thesis=thesis,
            recommendation_explanation=rec_exp,
            bullish_factors=bull_factors,
            bearish_factors=bear_factors,
            technical_outlook=f"Moving averages show Trend at {evidence.category_scores.get('trend', 50.0):.1f}/100 and patterns are neutral.",
            market_context=f"Indices show Nifty Trend as {evidence.market_context.get('nifty', {}).get('direction', 'SIDEWAYS')} and VIX is normal.",
            risk_assessment=f"Volatility ATR stands at {evidence.risk_factors[0] if evidence.risk_factors else 'N/A'}.",
            trading_strategy=strategy,
            invalidation_conditions="Thesis is invalidated if price drops below stop loss boundaries on heavy volume.",
            final_verdict=f"Strict WATCH/AVOID stop boundaries must be maintained. Final Rating: {rec}."
        )
        
        report_dict = report.model_dump()
        report_dict["metadata"] = {
            "model": "rule_based_fallback",
            "prompt_version": PROMPT_VERSION,
            "generated_at": datetime.now().isoformat(),
            "cached": False,
            "response_time_ms": round(elapsed, 2),
            "token_usage": None,
            "fallback_reason": fallback_reason
        }
        
        logger.info(f"Generated graceful fallback report for {evidence.ticker} in {elapsed:.1f}ms")
        return report_dict
