import re
import html
import hashlib
import time
from typing import Dict, Any, List

VERIFIED_PUBLISHERS = {
    "reuters", "bloomberg", "cnbc", "wall street journal", "wsj", "financial times", "ft.com",
    "economic times", "the economic times", "mint", "livemint", "moneycontrol", "business standard",
    "financial express", "ndtv profit", "the hindu businessline", "cnbtv18", "bq prime", "yahoo finance"
}

class NewsParser:
    """
    Parses, sanitizes HTML, unescapes entities, and extracts clean structured attributes from raw news payloads.
    """

    @staticmethod
    def clean_text(raw_text: str) -> str:
        if not raw_text:
            return ""
        # 1. Unescape HTML entities (&amp;, &quot;, &lt;, &gt;, &#39;)
        text = html.unescape(raw_text)
        # 2. Strip HTML tags completely using regex
        text = re.sub(r'<[^>]+>', '', text)
        # 3. Clean up duplicated whitespace and line breaks
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    @staticmethod
    def clean_url(raw_url: str) -> str:
        if not raw_url:
            return ""
        # Clean up Google News RSS link wrappers if possible
        # If url contains &url= parameter, extract original URL
        if "url=" in raw_url:
            match = re.search(r'[?&]url=([^&]+)', raw_url)
            if match:
                import urllib.parse
                extracted = urllib.parse.unquote(match.group(1))
                if extracted.startswith("http"):
                    return extracted
        return raw_url

    @staticmethod
    def generate_key_points(headline: str, summary: str, company: str = "") -> List[str]:
        points = []
        clean_head = headline.strip()
        clean_sum = summary.strip()

        if clean_head:
            points.append(f"Event: {clean_head}")
        if company:
            points.append(f"Entity Affected: {company} context and market positioning")
        if len(clean_sum) > 40:
            # Split summary into sentences
            sentences = [s.strip() for s in re.split(r'[.!?]', clean_sum) if len(s.strip()) > 15]
            for sentence in sentences[:3]:
                if sentence not in points:
                    points.append(sentence)
        if len(points) < 3:
            points.append("Market Impact: Influences short-term trader sentiment and technical momentum.")
        return points[:5]

    @staticmethod
    def parse_article(raw_item: Dict[str, Any], default_ticker: str = "", default_company: str = "") -> Dict[str, Any]:
        raw_head = raw_item.get("headline") or raw_item.get("title") or ""
        raw_sum = raw_item.get("summary") or raw_item.get("description") or ""
        
        headline = NewsParser.clean_text(raw_head)
        summary = NewsParser.clean_text(raw_sum)
        
        publisher = (raw_item.get("publisher") or "Financial News").strip()
        published_at = str(raw_item.get("published_at") or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
        url = NewsParser.clean_url(raw_item.get("url") or "")
        
        # Create deterministic unique ID hash
        hash_input = f"{headline}_{published_at}_{publisher}".encode("utf-8")
        article_id = hashlib.md5(hash_input).hexdigest()[:12]
        
        # Extract entities from headline and summary
        entities = list(raw_item.get("entities") or [])
        clean_ticker = default_ticker.replace(".NS", "").replace(".BO", "")
        
        if clean_ticker and clean_ticker not in entities:
            entities.append(clean_ticker)
        if default_company and default_company not in entities:
            entities.append(default_company)

        # Regex search for prominent capital words in headline
        found_words = re.findall(r'\b[A-Z]{3,10}\b', headline)
        for word in found_words:
            if word not in entities and word not in ["THE", "AND", "FOR", "INC", "LIMITED", "LTD", "NEWS", "STOCK", "INDIA"]:
                entities.append(word)

        pub_lower = publisher.lower()
        is_verified = any(vp in pub_lower for vp in VERIFIED_PUBLISHERS)

        key_points = NewsParser.generate_key_points(headline, summary, default_company or clean_ticker)

        return {
            "id": article_id,
            "headline": headline,
            "summary": summary,
            "published_at": published_at,
            "publisher": publisher,
            "is_verified_source": is_verified,
            "url": url,
            "entities": list(set(entities)),
            "key_points": key_points
        }
