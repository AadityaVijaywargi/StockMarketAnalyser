import time
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Generator, Type
from pydantic import BaseModel

from intelligence.exceptions import LLMProviderError, LLMKeyMissingError

logger = logging.getLogger("AIEquityResearchPlatform")


class LLMProvider(ABC):
    """
    Abstract interface for LLM provider implementations (Gemini, OpenAI, Claude, Mock).
    The platform business logic and API endpoints rely solely on this abstraction.
    """

    def __init__(self, provider_name: str):
        self.provider_name = provider_name

    @abstractmethod
    def generate(self, prompt: str, schema: Optional[Type[BaseModel]] = None) -> Dict[str, Any]:
        """
        Queries the LLM provider with a prompt and optional Pydantic response schema.
        Returns a structured dictionary matching the schema.
        """
        pass

    def generate_stream(self, prompt: str, schema: Optional[Type[BaseModel]] = None) -> Generator[str, None, None]:
        """
        Streaming interface hook for future streaming responses.
        By default, yields the full output from generate as a single chunk.
        Subclasses can override to stream tokens natively.
        """
        result = self.generate(prompt, schema)
        import json
        yield json.dumps(result)


class OpenAIProvider(LLMProvider):
    """
    Future extension provider for OpenAI (GPT-4o / GPT-4o-mini).
    Included for application provider-agnostic modularity.
    """
    def __init__(self, api_key: str = None, model: str = "gpt-4o-mini"):
        super().__init__("OpenAI")
        self.api_key = api_key
        self.model = model

    def generate(self, prompt: str, schema: Optional[Type[BaseModel]] = None) -> Dict[str, Any]:
        if not self.api_key:
            raise LLMKeyMissingError("OpenAI", "OPENAI_API_KEY")
        raise NotImplementedError("OpenAIProvider integration is scheduled for future extension.")


class ClaudeProvider(LLMProvider):
    """
    Future extension provider for Anthropic Claude (Claude 3.5 Sonnet).
    Included for application provider-agnostic modularity.
    """
    def __init__(self, api_key: str = None, model: str = "claude-3-5-sonnet-20241022"):
        super().__init__("Claude")
        self.api_key = api_key
        self.model = model

    def generate(self, prompt: str, schema: Optional[Type[BaseModel]] = None) -> Dict[str, Any]:
        if not self.api_key:
            raise LLMKeyMissingError("Claude", "ANTHROPIC_API_KEY")
        raise NotImplementedError("ClaudeProvider integration is scheduled for future extension.")


class MockProvider(LLMProvider):
    """
    Mock LLM provider for unit testing without network calls or API keys.
    """
    def __init__(self, mock_response: Optional[Dict[str, Any]] = None):
        super().__init__("Mock")
        self.mock_response = mock_response

    def generate(self, prompt: str, schema: Optional[Type[BaseModel]] = None) -> Dict[str, Any]:
        if self.mock_response:
            return self.mock_response
        
        return {
            "executive_summary": "Mock executive summary for testing.",
            "investment_thesis": {
                "text": "Mock investment thesis explanation.",
                "evidence": ["trend_score", "momentum_score"]
            },
            "bull_case": [
                {
                    "title": "Mock Bull Catalyst",
                    "explanation": "Mock bullish explanation text.",
                    "evidence": ["positive_contributors"]
                }
            ],
            "bear_case": [
                {
                    "title": "Mock Bear Risk",
                    "explanation": "Mock bearish explanation text.",
                    "evidence": ["negative_contributors"]
                }
            ],
            "key_risks": [
                {
                    "title": "Mock Volatility Risk",
                    "explanation": "Mock volatility explanation text.",
                    "evidence": ["atr_percentage"]
                }
            ],
            "technical_outlook": {
                "text": "Mock technical outlook description.",
                "evidence": ["support_levels", "resistance_levels"]
            },
            "short_term_outlook": {
                "text": "Mock short-term outlook description.",
                "evidence": ["signal_agreement"]
            },
            "medium_term_outlook": {
                "text": "Mock medium-term outlook description.",
                "evidence": ["relative_strength_rating"]
            },
            "action_plan": {
                "text": "Mock action plan description.",
                "evidence": ["strategy"]
            },
            "disclaimer": "Mock equity research disclaimer for testing purposes.",
            "metadata": {
                "model": "mock-provider-v1",
                "prompt_version": "1.0",
                "generated_at": "2026-07-24T00:00:00",
                "cached": False,
                "response_time_ms": 1.0
            }
        }
