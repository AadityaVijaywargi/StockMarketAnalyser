import re
from typing import Dict, Any

class RelevanceScorer:
    """
    Computes a 0–100 relevance score for a news article with respect to a target stock, company, and sector.
    """
    @staticmethod
    def calculate_relevance(
        headline: str,
        summary: str,
        ticker: str,
        company_name: str = "",
        sector_name: str = "",
        topic: str = "General"
    ) -> float:
        score = 40.0  # Base relevance
        clean_ticker = ticker.replace(".NS", "").replace(".BO", "").upper()
        c_name = company_name.lower() if company_name else ""
        s_name = sector_name.lower() if sector_name else ""

        text_headline = headline.lower()
        text_summary = summary.lower()

        # 1. Direct Company Mention in Headline (+35 pts)
        if clean_ticker.lower() in text_headline or (c_name and c_name in text_headline):
            score += 35.0
        # Direct Company Mention in Summary (+20 pts)
        elif clean_ticker.lower() in text_summary or (c_name and c_name in text_summary):
            score += 20.0

        # 2. Sector Match (+15 pts)
        if s_name and (s_name in text_headline or s_name in text_summary):
            score += 15.0

        # 3. Topic Importance (+10 pts for high-impact topics)
        if topic in ["Earnings", "Acquisition", "Dividend", "Management"]:
            score += 10.0
        elif topic in ["Regulation", "Litigation", "Macro"]:
            score += 5.0

        return round(min(max(score, 10.0), 100.0), 1)
