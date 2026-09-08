import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
from typing import List, Dict, Any, Optional

from intelligence.news_provider import BaseNewsProvider
from intelligence.company_resolver import CompanyResolver

logger = logging.getLogger("AIEquityResearchPlatform")

# Publisher Credibility Classification Matrix
HIGH_CREDIBILITY_PUBLISHERS = {
    "reuters", "bloomberg", "cnbc", "wall street journal", "wsj", "financial times", "ft.com"
}

MEDIUM_HIGH_CREDIBILITY_PUBLISHERS = {
    "economic times", "the economic times", "mint", "livemint", "livemint.com",
    "moneycontrol", "moneycontrol.com", "business standard", "financial express",
    "ndtv profit", "the hindu businessline", "businessline", "zeebiz", "cnbtv18",
    "bq prime", "reuters india", "yahoo finance", "informist"
}


class GoogleNewsRSSProvider(BaseNewsProvider):
    """
    Primary Market Intelligence News Provider using Google News RSS feeds.
    Features parallel multi-query execution, publisher credibility scoring,
    normalized metadata, and strict timeout protection.
    """
    def __init__(self, user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"):
        self.user_agent = user_agent

    @staticmethod
    def classify_publisher(publisher_name: str) -> Dict[str, Any]:
        pub_lower = (publisher_name or "").lower().strip()

        if any(h in pub_lower for h in HIGH_CREDIBILITY_PUBLISHERS):
            cred_tier = "High"
            cred_score = 1.0
            pub_type = "Mainstream Institutional Financial Media"
        elif any(m in pub_lower for m in MEDIUM_HIGH_CREDIBILITY_PUBLISHERS):
            cred_tier = "Medium-High"
            cred_score = 0.85
            pub_type = "Financial Business Daily"
        else:
            cred_tier = "Standard"
            cred_score = 0.70
            pub_type = "General Market Media"

        return {
            "name": publisher_name or "Google News",
            "credibility_tier": cred_tier,
            "credibility_score": cred_score,
            "publisher_type": pub_type,
            "country": "IN"
        }

    def _fetch_single_rss_query(self, query: str, timeout_seconds: float = 2.5) -> List[Dict[str, Any]]:
        encoded_q = urllib.parse.quote(query)
        rss_url = f"https://news.google.com/rss/search?q={encoded_q}&hl=en-IN&gl=IN&ceid=IN:en"
        
        articles = []
        req = urllib.request.Request(rss_url, headers={"User-Agent": self.user_agent})
        
        try:
            with urllib.request.urlopen(req, timeout=timeout_seconds) as response:
                xml_content = response.read()
                root = ET.fromstring(xml_content)
                items = root.findall(".//item")

                for item in items:
                    title_elem = item.find("title")
                    raw_headline = title_elem.text if title_elem is not None else ""
                    
                    pub_date_elem = item.find("pubDate")
                    published_at = pub_date_elem.text if pub_date_elem is not None else ""
                    
                    link_elem = item.find("link")
                    raw_url = link_elem.text if link_elem is not None else ""

                    source_elem = item.find("source")
                    publisher_name = source_elem.text if source_elem is not None else "Google News"

                    desc_elem = item.find("description")
                    raw_summary = desc_elem.text if desc_elem is not None else ""

                    # Sanitize HTML tags & entities
                    from intelligence.news_parser import NewsParser
                    headline = NewsParser.clean_text(raw_headline)
                    summary = NewsParser.clean_text(raw_summary)
                    url = NewsParser.clean_url(raw_url)

                    if headline:
                        pub_info = self.classify_publisher(publisher_name)
                        articles.append({
                            "headline": headline,
                            "summary": summary,
                            "publisher": pub_info["name"],
                            "published_at": published_at,
                            "url": url,
                            "publisher_metadata": pub_info,
                            "source_credibility": pub_info["credibility_tier"],
                            "credibility_score": pub_info["credibility_score"],
                            "query_used": query
                        })
        except Exception as e:
            logger.debug(f"Google News RSS query '{query}' fetch failed: {e}")

        return articles

    def fetch_raw_news(
        self,
        ticker: str,
        company_name: str = "",
        sector: str = "",
        timeout_seconds: float = 3.0
    ) -> List[Dict[str, Any]]:
        t_start = time.time()
        logger.info(f"START Google News RSS fetch for {ticker}")

        # Resolve company name if not explicitly passed
        resolved_cname = company_name or CompanyResolver.resolve_company_name(ticker)
        queries = CompanyResolver.generate_search_queries(ticker, resolved_cname, sector)

        raw_articles: List[Dict[str, Any]] = []

        try:
            # Parallel query execution using ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=min(4, len(queries))) as executor:
                futures = {
                    executor.submit(self._fetch_single_rss_query, q, timeout_seconds=2.0): q
                    for q in queries
                }

                for future in as_completed(futures, timeout=timeout_seconds):
                    try:
                        res = future.result()
                        if res:
                            raw_articles.extend(res)
                    except Exception as err:
                        q_failed = futures[future]
                        logger.debug(f"Query '{q_failed}' failed in parallel fetch: {err}")

            elapsed_ms = round((time.time() - t_start) * 1000, 2)
            logger.info(f"Google News RSS fetch completed for {ticker} with {len(raw_articles)} articles ({elapsed_ms} ms)")
        except TimeoutError:
            elapsed_ms = round((time.time() - t_start) * 1000, 2)
            logger.warning(f"[TIMEOUT] GoogleNewsRSSProvider exceeded {timeout_seconds}s limit for {ticker} ({elapsed_ms} ms).")
        except Exception as e:
            elapsed_ms = round((time.time() - t_start) * 1000, 2)
            logger.warning(f"GoogleNewsRSSProvider error for {ticker} ({elapsed_ms} ms): {e}")

        return raw_articles
