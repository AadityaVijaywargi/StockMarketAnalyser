import pytest
import time
from unittest.mock import MagicMock
from intelligence.schemas import EvidencePack, AIResearchReportModel
from intelligence.prompt_builder import PromptBuilder, PROMPT_VERSION
from intelligence.cache import LLMResponseCache
from intelligence.gemini_client import GeminiClient
from intelligence.report_generator import ReportGenerator

@pytest.fixture
def dummy_report():
    return {
        "ticker": "RELIANCE.NS",
        "company_name": "Reliance Industries Limited",
        "analysis_date": "2026-07-23",
        "scores": {
            "overall_score": 78.5,
            "recommendation": "BUY",
            "confidence": 85.0,
            "trend": {"value": 85.0, "weight": 0.3, "contribution": 25.5},
            "momentum": {"value": 75.0, "weight": 0.15, "contribution": 11.25},
            "volume": {"value": 70.0, "weight": 0.15, "contribution": 10.5},
            "volatility": {"value": 80.0, "weight": 0.1, "contribution": 8.0},
            "sector": {"value": 80.0, "weight": 0.1, "contribution": 8.0},
            "support": {"value": 85.0, "weight": 0.1, "contribution": 8.5},
            "resistance": {"value": 65.0, "weight": 0.1, "contribution": 6.5},
            "pattern": {"value": 60.0, "weight": 0.05, "contribution": 3.0},
        },
        "risk_profile": {
            "level": "Moderate",
            "atr_percentage": 2.1,
            "annualized_volatility": 22.4,
            "vix_regime": "Normal",
            "liquidity_score": 90
        },
        "market_context": {
            "nifty": {"symbol": "^NSEI", "direction": "BULLISH", "strength": 80.0, "momentum": 75.0},
            "bank_nifty": {"symbol": "^NSEBANK", "direction": "SIDEWAYS", "strength": 60.0, "momentum": 55.0},
            "vix": {"vix_value": 14.5, "percentile": 35.0, "regime": "Normal"},
            "sector": {
                "sector_name": "NIFTY ENERGY",
                "sector_symbol": "CNG",
                "direction": "BULLISH",
                "strength": 85.0,
                "relative_strength_vs_nifty": 1.12,
                "sector_momentum": 80.0
            },
            "stock_beta": 1.15,
            "stock_correlation": 0.78,
            "relative_strength_rating": 82.0,
            "relative_strength_line": [1.0, 1.02, 1.05]
        },
        "positive_factors": ["Above EMA200", "RSI Momentum Support", "Golden Cross"],
        "negative_factors": ["Proximity Overhead Resistance"],
        "neutral_factors": [],
        "chart_data": {
            "dates": ["2026-07-21", "2026-07-22", "2026-07-23"],
            "open": [2450.0, 2462.0, 2470.0],
            "high": [2475.0, 2480.0, 2490.0],
            "low": [2440.0, 2455.0, 2465.0],
            "close": [2465.0, 2472.0, 2485.0],
            "volume": [1200000, 1350000, 1500000],
            "moving_averages": {},
            "support_lines": [],
            "resistance_lines": [],
            "patterns_coordinates": []
        },
        "patterns": [
            {"pattern_name": "Double Bottom", "start_date": "2026-07-10", "end_date": "2026-07-20", "confidence_score": 85.0, "supporting_evidence": {}, "key_price_levels": [2400.0], "pattern_direction": "BULLISH", "pattern_status": "Confirmed"}
        ],
        "support_zones": [
            {"upper_bound": 2420.0, "lower_bound": 2400.0, "strength": 4, "touches": 5, "average_volume": 1200000, "first_detection": "2026-07-01", "last_confirmation": "2026-07-20", "level_type": "support"}
        ],
        "resistance_zones": [
            {"upper_bound": 2500.0, "lower_bound": 2490.0, "strength": 3, "touches": 4, "average_volume": 1100000, "first_detection": "2026-07-05", "last_confirmation": "2026-07-21", "level_type": "resistance"}
        ],
        "metadata": {
            "timings": {"fetch_ms": 200, "indicators_ms": 50},
            "scoring_explanation": {
                "regime": "trending",
                "signal_agreement": {"bullish_signals": 6, "bearish_signals": 1}
            }
        }
    }


