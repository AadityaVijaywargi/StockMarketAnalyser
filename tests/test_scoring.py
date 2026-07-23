import pytest
import pandas as pd
import numpy as np
from market.vix_analysis import analyze_vix
from market.sector_analysis import calculate_beta_correlation, calculate_relative_strength
from analysis.scoring import RuleBasedScorer
from analysis.models.reports import DeterministicAnalysisReport
from analysis.support_resistance import SRZone
from analysis.models.patterns import PatternDetection
from analysis.chart_data import build_chart_data

def test_vix_regime_classification():
    """Verify VIX thresholds assign the correct volatility regime."""
    # Scenario 1: Low VIX (< 13)
    df_low = pd.DataFrame({"Close": [11.5, 12.0, 11.8]})
    res_low = analyze_vix(df_low)
    assert res_low["regime"] == "Low"

    # Scenario 2: Normal VIX (13-18)
    df_norm = pd.DataFrame({"Close": [14.5, 15.2, 14.8]})
    res_norm = analyze_vix(df_norm)
    assert res_norm["regime"] == "Normal"

    # Scenario 3: Elevated VIX (18-25)
    df_elev = pd.DataFrame({"Close": [20.0, 21.5, 22.0]})
    res_elev = analyze_vix(df_elev)
    assert res_elev["regime"] == "Elevated"

    # Scenario 4: Extreme VIX (>= 25)
    df_extr = pd.DataFrame({"Close": [28.0, 31.0, 29.5]})
    res_extr = analyze_vix(df_extr)
    assert res_extr["regime"] == "Extreme"


def test_beta_correlation_calculation():
    """Verify mathematical output of beta and correlation calculations."""
    stock = pd.DataFrame({"Close": [10.0, 10.2, 10.4, 10.1, 10.3]})
    nifty = pd.DataFrame({"Close": [100.0, 101.0, 102.0, 100.5, 101.5]})
    
    beta, corr = calculate_beta_correlation(stock, nifty)
    assert isinstance(beta, float)
    assert isinstance(corr, float)
    assert -1.0 <= corr <= 1.0


def test_relative_strength():
    """Verify relative strength line series and rating percentile outputs."""
    stock = pd.DataFrame({"Close": [10.0, 10.5, 11.0]})
    nifty = pd.DataFrame({"Close": [100.0, 100.0, 100.0]}) # Nifty flat, stock rising (RS rising)
    
    rs, rating, line = calculate_relative_strength(stock, nifty)
    assert rs > 0.0
    assert 0.0 <= rating <= 100.0
    assert len(line) == 3


def test_scoring_weights_contributions():
    """Verify that score contributions are weighted correctly and sum to overall score."""
    scorer = RuleBasedScorer()
    
    # Create mock features dataframe
    dates = pd.date_range("2026-07-01", periods=20)
    df = pd.DataFrame({
        "Close": [100.0] * 20,
        "High": [101.0] * 20,
        "Low": [99.0] * 20,
        "Volume": [1000] * 20,
        "Relative_Volume": [1.0] * 20,
        "RSI_14": [50.0] * 20,
        "Hist_Vol_20": [20.0] * 20,
        "ATR_14": [2.0] * 20
    }, index=dates)
    
    # Mock market context
    market_context = {
        "nifty": {"direction": "BULLISH", "strength": 75.0, "momentum": 55.0},
        "vix": {"vix_value": 15.0, "percentile": 50.0, "regime": "Normal"},
        "sector": {"direction": "BULLISH", "strength": 80.0, "relative_strength_vs_nifty": 1.2, "sector_momentum": 60.0},
        "relative_strength_rating": 85.0
    }
    
    scores, risk, pos, neg, neu = scorer.calculate_scores(df, market_context)
    
    # Verify overall score is weighted sum
    risk_penalty = scorer._reasoning_context["risk_penalties"]["total_penalty"] if hasattr(scorer, "_reasoning_context") else 0.0
    expected_sum = (
        scores.trend.contribution +
        scores.momentum.contribution +
        scores.volume.contribution +
        scores.volatility.contribution +
        scores.pattern.contribution +
        scores.support.contribution +
        scores.resistance.contribution +
        scores.sector.contribution
    )
    assert abs((scores.overall_score + risk_penalty) - expected_sum) < 1.0
    
    # Verify risk profiles are set
    assert risk.level in ["Low", "Moderate", "High", "Very High"]
    assert len(pos) >= 0
    assert len(neg) >= 0
    assert len(neu) >= 0


