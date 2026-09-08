import re

TOPIC_KEYWORDS = {
    "Earnings": [r"earnings", r"q1", r"q2", r"q3", r"q4", r"profit", r"revenue", r"ebitda", r"loss", r"financial results", r"margin", r"topline", r"bottomline"],
    "Management": [r"ceo", r"cfo", r"board", r"director", r"appoints", r"resigns", r"management", r"chairman", r"executive", r"leadership"],
    "Products": [r"launch", r"product", r"service", r"feature", r"patent", r"innovation", r"expansion", r"tech", r"unveils", r"rolls out"],
    "Acquisition": [r"acquisition", r"acquire", r"merger", r"takeover", r"buyout", r"deal", r"stake", r"divest", r"joint venture"],
    "Regulation": [r"sebi", r"rbi", r"policy", r"government", r"regulation", r"duty", r"tax", r"ministry", r"compliance", r"order"],
    "Litigation": [r"court", r"suit", r"litigation", r"fine", r"penalty", r"legal", r"notice", r"dispute", r"probe", r"investigation"],
    "Dividend": [r"dividend", r"payout", r"bonus issue", r"stock split", r"buyback", r"yield", r"record date"],
    "Macro": [r"gdp", r"inflation", r"repo rate", r"fed", r"interest rate", r"rupee", r"macro", r"economy", r"monetary"],
    "Industry": [r"sector", r"industry", r"market share", r"demand", r"production", r"commodity", r"supply chain"]
}

class TopicClassifier:
    """
    Classifies financial news articles into standard topic categories based on contextual term matching.
    """
    @staticmethod
    def classify(headline: str, summary: str = "") -> str:
        text = f"{headline} {summary}".lower()
        
        for topic, patterns in TOPIC_KEYWORDS.items():
            for pat in patterns:
                if re.search(r'\b' + pat + r'\b', text):
                    return topic
                    
        return "General"
