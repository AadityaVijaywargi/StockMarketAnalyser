import re
import time
import logging
from typing import List, Dict, Any, Optional

from intelligence.news_provider import BaseNewsProvider, get_news_provider, YahooNewsProvider, MockNewsProvider
from intelligence.company_resolver import CompanyResolver
from intelligence.news_parser import NewsParser
from intelligence.topic_classifier import TopicClassifier
from intelligence.relevance import RelevanceScorer
from intelligence.sentiment import SentimentAnalyzer

logger = logging.getLogger("AIEquityResearchPlatform")


class NewsFetcher:
    """
    Reusable News Engine component that orchestrates fetching across primary (Google RSS),
    secondary fallback (Yahoo Finance), and fail-safe (Mock) providers.
    Performs parsing, deduplication, topic classification, credibility scoring, and sentiment analysis.
    """
    def __init__(self, provider: Optional[BaseNewsProvider] = None):
        self.primary_provider = provider or get_news_provider("google")
        self.yahoo_fallback = YahooNewsProvider()
        self.mock_fallback = MockNewsProvider()

    @staticmethod
    def _normalize_title_for_dedup(title: str) -> str:
        cleaned = re.sub(r"[^\w\s]", "", title.lower())
        # Strip trailing publisher names like "- livemint" or "- economic times"
        cleaned = re.sub(r"\b(livemint|economic times|moneycontrol|reuters|bloomberg|cnbc)\b", "", cleaned).strip()
        return " ".join(cleaned.split()[:8])

    def fetch_processed_news(
        self,
        ticker: str,
        company_name: str = "",
        sector_name: str = ""
    ) -> Dict[str, List[Dict[str, Any]]]:
        resolved_cname = company_name or CompanyResolver.resolve_company_name(ticker)

        # 1. Primary Fetch (Google News RSS)
        raw_items = []
        try:
            raw_items = self.primary_provider.fetch_raw_news(ticker, resolved_cname, sector_name)
        except Exception as e:
            logger.warning(f"Primary news provider (Google RSS) failed for {ticker}: {e}. Falling back to Yahoo Finance.")

        # 2. Secondary Fallback (Yahoo Finance)
        if not raw_items:
            try:
                logger.info(f"Using secondary fallback provider (Yahoo Finance) for {ticker}")
                raw_items = self.yahoo_fallback.fetch_raw_news(ticker, resolved_cname, sector_name)
            except Exception as e:
                logger.warning(f"Secondary fallback provider (Yahoo Finance) failed for {ticker}: {e}. Falling back to Mock.")

        # 3. Fail-safe Fallback (Mock)
        if not raw_items:
            logger.info(f"Using fail-safe provider (Mock) for {ticker}")
            raw_items = self.mock_fallback.fetch_raw_news(ticker, resolved_cname, sector_name)

        # Process, Deduplicate & Score Articles
        seen_headlines = set()
        company_articles = []
        sector_articles = []
        macro_articles = []

        for raw in raw_items:
            parsed = NewsParser.parse_article(raw, default_ticker=ticker, default_company=resolved_cname)
            headline = parsed["headline"]
            summary = parsed["summary"]

            # Deduplication key check
            dedup_key = self._normalize_title_for_dedup(headline)
            if dedup_key in seen_headlines:
                continue
            seen_headlines.add(dedup_key)

            # Topic classification
            topic = TopicClassifier.classify(headline, summary)
            parsed["topic"] = topic

            # Sentiment analysis
            sentiment, sentiment_conf = SentimentAnalyzer.analyze(headline, summary)
            parsed["sentiment"] = sentiment
            parsed["sentiment_confidence"] = sentiment_conf

            # Relevance & Credibility scoring
            cred_score = raw.get("credibility_score", 0.70)
            relevance = RelevanceScorer.calculate_relevance(
                headline, summary, ticker, resolved_cname, sector_name, topic
            )
            # Boost relevance score by credibility multiplier
            parsed["relevance_score"] = min(100.0, round(relevance * (0.85 + 0.15 * cred_score), 1))
            parsed["source_credibility"] = raw.get("source_credibility", "Standard")
            parsed["publisher_metadata"] = raw.get("publisher_metadata", {
                "name": parsed["publisher"],
                "credibility_tier": parsed["source_credibility"],
                "credibility_score": cred_score,
                "publisher_type": "Financial Media",
                "country": "IN"
            })

            # Categorize scope
            if topic in ["Macro", "Regulation"] or "rbi" in headline.lower() or "nifty" in headline.lower():
                parsed["article_type"] = "macro"
                macro_articles.append(parsed)
            elif topic in ["Industry"] or (sector_name and sector_name.lower() in headline.lower()):
                parsed["article_type"] = "sector"
                sector_articles.append(parsed)
            else:
                parsed["article_type"] = "company"
                company_articles.append(parsed)

        # Sort each section by relevance score descending
        company_articles.sort(key=lambda x: x["relevance_score"], reverse=True)
        sector_articles.sort(key=lambda x: x["relevance_score"], reverse=True)
        macro_articles.sort(key=lambda x: x["relevance_score"], reverse=True)

        return {
            "company_news": company_articles[:12],
            "sector_news": sector_articles[:6],
            "macro_news": macro_articles[:4]
        }
