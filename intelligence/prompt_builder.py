import json
from typing import Dict, Any
from intelligence.schemas import EvidencePack

PROMPT_VERSION = "1.0"

class PromptBuilder:
    """
    Builds structured, concise grounding prompts for the Gemini model from an EvidencePack.
    Enforces grounding constraints and versions prompts for auditability.
    """
    def __init__(self, version: str = PROMPT_VERSION):
        self.version = version

    def build_prompt(self, evidence: EvidencePack) -> str:
        # Build prompt sections from the EvidencePack attributes
        sections = []
        
        # 1. Title/Header Info
        sections.append("### Company Profile")
        sections.append(f"Prompt Version: v{self.version}")
        sections.append(f"Company Name: {evidence.company_name}")
        sections.append(f"Ticker Symbol: {evidence.ticker}")
        sections.append(f"Current Price: {evidence.price}")
        sections.append(f"Deterministic Recommendation: {evidence.recommendation}")
        sections.append(f"Model Confidence: {evidence.confidence}%")
        sections.append(f"Weighted Technical Score: {evidence.technical_score}/100")
        sections.append(f"Active Market Regime: {evidence.market_regime.upper()}")
        
        # 2. Benchmarks
        sections.append("\n### Macro Market Context")
        nifty = evidence.market_context.get("nifty", {})
        vix = evidence.market_context.get("vix", {})
        sector = evidence.market_context.get("sector", {})
        sections.append(f"- Nifty 50 Trend: {nifty.get('direction', 'SIDEWAYS')} (Strength: {nifty.get('strength', 50)}/100)")
        sections.append(f"- India VIX Value: {vix.get('vix_value', 15.0)} (Regime: {vix.get('regime', 'Normal')})")
        sections.append(f"- Sector Index: {sector.get('sector_name', 'General')}, Trend: {sector.get('direction', 'SIDEWAYS')}")
        sections.append(f"- Systematic Beta: {evidence.market_context.get('stock_beta', 1.0):.2f}")
        sections.append(f"- Benchmark Correlation: {evidence.market_context.get('stock_correlation', 0.7):.2f}")
        
        # 3. Category scores
        sections.append("\n### Category Normalization Scores")
        for cat, score in evidence.category_scores.items():
            sections.append(f"- {cat.capitalize()}: {score:.2f}/100")
            
        # 4. Signal Consensus
        sections.append("\n### Signal Agreement consensus")
        sig = evidence.signal_agreement
        sections.append(f"- Bullish Indicators Active: {sig.get('bullish_signals', 0)}")
        sections.append(f"- Bearish Indicators Active: {sig.get('bearish_signals', 0)}")
        
        # 5. Explainability Factors (Token Optimized - Select top factors)
        sections.append("\n### Explainability Contributors")
        sections.append("- Positive Factors: " + (", ".join(evidence.positive_contributors[:6]) if evidence.positive_contributors else "None"))
        sections.append("- Negative Factors: " + (", ".join(evidence.negative_contributors[:6]) if evidence.negative_contributors else "None"))
        sections.append("- Risk/Volatility Factors: " + (", ".join(evidence.risk_factors[:4]) if evidence.risk_factors else "None"))
        
        # 6. S/R & Patterns
        sections.append("\n### Key Price Boundaries")
        sections.append("- Support Price Levels: " + (", ".join(f"{p:.2f}" for p in evidence.support_levels[:3]) if evidence.support_levels else "None"))
        sections.append("- Resistance Price Levels: " + (", ".join(f"{p:.2f}" for p in evidence.resistance_levels[:3]) if evidence.resistance_levels else "None"))
        sections.append("- Detected Geometric/Candlestick Patterns: " + (", ".join(evidence.detected_patterns) if evidence.detected_patterns else "None"))
        
        # 7. Pre-calculated strategy targets (LLM must NOT alter these)
        sections.append("\n### Trading Targets (FROZEN VALUES - DO NOT CHANGE)")
        strat = evidence.strategy
        sections.append(f"- Entry Condition: {strat.get('entry', 'N/A')}")
        sections.append(f"- Stop Loss: {strat.get('stop_loss', 'N/A')}")
        sections.append(f"- Target 1: {strat.get('target_1', 'N/A')}")
        sections.append(f"- Target 2: {strat.get('target_2', 'N/A')}")
        sections.append(f"- Expected Hold Duration: {strat.get('holding_period', '1-3 Months')}")
        
        # 8. Grounding constraints instruction
        instruction = (
            "\n=========================================\n"
            "ANALYST GROUNDING INSTRUCTIONS:\n"
            "1. You are an institutional research analyst. Explain, interpret, and summarize the data above.\n"
            "2. Under no circumstances should you calculate or invent different Entry, Stop Loss, Targets, scores, or recommendations. Use the exact values provided under 'Trading Targets' and 'Company Profile'.\n"
            "3. Ground all statements in the supplied context. Do not invent corporate news, financial releases, or earnings reports that are not explicitly given in the data.\n"
            "4. For Bullish and Bearish factors, provide at least 5 structured catalysts. Each catalyst must list a Title, Explanation, and a traceable list of source variables (evidence) from the data (e.g. ['trend_score', 'rsi_14', 'support_levels']).\n"
            "5. If the evidence for any section is weak or conflicting, state the uncertainty clearly.\n"
            "6. Output must strictly match the requested JSON schema. Do not return markdown, HTML, or conversational text. Return JSON only."
        )
        sections.append(instruction)
        
        return "\n".join(sections)
