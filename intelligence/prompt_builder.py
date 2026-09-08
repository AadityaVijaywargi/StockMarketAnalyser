import json
from typing import Dict, Any
from intelligence.schemas import EvidencePack

PROMPT_VERSION = "2.0"

class PromptBuilder:
    """
    Builds structured, concise grounding prompts for the LLM providers from an EvidencePack.
    Enforces strict grounding constraints, evidence attribution tags, and versioning for auditability.
    """
    def __init__(self, version: str = PROMPT_VERSION):
        self.version = version

    def build_prompt(self, evidence: EvidencePack) -> str:
        sections = []
        
        # 1. Title/Header Info
        sections.append("### Stock Profile & Quantitative Inputs")
        sections.append(f"Prompt Schema Version: v{self.version}")
        sections.append(f"Company Name: {evidence.company_name}")
        sections.append(f"Ticker Symbol: {evidence.ticker}")
        sections.append(f"Current Price: {evidence.price}")
        sections.append(f"Deterministic Recommendation: {evidence.recommendation}")
        sections.append(f"Model Confidence: {evidence.confidence}%")
        sections.append(f"Weighted Technical Score: {evidence.technical_score}/100")
        sections.append(f"Active Market Regime: {evidence.market_regime.upper()}")
        sections.append(f"Analysis Timeframe: {evidence.timeframe}")
        sections.append(f"Latest Candle Timestamp: {evidence.latest_candle_timestamp}")
        
        # 2. Benchmarks & Macro Context
        sections.append("\n### Broad Market & Sector Context")
        nifty = evidence.market_context.get("nifty", {})
        vix = evidence.market_context.get("vix", {})
        sector = evidence.market_context.get("sector", {})
        sections.append(f"- Nifty 50 Trend: {nifty.get('direction', 'SIDEWAYS')} (Strength: {nifty.get('strength', 50)}/100, Momentum: {nifty.get('momentum', 50)}/100)")
        sections.append(f"- India VIX: {vix.get('vix_value', 15.0)} (Regime: {vix.get('regime', 'Normal')}, Percentile: {vix.get('percentile', 50)}%)")
        sections.append(f"- Sector ({sector.get('sector_name', 'General Market')}): Direction={sector.get('direction', 'SIDEWAYS')}, Strength={sector.get('strength', 50)}/100, Relative Strength vs Nifty={sector.get('relative_strength_vs_nifty', 1.0):.2f}")
        sections.append(f"- Systematic Beta: {evidence.market_context.get('stock_beta', 1.0):.2f}")
        sections.append(f"- Benchmark Correlation: {evidence.market_context.get('stock_correlation', 0.7):.2f}")
        sections.append(f"- Relative Strength Rating: {evidence.market_context.get('relative_strength_rating', 50.0):.1f}/100")
        
        # 3. Category Normalization Scores
        sections.append("\n### Quantitative Category Scores (0-100 Scale)")
        for cat, score in evidence.category_scores.items():
            sections.append(f"- {cat.capitalize()}: {score:.2f}/100")
            
        # 4. Signal Consensus
        sections.append("\n### Indicator Signal Consensus")
        sig = evidence.signal_agreement
        sections.append(f"- Bullish Signals Count: {sig.get('bullish_signals', 0)}")
        sections.append(f"- Bearish Signals Count: {sig.get('bearish_signals', 0)}")
        sections.append(f"- Consensus Strength: {sig.get('consensus_strength', 50.0)}%")
        
        # 5. Contributor Factors
        sections.append("\n### Deterministic Factors & Contributors")
        sections.append("- Positive Factors: " + (", ".join(evidence.positive_contributors[:6]) if evidence.positive_contributors else "None"))
        sections.append("- Negative Factors: " + (", ".join(evidence.negative_contributors[:6]) if evidence.negative_contributors else "None"))
        sections.append("- Risk Factors: " + (", ".join(evidence.risk_factors[:4]) if evidence.risk_factors else "None"))
        
        # 6. S/R & Patterns
        sections.append("\n### Price Boundaries & Technical Patterns")
        sections.append("- Support Levels: " + (", ".join(f"{p:.2f}" for p in evidence.support_levels[:3]) if evidence.support_levels else "None"))
        sections.append("- Resistance Levels: " + (", ".join(f"{p:.2f}" for p in evidence.resistance_levels[:3]) if evidence.resistance_levels else "None"))
        sections.append("- Detected Patterns: " + (", ".join(evidence.detected_patterns) if evidence.detected_patterns else "None"))
        
        # 7. Frozen Trading Strategy Targets
        sections.append("\n### Trading Strategy Targets (FROZEN VALUES - DO NOT ALTER)")
        strat = evidence.strategy
        sections.append(f"- Entry Condition: {strat.get('entry', 'N/A')}")
        sections.append(f"- Stop Loss: {strat.get('stop_loss', 'N/A')}")
        sections.append(f"- Target 1: {strat.get('target_1', 'N/A')}")
        sections.append(f"- Target 2: {strat.get('target_2', 'N/A')}")
        sections.append(f"- Expected Hold Horizon: {strat.get('holding_period', '1-3 Months')}")

        # 8. Market Intelligence & Recent News Context
        if evidence.intelligence_pack:
            pack = evidence.intelligence_pack
            sections.append("\n### Market Intelligence & Recent News Context")
            sentiment = pack.overall_sentiment
            sections.append(f"- Overall News Sentiment: {sentiment.primary_sentiment} (Bullish: {sentiment.bullish_pct}%, Bearish: {sentiment.bearish_pct}%, Neutral: {sentiment.neutral_pct}%, Confidence: {sentiment.confidence}%)")
            
            if pack.company_news:
                sections.append("- Recent Company News Headlines:")
                for art in pack.company_news[:3]:
                    sections.append(f"  * [{art.published_at}] {art.headline} ({art.publisher}) - Sentiment: {art.sentiment}, Topic: {art.topic}")
                    
            if pack.key_events:
                sections.append("- Key Corporate Events & Actions:")
                for evt in pack.key_events[:3]:
                    sections.append(f"  * [{evt.event_type}] {evt.title} (Impact: {evt.impact_level}, Sentiment: {evt.sentiment})")
                    
            if pack.sector_news or pack.macro_news:
                sec_mac = pack.sector_news + pack.macro_news
                sections.append("- Sector & Macro News Context:")
                for art in sec_mac[:2]:
                    sections.append(f"  * {art.headline} ({art.publisher}) - Topic: {art.topic}")

        # 9. Grounding & Evidence Attribution Instructions
        instruction = (
            "\n=========================================\n"
            "INSTITUTIONAL RESEARCH GROUNDING DIRECTIVES:\n"
            "1. You are an institutional equity research analyst explaining the quantitative model's findings.\n"
            "2. DO NOT calculate indicators, DO NOT invent price levels or numbers, and DO NOT alter the recommendation.\n"
            "3. Under no circumstances contradict the quantitative engine's findings or recommendation.\n"
            "4. Synthesize the quantitative signals alongside the Market Intelligence & Recent News context provided.\n"
            "5. Explain recent catalysts, potential risks, and macro/sector outlook WITHOUT modifying deterministic score outputs.\n"
            "6. EVIDENCE ATTRIBUTION REQUIREMENT: For every narrative section and factor array, attach an 'evidence' list of string tags referencing quantitative metrics or news evidence.\n"
            "7. TONAL REQUIREMENTS: Use a formal, institutional research tone. Do NOT use emojis or promotional fluff.\n"
            "8. Return JSON only conforming exactly to the requested schema."
        )
        sections.append(instruction)
        
        return "\n".join(sections)
