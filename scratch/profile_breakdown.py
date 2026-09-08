import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pandas as pd
from analysis.downloader import YahooDownloader
from analysis.cache import FileCacheManager
from market.market_downloader import MarketDownloader
from analysis.indicators import calculate_all_indicators
from analysis.candlestick import calculate_all_candlestick_patterns
from analysis.scoring import RuleBasedScorer
from analysis.prediction_engine import DeterministicPredictionEngine
from analysis.normalizer import TickerNormalizer
from config.settings import settings

def profile_stages():
    tickers = [
        "RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS",
        "BHARTIARTL.NS", "SBIN.NS", "ITC.NS", "KOTAKBANK.NS", "LT.NS",
        "AXISBANK.NS", "HINDUNILVR.NS", "MARUTI.NS", "SUNPHARMA.NS", "TITAN.NS", "ULTRACEMCO.NS"
    ]

    market_downloader = MarketDownloader()
    cache = FileCacheManager()
    downloader = YahooDownloader()
    scorer = RuleBasedScorer()
    prediction_engine = DeterministicPredictionEngine()

    print("==================================================")
    print("  STAGE-BY-STAGE BOTTLENECK PROFILING BREAKDOWN   ")
    print("==================================================")

    # Stage 1: Benchmark Download
    t0 = time.time()
    nifty_df = market_downloader.get_index_data("^NSEI")
    vix_df = market_downloader.get_index_data("^INDIAVIX")
    t_benchmark = time.time() - t0
    print(f"[Stage 1] Benchmark Download (Nifty + VIX): {t_benchmark*1000:.1f} ms")

    t_data_fetch = 0.0
    t_quote_fetch = 0.0
    t_indicators = 0.0
    t_scoring = 0.0
    t_prediction = 0.0

    for raw_ticker in tickers:
        processed_ticker = TickerNormalizer.normalize(raw_ticker)
        
        # Stage 2: Data Fetch / Cache
        t_sub = time.time()
        stock_df = cache.get(processed_ticker, interval="1d")
        if stock_df is None:
            stock_df = downloader.download_ticker_data(processed_ticker, interval="1d")
        t_data_fetch += (time.time() - t_sub)

        if stock_df is None or stock_df.empty:
            continue

        # Stage 3: Live Quote Fetch
        t_sub = time.time()
        # Simulated quote fetch from cache
        quote_price = float(stock_df["Close"].iloc[-1])
        t_quote_fetch += (time.time() - t_sub)

        # Stage 4: Technical Indicators & Candlesticks Computation
        t_sub = time.time()
        raw_cols = ["Open", "High", "Low", "Close", "Volume"]
        indicator_df = calculate_all_indicators(stock_df[raw_cols], settings.INDICATOR_PERIODS)
        candlestick_df = calculate_all_candlestick_patterns(stock_df[raw_cols])
        enriched_df = stock_df[raw_cols].join(indicator_df).join(candlestick_df)
        t_indicators += (time.time() - t_sub)

        # Stage 5: Rule-Based Scoring
        t_sub = time.time()
        scores, risk, pos, neg, neu = scorer.calculate_scores(enriched_df, {
            "nifty": {"direction": "SIDEWAYS", "strength": 50.0, "momentum": 50.0},
            "vix": {"vix_value": 15.0, "regime": "Normal"},
            "relative_strength_rating": 50.0,
            "stock_beta": 1.0,
            "stock_correlation": 0.8
        })
        t_scoring += (time.time() - t_sub)

        # Stage 6: Deterministic Prediction Engine
        t_sub = time.time()
        prediction = prediction_engine.predict(
            ticker=processed_ticker,
            horizon="1d",
            features_df=enriched_df,
            scores=scores,
            risk=risk,
            market_context={},
            intelligence_pack=None
        )
        t_prediction += (time.time() - t_sub)

    print("\n--- PER-STAGE TIME BREAKDOWN FOR 16 TICKERS ---")
    print(f"1. Benchmark Download:                {t_benchmark*1000:7.1f} ms  ({t_benchmark/(t_benchmark+t_data_fetch+t_indicators+t_scoring+t_prediction)*100:4.1f}%)")
    print(f"2. Data Fetch & File Cache:           {t_data_fetch*1000:7.1f} ms  ({t_data_fetch/(t_benchmark+t_data_fetch+t_indicators+t_scoring+t_prediction)*100:4.1f}%)")
    print(f"3. Technical Indicators & Patterns:   {t_indicators*1000:7.1f} ms  ({t_indicators/(t_benchmark+t_data_fetch+t_indicators+t_scoring+t_prediction)*100:4.1f}%)")
    print(f"4. Rule-Based Scoring Engine:         {t_scoring*1000:7.1f} ms  ({t_scoring/(t_benchmark+t_data_fetch+t_indicators+t_scoring+t_prediction)*100:4.1f}%)")
    print(f"5. Prediction Engine Execution:       {t_prediction*1000:7.1f} ms  ({t_prediction/(t_benchmark+t_data_fetch+t_indicators+t_scoring+t_prediction)*100:4.1f}%)")
    print("==================================================")

if __name__ == "__main__":
    profile_stages()
