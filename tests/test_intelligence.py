import pytest
import json
from fastapi.testclient import TestClient

from intelligence import (
    EvidencePack, PromptBuilder, PROMPT_VERSION,
    AIResearchReportModel, SectionWithEvidence, FactorEvidenceModel,
    LLMProvider, GeminiProvider, MockProvider,
    LLMKeyMissingError, LLMJSONParseError, LLMProviderError,
    InMemoryLLMCache, ReportGenerator
)
from api.api import create_app

@pytest.fixture
def sample_evidence_pack():
    return EvidencePack(
        ticker="RELIANCE.NS",
        company_name="Reliance Industries",
        price=2500.0,
        recommendation="BUY",
        confidence=82.5,
        technical_score=76.4,
        market_regime="trending",
        signal_agreement={"bullish_signals": 7, "bearish_signals": 2, "consensus_strength": 77.8},
        category_scores={"trend": 80.0, "momentum": 72.0, "volume": 68.0, "volatility": 75.0},
        positive_contributors=["Strong SMA200 Alignment", "RSI Bullish Momentum"],
        negative_contributors=["Overhead Supply Resistance"],
        neutral_factors=["Sideways VIX"],
        support_levels=[2450.0, 2400.0],
        resistance_levels=[2580.0, 2620.0],
        detected_patterns=["Double Bottom", "Bullish Engulfing"],
        risk_factors=["Annualized Volatility: 22.5%"],
        trend_summary="Strong upward momentum",
        market_context={"nifty": {"direction": "BULLISH", "strength": 70}},
        strategy={"entry": "Market Entry at 2500.0", "stop_loss": "2350.0", "target_1": "2700.0", "target_2": "2850.0", "holding_period": "1-3 Months"},
        timeframe="1d",
        latest_candle_timestamp="2026-07-23T15:30:00"
    )


def test_prompt_builder(sample_evidence_pack):
    builder = PromptBuilder()
    prompt = builder.build_prompt(sample_evidence_pack)
    
    assert "RELIANCE.NS" in prompt
    assert "Reliance Industries" in prompt
    assert "2500.0" in prompt
    assert "BUY" in prompt
    assert "76.4" in prompt
    assert "INSTITUTIONAL RESEARCH GROUNDING DIRECTIVES" in prompt
    assert "EVIDENCE ATTRIBUTION REQUIREMENT" in prompt


def test_schema_validation_and_parsing():
    sample_json = {
        "executive_summary": "Executive summary test.",
        "investment_thesis": {"text": "Thesis text", "evidence": ["trend_score"]},
        "bull_case": [{"title": "Bull 1", "explanation": "Bull explanation", "evidence": ["rsi"]}],
        "bear_case": [{"title": "Bear 1", "explanation": "Bear explanation", "evidence": ["resistance"]}],
        "key_risks": [{"title": "Risk 1", "explanation": "Risk explanation", "evidence": ["vix"]}],
        "technical_outlook": {"text": "Outlook text", "evidence": ["sma"]},
        "short_term_outlook": {"text": "Short outlook", "evidence": ["macd"]},
        "medium_term_outlook": {"text": "Medium outlook", "evidence": ["rs"]},
        "action_plan": {"text": "Action text", "evidence": ["entry"]},
        "disclaimer": "Disclaimer text"
    }
    
    model = AIResearchReportModel.model_validate(sample_json)
    assert model.executive_summary == "Executive summary test."
    assert model.investment_thesis.text == "Thesis text"
    assert "trend_score" in model.investment_thesis.evidence
    assert len(model.bull_case) == 1
    assert model.bull_case[0].title == "Bull 1"


def test_mock_provider():
    provider = MockProvider()
    res = provider.generate("Test prompt")
    
    assert isinstance(res, dict)
    assert "executive_summary" in res
    assert "investment_thesis" in res
    assert "bull_case" in res