def test_analysis_report_json_schema():
    """Verifies that final structured JSON conforms to DeterministicAnalysisReport schema."""
    dates = pd.date_range("2026-07-01", periods=10)
    df = pd.DataFrame({
        "Open": [100.0] * 10,
        "High": [101.0] * 10,
        "Low": [99.0] * 10,
        "Close": [100.0] * 10,
        "Volume": [1000] * 10,
        "Relative_Volume": [1.0] * 10,
        "RSI_14": [50.0] * 10,
        "Hist_Vol_20": [20.0] * 10,
        "ATR_14": [2.0] * 10
    }, index=dates)
    
    # Generate S/R zones and chart data
    support = [
        SRZone(upper_bound=95.0, lower_bound=94.0, strength=0.8, touches=3, average_volume=1000.0, first_detection="2026-07-01", last_confirmation="2026-07-10", level_type="support")
    ]
    resistance = [
        SRZone(upper_bound=105.0, lower_bound=104.0, strength=0.7, touches=2, average_volume=1100.0, first_detection="2026-07-02", last_confirmation="2026-07-09", level_type="resistance")
    ]
    patterns = [
        PatternDetection(pattern_name="Double Bottom", start_date="2026-07-01", end_date="2026-07-10", confidence_score=0.75, supporting_evidence={}, key_price_levels=[95.0, 100.0], pattern_direction="BULLISH", pattern_status="Confirmed")
    ]
    chart_payload = build_chart_data(df, support, resistance, patterns)
    
    # Mock models
    from analysis.models.market import IndexTrendModel, VolatilityContextModel, SectorAnalysisModel, MarketContextModel
    nifty = IndexTrendModel(symbol="^NSEI", direction="BULLISH", strength=75.0, momentum=55.0)
    bank_nifty = IndexTrendModel(symbol="^NSEBANK", direction="BULLISH", strength=80.0, momentum=60.0)
    vix = VolatilityContextModel(vix_value=15.0, percentile=50.0, regime="Normal")
    sector = SectorAnalysisModel(sector_name="IT", sector_symbol="^CNXIT", direction="BULLISH", strength=70.0, relative_strength_vs_nifty=1.1, sector_momentum=65.0)
    
    market_context_model = MarketContextModel(
        nifty=nifty,
        bank_nifty=bank_nifty,
        vix=vix,
        sector=sector,
        stock_beta=1.05,
        stock_correlation=0.85,
        relative_strength_rating=75.0,
        relative_strength_line=[1.0, 1.01, 1.02]
    )
    
    scorer = RuleBasedScorer()
    scores, risk, pos, neg, neu = scorer.calculate_scores(df, {
        "nifty": nifty.model_dump(),
        "vix": vix.model_dump(),
        "sector": sector.model_dump(),
        "relative_strength_rating": 75.0
    })
    
    # Build complete report
    report = DeterministicAnalysisReport(
        ticker="TCS.NS",
        company_name="Tata Consultancy Services",
        analysis_date="2026-07-22",
        market_context=market_context_model,
        scores=scores,
        risk_profile=risk,
        positive_factors=pos,
        negative_factors=neg,
        neutral_factors=neu,
        chart_data=chart_payload,
        patterns=patterns,
        support_zones=support,
        resistance_zones=resistance
    )
    
    assert report.ticker == "TCS.NS"
    assert report.scores.overall_score >= 0.0
    assert len(report.positive_factors) >= 0


def test_upgraded_scoring_engine_details():
    """Tests new features of the upgraded scoring engine: signal agreement, regimes, and risk adjustments."""
    scorer = RuleBasedScorer()
    
    # 1. Create a bullish trending dataset
    dates = pd.date_range("2026-07-01", periods=20)
    df = pd.DataFrame({
        "Close": [100.0 + i for i in range(20)],
        "High": [101.0 + i for i in range(20)],
        "Low": [99.0 + i for i in range(20)],
        "Volume": [1000] * 20,
        "Relative_Volume": [1.5] * 20,
        "RSI_14": [65.0] * 20,
        "Hist_Vol_20": [15.0] * 20,
        "ATR_14": [1.5] * 20
    }, index=dates)
    
    # Mock bullish trending context
    market_context = {
        "nifty": {"direction": "BULLISH", "strength": 80.0, "momentum": 65.0},
        "vix": {"vix_value": 12.0, "percentile": 20.0, "regime": "Low"},
        "sector": {"direction": "BULLISH", "strength": 85.0, "relative_strength_vs_nifty": 1.3, "sector_momentum": 70.0},
        "relative_strength_rating": 88.0,
        "stock_beta": 1.1,
        "stock_correlation": 0.85
    }
    
    scores, risk, pos, neg, neu = scorer.calculate_scores(df, market_context)
    
    # Verify regime classified as trending
    assert scorer._reasoning_context["regime"] == "trending"
    
    # Verify confidence and recommendation are set
    assert scores.confidence >= 50.0
    assert scores.recommendation in ["BUY", "WATCH", "AVOID"]
    assert hasattr(scorer, "_reasoning_context")

