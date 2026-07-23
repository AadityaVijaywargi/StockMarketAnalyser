from pydantic import BaseModel, Field
from typing import List, Dict, Any

class ChartDataModel(BaseModel):
    """
    Structured visualization data package for frontend chart rendering.
    """
    dates: List[str]
    open: List[float]
    high: List[float]
    low: List[float]
    close: List[float]
    volume: List[int]
    moving_averages: Dict[str, List[float]]  # Name (e.g. SMA20) -> List of values
    support_lines: List[float]
    resistance_lines: List[float]
    patterns_coordinates: List[Dict[str, Any]]  # Highlight annotations for charts
