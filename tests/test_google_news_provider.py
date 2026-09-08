import os
import time
import shutil
import pytest
from typing import List

from intelligence.company_resolver import CompanyResolver
from intelligence.google_news_provider import GoogleNewsRSSProvider
from intelligence.news_provider import YahooNewsProvider, MockNewsProvider, get_news_provider
from intelligence.news_fetcher import NewsFetcher
from intelligence.news_cache import NewsCacheManager
from intelligence.market_intelligence import MarketIntelligenceEngine

TEST_CACHE_DIR = "storage/test_google_news_cache"

@pytest.fixture(autouse=True)
def setup_teardown_cache():
    os.makedirs(TEST_CACHE_DIR, exist_ok=True)
    yield
    if os.path.exists(TEST_CACHE_DIR):
        shutil.rmtree(TEST_CACHE_DIR)


def test_company_resolver_generic():
    # Test known ticker map
    assert "Reliance" in CompanyResolver.resolve_company_name("RELIANCE.NS")
    assert "HDFC Bank" in CompanyResolver.resolve_company_name("HDFCBANK.NS")
    
    # Test completely unmapped generic ticker formatting
    unmapped_name = CompanyResolver.resolve_company_name("NEWGEN.NS")
    assert "NEWGEN" in unmapped_name or "Newgen" in unmapped_name

    queries = CompanyResolver.generate_search_queries("RELIANCE.NS", "Reliance Industries")
    assert len(queries) >= 3
    assert any("Reliance Industries" in q for q in queries)


def test_google_news_rss_provider_fetching():
    provider = GoogleNewsRSSProvider()
    articles = provider.fetch_raw_news("RELIANCE.NS", company_name="Reliance Industries", timeout_seconds=3.0)
    
    assert isinstance(articles, list)
    assert len(articles) > 0
    first = articles[0]
    assert "headline" in first
    assert "publisher" in first
    assert "publisher_metadata" in first
    assert first["publisher_metadata"]["credibility_score"] >= 0.70


def test_publisher_credibility_matrix():
    assert GoogleNewsRSSProvider.classify_publisher("Reuters")["credibility_tier"] == "High"
    assert GoogleNewsRSSProvider.classify_publisher("Bloomberg")["credibility_tier"] == "High"
    assert GoogleNewsRSSProvider.classify_publisher("Economic Times")["credibility_tier"] == "Medium-High"
    assert GoogleNewsRSSProvider.classify_publisher("Livemint")["credibility_tier"] == "Medium-High"
    assert GoogleNewsRSSProvider.classify_publisher("Unknown Blog")["credibility_tier"] == "Standard"


def test_news_fetcher_deduplication_and_fallback():
    fetcher = NewsFetcher()
    news_dict = fetcher.fetch_processed_news("INFY.NS", company_name="Infosys")
    
    assert "company_news" in news_dict
    assert "sector_news" in news_dict
    assert "macro_news" in news_dict

    all_arts = news_dict["company_news"] + news_dict["sector_news"] + news_dict["macro_news"]
    assert len(all_arts) >= 5

    # Verify deduplication (all headlines normalized unique)
    headlines = [a["headline"] for a in all_arts]
    assert len(headlines) == len(set(headlines))


def test_rolling_30_day_cache():
    cache_mgr = NewsCacheManager(cache_dir=TEST_CACHE_DIR)
    engine = MarketIntelligenceEngine(cache_manager=cache_mgr)

    pack = engine.get_intelligence_pack("TCS.NS", company_name="Tata Consultancy Services")
    assert pack.ticker == "TCS.NS"

    # Verify current-day cache
    cached_today = cache_mgr.get("TCS.NS")
    assert cached_today is not None

    # Verify rolling history
    history = cache_mgr.get_rolling_history("TCS.NS")
    assert len(history) >= 1
    assert history[-1]["company_news_count"] == len(pack.company_news)


def test_performance_targets():
    cache_mgr = NewsCacheManager(cache_dir=TEST_CACHE_DIR)
    engine = MarketIntelligenceEngine(cache_manager=cache_mgr)

    # 1. Fresh uncached response (< 5 seconds)
    t_start = time.time()
    fresh_pack = engine.get_intelligence_pack("HDFCBANK.NS", company_name="HDFC Bank", max_timeout_seconds=4.5)
    fresh_duration = time.time() - t_start
    assert fresh_duration < 5.0
    assert len(fresh_pack.company_news) > 0

    # 2. Cached response (< 200 ms)
    t_cache_start = time.time()
    cached_pack = engine.get_intelligence_pack("HDFCBANK.NS", company_name="HDFC Bank")
    cache_duration = time.time() - t_cache_start
    assert cache_duration < 0.20
    assert cached_pack.ticker == "HDFCBANK.NS"


def test_validation_across_10_major_stocks():
    target_tickers = [
        ("RELIANCE.NS", "Reliance Industries"),
        ("TCS.NS", "Tata Consultancy Services"),
        ("INFY.NS", "Infosys"),
        ("HDFCBANK.NS", "HDFC Bank"),
        ("ICICIBANK.NS", "ICICI Bank"),
        ("SBIN.NS", "State Bank of India"),
        ("LT.NS", "Larsen & Toubro"),
        ("TITAN.NS", "Titan Company"),
        ("ITC.NS", "ITC Limited"),
        ("SUNPHARMA.NS", "Sun Pharma")
    ]

    fetcher = NewsFetcher()
    for ticker, cname in target_tickers:
        news_dict = fetcher.fetch_processed_news(ticker, company_name=cname)
        total_arts = len(news_dict["company_news"]) + len(news_dict["sector_news"]) + len(news_dict["macro_news"])
        assert total_arts >= 5, f"Expected at least 5 articles for {ticker}, got {total_arts}"
