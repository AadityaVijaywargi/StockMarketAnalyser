import os
import shutil
import pytest
from fastapi.testclient import TestClient

from api.api import create_app
from intelligence.schemas import NewsArticle, KeyEvent, OverallSentiment, IntelligencePack
from intelligence.news_provider import get_news_provider, MockNewsProvider
from intelligence.news_parser import NewsParser
from intelligence.topic_classifier import TopicClassifier
from intelligence.relevance import RelevanceScorer
from intelligence.sentiment import SentimentAnalyzer
from intelligence.event_detector import EventDetector
from intelligence.news_cache import NewsCacheManager
from intelligence.market_intelligence import MarketIntelligenceEngine

app = create_app()
client = TestClient(app)
TEST_CACHE_DIR = "storage/test_news"

@pytest.fixture(autouse=True)
def setup_teardown_news_cache():
    os.makedirs(TEST_CACHE_DIR, exist_ok=True)
    yield
    if os.path.exists(TEST_CACHE_DIR):
        shutil.rmtree(TEST_CACHE_DIR)

def test_news_parser_and_topic_classifier():
    raw_payload = {
        "headline": "RELIANCE Q3 Net Profit Rises 12% to Rs 18,500 Crore",
        "summary": "Reliance Industries reported strong revenue beat driven by oil-to-chemicals and retail expansion.",
        "publisher": "Economic Times",
        "published_at": "2026-07-24T10:00:00Z",
        "url": "https://example.com/reliance-q3"
    }
    parsed = NewsParser.parse_article(raw_payload, default_ticker="RELIANCE.NS", default_company="Reliance")
    assert parsed["headline"] == "RELIANCE Q3 Net Profit Rises 12% to Rs 18,500 Crore"
    assert "RELIANCE" in parsed["entities"]
    
    topic = TopicClassifier.classify(parsed["headline"], parsed["summary"])
    assert topic == "Earnings"

def test_sentiment_analyzer():
    bull_text = "Stock surges 8% after beating q3 profit estimates and announcing dividend"
    sentiment_b, conf_b = SentimentAnalyzer.analyze(bull_text)
    assert sentiment_b == "Bullish"
    assert conf_b > 60.0

    bear_text = "Profit falls sharply as company misses estimates and faces legal investigation"
    sentiment_bear, conf_bear = SentimentAnalyzer.analyze(bear_text)
    assert sentiment_bear == "Bearish"

    articles = [
        {"sentiment": "Bullish", "sentiment_confidence": 80.0},
        {"sentiment": "Bullish", "sentiment_confidence": 90.0},
        {"sentiment": "Bearish", "sentiment_confidence": 70.0}
    ]
    summary = SentimentAnalyzer.aggregate_sentiment(articles)
    assert summary["primary_sentiment"] == "Bullish"
    assert summary["bullish_pct"] > 60.0

def test_relevance_scorer():
    rel = RelevanceScorer.calculate_relevance(
        headline="TCS Bags $500M IT Expansion Contract",
        summary="Tata Consultancy Services secures major enterprise digital transformation deal.",
        ticker="TCS.NS",
        company_name="Tata Consultancy Services",
        sector_name="IT Sector",
        topic="Earnings"
    )
    assert rel >= 70.0

def test_event_detector():
    articles = [
        {
            "headline": "INFY Announces Board Approval for Rs 9,000 Cr Buyback and Dividend Payout",
            "summary": "Infosys announced capital allocation policy updates.",
            "sentiment": "Bullish",
            "published_at": "2026-07-24"
        }
    ]
    events = EventDetector.detect_events(articles, ticker="INFY.NS")
    assert len(events) >= 1
    event_types = [e["event_type"] for e in events]
    assert any("Dividend" in et or "Quarterly" in et for et in event_types)

def test_news_cache_and_engine():
    cache_mgr = NewsCacheManager(cache_dir=TEST_CACHE_DIR)
    mock_provider = MockNewsProvider()
    engine = MarketIntelligenceEngine(cache_manager=cache_mgr)
    
    pack = engine.get_intelligence_pack("RELIANCE.NS", company_name="Reliance Industries", sector_name="Energy")
    assert pack.ticker == "RELIANCE.NS"
    assert len(pack.company_news) > 0
    assert pack.overall_sentiment.primary_sentiment in ["Bullish", "Neutral", "Bearish"]

    # Verify disk cache creation
    cached_data = cache_mgr.get("RELIANCE.NS")
    assert cached_data is not None
    assert cached_data["ticker"] == "RELIANCE.NS"

def test_market_intelligence_api_endpoint():
    response = client.get("/intelligence/news/RELIANCE.NS")
    assert response.status_code == 200
    data = response.json()
    assert "company_news" in data
    assert "overall_sentiment" in data
    assert data["ticker"] in ["RELIANCE.NS", "RELIANCE"]