def test_gemini_provider_missing_key(sample_evidence_pack):
    # Test GeminiProvider behavior with empty API key
    provider = GeminiProvider(api_key="")
    
    with pytest.raises(LLMKeyMissingError):
        provider.generate("Test prompt")

    # Verify fallback generator creates valid report
    fallback = provider.generate_fallback_report(sample_evidence_pack, fallback_reason="No API key test")
    assert fallback["executive_summary"] is not None
    assert "Reliance Industries" in fallback["executive_summary"]
    assert fallback["metadata"]["model"] == "rule_based_fallback"


def test_cache_timestamp_key(sample_evidence_pack):
    cache = InMemoryLLMCache()
    
    ai_report = {
        "executive_summary": "Cached report",
        "investment_thesis": {"text": "Cached thesis", "evidence": ["trend"]},
        "bull_case": [], "bear_case": [], "key_risks": [],
        "technical_outlook": {"text": "", "evidence": []},
        "short_term_outlook": {"text": "", "evidence": []},
        "medium_term_outlook": {"text": "", "evidence": []},
        "action_plan": {"text": "", "evidence": []},
        "disclaimer": ""
    }
    
    # Store report
    cache.set_cached_report("RELIANCE.NS", "1d", "2026-07-23T15:30:00", sample_evidence_pack, ai_report)
    
    # Retrieval hit
    cached = cache.get_cached_report("RELIANCE.NS", "1d", "2026-07-23T15:30:00", sample_evidence_pack)
    assert cached is not None
    assert cached["metadata"]["cached"] is True
    
    # Key miss with different timestamp
    miss = cache.get_cached_report("RELIANCE.NS", "1d", "2026-07-24T15:30:00", sample_evidence_pack)
    assert miss is None


def test_report_generator_orchestrator(sample_evidence_pack):
    provider = MockProvider()
    builder = PromptBuilder()
    cache = InMemoryLLMCache()
    generator = ReportGenerator(provider=provider, prompt_builder=builder, cache=cache)
    
    dummy_analysis = {
        "ticker": "RELIANCE.NS",
        "company_name": "Reliance Industries",
        "scores": {"recommendation": "BUY", "overall_score": 76.4, "confidence": 82.5},
        "risk_profile": {"annualized_volatility": 22.5, "atr_percentage": 2.1, "level": "Low"},
        "market_context": {"nifty": {"direction": "BULLISH", "strength": 70}},
        "positive_factors": ["SMA200 Breakout"],
        "negative_factors": ["Resistance"],
        "neutral_factors": [],
        "chart_data": {"close": [2500.0], "dates": ["2026-07-23T15:30:00"]},
        "support_zones": [{"upper_bound": 2460.0, "lower_bound": 2440.0, "touches": 3}],
        "resistance_zones": [{"upper_bound": 2590.0, "lower_bound": 2570.0, "touches": 4}],
        "patterns": []
    }
    
    report = generator.generate_report("RELIANCE.NS", "1d", dummy_analysis)
    assert report is not None
    assert "executive_summary" in report
    assert "investment_thesis" in report


def test_intelligence_api_endpoint():
    app = create_app()
    client = TestClient(app)
    
    payload = {
        "ticker": "RELIANCE.NS",
        "timeframe": "1d",
        "analysis_report": {
            "ticker": "RELIANCE.NS",
            "company_name": "Reliance Industries",
            "scores": {"recommendation": "BUY", "overall_score": 76.4, "confidence": 82.5},
            "risk_profile": {"annualized_volatility": 22.5, "atr_percentage": 2.1, "level": "Low"},
            "market_context": {"nifty": {"direction": "BULLISH", "strength": 70}},
            "positive_factors": ["SMA200 Breakout"],
            "negative_factors": ["Resistance"],
            "neutral_factors": [],
            "chart_data": {"close": [2500.0], "dates": ["2026-07-23T15:30:00"]},
            "support_zones": [{"upper_bound": 2460.0, "lower_bound": 2440.0, "touches": 3}],
            "resistance_zones": [{"upper_bound": 2590.0, "lower_bound": 2570.0, "touches": 4}],
            "patterns": []
        }
    }
    
    response = client.post("/intelligence/report", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "ai_research_report" in data
    assert data["ai_research_report"]["executive_summary"] is not None
