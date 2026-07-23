from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseLLM(ABC):
    """
    Abstract interface for LLM integration.
    """
    @abstractmethod
    def explain_analysis(
        self, 
        analysis_report: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Takes the deterministic structured JSON report of a stock's technical
        condition and returns a generated markdown explanation, key strengths,
        weaknesses, risk factors, and short/medium-term outlooks.
        """
        pass
