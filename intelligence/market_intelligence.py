import time
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Dict, Any, Optional

from intelligence.schemas import IntelligencePack, NewsArticle, KeyEvent, OverallSentiment
from intelligence.news_fetcher import NewsFetcher
from intelligence.event_detector import EventDetector
from intelligence.sentiment import SentimentAnalyzer
from intelligence.news_cache import NewsCacheManager

logger = logging.getLogger("AIEquityResearchPlatform")


class MarketIntelligenceEngine:
    """
    Main orchestrator for the Market Intelligence Engine (Phase 12).
    Gathers external news, detects corporate actions, calculates sentiment breakdown,
    and produces a cached IntelligencePack with strict timeout and timing logs.
    """
    def __init__(self, fetcher: Optional[NewsFetcher] = None, cache_manager: Optional[NewsCacheManager] = None):
        self.fetcher = fetcher or NewsFetcher()
        self.cache = cache_manager or NewsCacheManager()

    def _build_intelligence_pack_direct(
        self,
        ticker: str,
        company_name: str,
        sector_name: str
    ) -> IntelligencePack:
        t_total_start = time.time()
        logger.info(f"START intelligence request for {ticker}")

        # 1. Fetch Processed News
        t_news = time.time()
        news_dict = self.fetcher.fetch_processed_news(ticker, company_name, sector_name)
        comp_news = news_dict.get("company_news", [])
        sec_news = news_dict.get("sector_news", [])
        mac_news = news_dict.get("macro_news", [])
        all_news = comp_news + sec_news + mac_news
        news_time_ms = round((time.time() - t_news) * 1000, 2)
        logger.info(f"News fetch completed ({news_time_ms} ms)")

        # 2. Detect Corporate Events & Actions
        t_events = time.time()
        key_events_raw = EventDetector.detect_events(all_news, ticker)
        events_time_ms = round((time.time() - t_events) * 1000, 2)
        logger.info(f"Event detection completed ({events_time_ms} ms)")

        # 3. Aggregate Sentiment Summary
        t_sent = time.time()
        sentiment_dict = SentimentAnalyzer.aggregate_sentiment(all_news)
        sent_time_ms = round((time.time() - t_sent) * 1000, 2)
        logger.info(f"Sentiment completed ({sent_time_ms} ms)")

        fetched_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        pack = IntelligencePack(
            ticker=ticker,
            company_news=[NewsArticle(**a) for a in comp_news],
            sector_news=[NewsArticle(**a) for a in sec_news],
            macro_news=[NewsArticle(**a) for a in mac_news],
            key_events=[KeyEvent(**e) for e in key_events_raw],
            overall_sentiment=OverallSentiment(**sentiment_dict),
            fetched_at=fetched_at
        )

        # 4. Cache Write
        t_cache = time.time()
        today_date = time.strftime("%Y-%m-%d", time.gmtime())
        self.cache.set(ticker, pack.model_dump(), today_date)
        cache_time_ms = round((time.time() - t_cache) * 1000, 2)
        logger.info(f"Cache write completed ({cache_time_ms} ms)")

        total_time_ms = round((time.time() - t_total_start) * 1000, 2)
        logger.info(f"Response returned for {ticker} (Total: {total_time_ms} ms)")

        return pack

    def get_intelligence_pack(
        self,
        ticker: str,
        company_name: str = "",
        sector_name: str = "",
        max_timeout_seconds: float = 4.5
    ) -> IntelligencePack:
        """
        Retrieves cached IntelligencePack or builds a fresh one with timeout safety.
        """
        today_date = time.strftime("%Y-%m-%d", time.gmtime())
        cached_dict = self.cache.get(ticker, today_date)

        if cached_dict:
            try:
                logger.info(f"Cache return for {ticker} ({today_date})")
                return IntelligencePack(**cached_dict)
            except Exception as e:
                logger.warning(f"Error parsing cached intelligence pack for {ticker}: {e}")

        # Execute build with strict timeout protection
        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(self._build_intelligence_pack_direct, ticker, company_name, sector_name)
                return future.result(timeout=max_timeout_seconds)
        except TimeoutError:
            logger.warning(f"[TIMEOUT] MarketIntelligenceEngine exceeded {max_timeout_seconds}s limit for {ticker}. Returning fallback intelligence pack.")
            # Fast fallback mock pack
            from intelligence.news_provider import MockNewsProvider
            mock_p = MockNewsProvider()
            raw_items = mock_p.fetch_raw_news(ticker, company_name, sector_name)
            return IntelligencePack(
                ticker=ticker,
                company_news=[NewsArticle(
                    id="art_fb1",
                    headline=a["headline"],
                    summary=a["summary"],
                    published_at=a["published_at"],
                    publisher=a["publisher"],
                    url=a["url"],
                    topic=a["topic"],
                    entities=a.get("entities", [])
                ) for a in raw_items[:2]],
                overall_sentiment=OverallSentiment(primary_sentiment="Neutral", confidence=70.0),
                fetched_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            )
