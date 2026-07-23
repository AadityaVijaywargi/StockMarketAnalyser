"""
Backtesting Strategy Placeholder.
Defines logic to trigger entry, exit, and sizing rules.
"""
class BaseStrategy:
    def __init__(self):
        pass

    def on_bar(self, bar) -> str:
        """Trigger trade actions: BUY, SELL, or HOLD."""
        return "HOLD"
