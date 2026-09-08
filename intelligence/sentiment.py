import re
from typing import Tuple, List, Dict, Any

BULLISH_KEYWORDS = [
    (r"strong growth", 2.5), (r"outperforms", 2.0), (r"surges", 2.0), (r"profit rises", 2.5),
    (r"record high", 2.5), (r"expansion", 1.5), (r"upgrade", 2.0), (r"buyback", 2.0),
    (r"dividend", 1.5), (r"beat estimates", 2.5), (r"rally", 1.5), (r"acquisition", 1.5),
    (r"approval", 1.5), (r"order win", 2.0), (r"robust demand", 2.0), (r"positive outlook", 1.5)
]

BEARISH_KEYWORDS = [
    (r"profit falls", 2.5), (r"slumps", 2.0), (r"downgrade", 2.0), (r"loss widens", 2.5),
    (r"misses estimates", 2.5), (r"investigation", 2.0), (r"penalty", 2.0), (r"lawsuit", 2.0),
    (r"layoffs", 2.0), (r"plunges", 2.0), (r"supply drag", 1.5), (r"warning", 2.0),
    (r"margin pressure", 2.0), (r"tax demand", 2.0), (r"litigation", 1.5), (r"court order", 1.5)
]

class SentimentAnalyzer:
    """
    Contextual financial sentiment analyzer for news articles and corporate events.
    Calculates primary sentiment (Bullish, Neutral, Bearish) and confidence score.
    """
    @staticmethod
    def analyze(headline: str, summary: str = "") -> Tuple[str, float]:
        text = f"{headline} {summary}".lower()
        
        bull_score = 0.0
        bear_score = 0.0

        for pattern, weight in BULLISH_KEYWORDS:
            if re.search(r'\b' + pattern + r'\b', text):
                bull_score += weight

        for pattern, weight in BEARISH_KEYWORDS:
            if re.search(r'\b' + pattern + r'\b', text):
                bear_score += weight

        diff = bull_score - bear_score
        total = bull_score + bear_score

        if total == 0:
            return "Neutral", 60.0

        confidence = min(60.0 + (abs(diff) * 15.0), 95.0)

        if diff >= 1.0:
            return "Bullish", round(confidence, 1)
        elif diff <= -1.0:
            return "Bearish", round(confidence, 1)
        else:
            return "Neutral", round(confidence, 1)

    @staticmethod
    def aggregate_sentiment(articles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Aggregates individual article sentiments into an OverallSentiment summary dictionary.
        """
        if not articles:
            return {
                "bullish_pct": 33.3,
                "bearish_pct": 33.3,
                "neutral_pct": 33.4,
                "confidence": 70.0,
                "primary_sentiment": "Neutral"
            }

        bull_count = sum(1 for a in articles if a.get("sentiment") == "Bullish")
        bear_count = sum(1 for a in articles if a.get("sentiment") == "Bearish")
        neu_count = sum(1 for a in articles if a.get("sentiment") == "Neutral")

        total = len(articles)
        bull_pct = round((bull_count / total) * 100.0, 1)
        bear_pct = round((bear_count / total) * 100.0, 1)
        neu_pct = round((neu_count / total) * 100.0, 1)

        if bull_count > bear_count and bull_count >= neu_count:
            primary = "Bullish"
        elif bear_count > bull_count and bear_count >= neu_count:
            primary = "Bearish"
        else:
            primary = "Neutral"

        avg_conf = sum(float(a.get("sentiment_confidence", 75.0)) for a in articles) / total

        return {
            "bullish_pct": bull_pct,
            "bearish_pct": bear_pct,
            "neutral_pct": neu_pct,
            "confidence": round(avg_conf, 1),
            "primary_sentiment": primary
        }