def test_evidence_pack_generation(dummy_report):
    client = GeminiClient()
    prompt_builder = PromptBuilder()
    cache = LLMResponseCache()
    generator = ReportGenerator(client=client, prompt_builder=prompt_builder, cache=cache)
    
    evidence = generator._create_evidence_pack("RELIANCE.NS", dummy_report)
    
    assert isinstance(evidence, EvidencePack)
    assert evidence.ticker == "RELIANCE.NS"
    assert evidence.price == 2485.0
    assert evidence.recommendation == "BUY"
    assert evidence.confidence == 85.0
    assert evidence.technical_score == 78.5
    assert evidence.market_regime == "trending"
    assert "Double Bottom" in evidence.detected_patterns
    assert len(evidence.support_levels) == 1
    assert len(evidence.resistance_levels) == 1
    assert "entry" in evidence.strategy


def test_prompt_builder_structure(dummy_report):
    prompt_builder = PromptBuilder()
    client = GeminiClient()
    generator = ReportGenerator(client=client, prompt_builder=prompt_builder, cache=MagicMock())
    
    evidence = generator._create_evidence_pack("RELIANCE.NS", dummy_report)
    prompt = prompt_builder.build_prompt(evidence)
    
    assert "RELIANCE.NS" in prompt
    assert "Reliance Industries Limited" in prompt
    assert "2485.0" in prompt
    assert "BUY" in prompt
    assert "ANALYST GROUNDING INSTRUCTIONS:" in prompt
    assert f"v{PROMPT_VERSION}" in prompt or PROMPT_VERSION in prompt


def test_response_cache_invalidation(dummy_report):
    cache = LLMResponseCache()
    client = GeminiClient()
    prompt_builder = PromptBuilder()
    generator = ReportGenerator(client=client, prompt_builder=prompt_builder, cache=cache)
    
    evidence = generator._create_evidence_pack("RELIANCE.NS", dummy_report)
    mock_ai_report = {"executive_summary": "Test Summary"}
    
    # Check set and hit
    cache.set_cached_report("RELIANCE.NS", "1d", evidence, mock_ai_report)
    hit = cache.get_cached_report("RELIANCE.NS", "1d", evidence)
    assert hit == mock_ai_report
    
    # Check invalidation due to score shift
    modified_evidence = evidence.model_copy(update={"technical_score": 85.0}) # Shift of 6.5 (> 5.0)
    hit_invalid = cache.get_cached_report("RELIANCE.NS", "1d", modified_evidence)
    assert hit_invalid is None


def test_gemini_client_fallback_mode(dummy_report):
    # Gemini client with uninitialized api_key redirects to fallback report
    client = GeminiClient()
    assert client.client is None
    
    prompt_builder = PromptBuilder()
    generator = ReportGenerator(client=client, prompt_builder=prompt_builder, cache=MagicMock())
    evidence = generator._create_evidence_pack("RELIANCE.NS", dummy_report)
    
    report_dict = client.generate_research_report("Hello", evidence)
    
    assert report_dict["metadata"]["model"] == "rule_based_fallback"
    assert "Test Summary" not in report_dict["executive_summary"]
    assert report_dict["executive_summary"].startswith("Automated quantitative summary")
    assert len(report_dict["bullish_factors"]) == 5
    assert report_dict["trading_strategy"]["entry"].startswith("Market Entry")
    
    # Enforce Pydantic schema validation for fallback
    parsed = AIResearchReportModel(**report_dict)
    assert parsed.trading_strategy.entry is not None
