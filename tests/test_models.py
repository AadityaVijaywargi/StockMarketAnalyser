import pytest
from pydantic import ValidationError
from analysis.models import PatternDetection, SupportResistanceLevel, TechnicalScores, ScoreComponent

def test_pattern_detection_validation():
    """Verify confidence score limits in PatternDetection."""
    # Valid model
    pd = PatternDetection(
        pattern_name="Hammer",
        confidence_score=0.85,
        start_date="2026-07-21",
        end_date="2026-07-22",
        supporting_evidence={"volume_mult": 1.2},
        pattern_direction="BULLISH",
        pattern_status="Confirmed"
    )
    assert pd.pattern_name == "Hammer"
    assert pd.confidence_score == 0.85
    
    # Invalid confidence score > 1.0
    with pytest.raises(ValidationError):
        PatternDetection(
            pattern_name="Hammer",
            confidence_score=1.5,
            start_date="2026-07-21",
            end_date="2026-07-22",
            pattern_direction="BULLISH",
            pattern_status="Confirmed"
        )
        
    # Invalid confidence score < 0.0
    with pytest.raises(ValidationError):
        PatternDetection(
            pattern_name="Hammer",
            confidence_score=-0.1,
            start_date="2026-07-21",
            end_date="2026-07-22",
            pattern_direction="BULLISH",
            pattern_status="Confirmed"
        )


def test_support_resistance_level_validation():
    """Verify bounds for SupportResistanceLevel."""
    # Valid
    sr = SupportResistanceLevel(
        price=1500.50,
        strength=0.75,
        touches=3,
        level_type="support",
        timeframe="6M"
    )
    assert sr.price == 1500.50
    assert sr.strength == 0.75
    
    # Invalid strength
    with pytest.raises(ValidationError):
        SupportResistanceLevel(
            price=1500.50,
            strength=1.2,
            touches=3,
            level_type="support",
            timeframe="6M"
        )


def test_technical_scores_validation():
    """Verify range checking for technical scores."""
    # Valid
    scores = TechnicalScores(
        trend=ScoreComponent(value=85.0, weight=0.25, contribution=21.25),
        momentum=ScoreComponent(value=70.0, weight=0.20, contribution=14.0),
        volume=ScoreComponent(value=60.0, weight=0.15, contribution=9.0),
        volatility=ScoreComponent(value=80.0, weight=0.05, contribution=4.0),
        pattern=ScoreComponent(value=90.0, weight=0.15, contribution=13.5),
        support=ScoreComponent(value=80.0, weight=0.10, contribution=8.0),
        resistance=ScoreComponent(value=70.0, weight=0.10, contribution=7.0),
        market=ScoreComponent(value=60.0, weight=0.0, contribution=0.0),
        sector=ScoreComponent(value=70.0, weight=0.0, contribution=0.0),
        risk=ScoreComponent(value=30.0, weight=0.0, contribution=0.0),
        overall_score=76.75,
        recommendation="WATCH"
    )
    assert scores.overall_score == 76.75
    assert scores.recommendation == "WATCH"

    # Invalid score component value > 100
    with pytest.raises(ValidationError):
        TechnicalScores(
            trend=ScoreComponent(value=105.0, weight=0.25, contribution=21.25),
            momentum=ScoreComponent(value=70.0, weight=0.20, contribution=14.0),
            volume=ScoreComponent(value=60.0, weight=0.15, contribution=9.0),
            volatility=ScoreComponent(value=80.0, weight=0.05, contribution=4.0),
            pattern=ScoreComponent(value=90.0, weight=0.15, contribution=13.5),
            support=ScoreComponent(value=80.0, weight=0.10, contribution=8.0),
            resistance=ScoreComponent(value=70.0, weight=0.10, contribution=7.0),
            market=ScoreComponent(value=60.0, weight=0.0, contribution=0.0),
            sector=ScoreComponent(value=70.0, weight=0.0, contribution=0.0),
            risk=ScoreComponent(value=30.0, weight=0.0, contribution=0.0),
            overall_score=76.75,
            recommendation="WATCH"
        )
