from pydantic import BaseModel, Field

class SupportResistanceLevel(BaseModel):
    """
    Model representing support or resistance level/zone.
    """
    price: float = Field(..., description="Price level identifier")
    strength: float = Field(..., ge=0.0, le=1.0, description="Relative strength of the level")
    touches: int = Field(default=1, description="Number of touches/tests of this level")
    level_type: str = Field(..., description="support OR resistance")
    timeframe: str = Field(..., description="Timeframe window of detection (e.g. 6M, LONG)")
