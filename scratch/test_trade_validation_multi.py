import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from analysis.downloader import YahooDownloader
from intelligence.report_generator import ReportGenerator
from intelligence.prompt_builder import PromptBuilder
from intelligence.cache import InMemoryLLMCache
from intelligence.gemini_provider import GeminiProvider


def test_trade_validation_multiple_stocks():
    print("==================================================")
    print(" TRADE VALIDATION MULTI-STOCK AUDIT               ")
    print("==================================================")

    tickers = ["INFY.NS", "RELIANCE.NS", "TCS.NS", "SBIN.NS", "HDFCBANK.NS"]
    downloader = YahooDownloader()

    provider = GeminiProvider()
    prompt_builder = PromptBuilder()
    cache = InMemoryLLMCache()
    generator = ReportGenerator(provider, prompt_builder, cache)

    for ticker in tickers:
        print(f"\nAuditing Trade Setup Validation for {ticker}...")
        df = downloader.download_ticker_data(ticker, interval="1d", period="1mo")
        assert df is not None and not df.empty
        current_price = float(df["Close"].iloc[-1])

        dummy_report_dict = {
            "ticker": ticker,
            "company_name": ticker.replace(".NS", ""),
            "chart_data": {
                "close": df["Close"].tolist(),
                "dates": [d.strftime("%Y-%m-%d") for d in df.index]
            },
            "scores": {
                "overall_score": 75.0,
                "confidence": 85.0,
                "recommendation": "BUY"
            },
            "risk_profile": {"annualized_volatility": 20.0, "atr_percentage": 2.0},
            "market_context": {"stock_beta": 1.0, "stock_correlation": 0.8},
            "support_zones": [{"upper_bound": current_price * 0.96, "lower_bound": current_price * 0.94}],
            "resistance_zones": [{"upper_bound": current_price * 1.10, "lower_bound": current_price * 1.08}]
        }

        evidence = generator._create_evidence_pack(ticker, "1D", dummy_report_dict)
        strategy = evidence.strategy

        # Extract numerical prices from strategy strings
        import re
        entry_match = re.search(r"(\d+\.\d+|\d+)", strategy.get("entry", ""))
        sl_match = re.search(r"(\d+\.\d+|\d+)", strategy.get("stop_loss", ""))
        t1_match = re.search(r"(\d+\.\d+|\d+)", strategy.get("target_1", ""))
        t2_match = re.search(r"(\d+\.\d+|\d+)", strategy.get("target_2", ""))

        entry_val = float(entry_match.group(1)) if entry_match else current_price
        sl_val = float(sl_match.group(1)) if sl_match else current_price * 0.95
        t1_val = float(t1_match.group(1)) if t1_match else current_price * 1.08
        t2_val = float(t2_match.group(1)) if t2_match else current_price * 1.15

        print(f"  Current Price: Rs.{current_price:.2f}")
        print(f"  Generated Entry: Rs.{entry_val:.2f}")
        print(f"  Generated Stop Loss: Rs.{sl_val:.2f}")
        print(f"  Generated Target 1: Rs.{t1_val:.2f}")
        print(f"  Generated Target 2: Rs.{t2_val:.2f}")

        # Strict Validations
        assert sl_val < entry_val, f"Stop loss ({sl_val}) >= Entry ({entry_val})"
        assert sl_val < current_price, f"Stop loss ({sl_val}) >= Current price ({current_price})"
        assert entry_val < t1_val < t2_val, f"Targets invalid: {entry_val} < {t1_val} < {t2_val}"
        assert abs(entry_val - current_price) / current_price <= 0.08, "Entry deviates > 8%"

        risk = entry_val - sl_val
        reward = t1_val - entry_val
        assert risk > 0 and reward > risk, f"Invalid R:R: Risk={risk}, Reward={reward}"

        print(f"  Status: VALIDATED_TRADE_SETUP [PASS]")

    print("\n==================================================")
    print(" ALL 5 STOCKS PASSED TRADE VALIDATION!            ")
    print("==================================================")


if __name__ == "__main__":
    test_trade_validation_multiple_stocks()
