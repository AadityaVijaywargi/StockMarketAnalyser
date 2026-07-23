import time
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Body
from datetime import datetime, time as dt_time, timedelta
import pytz
import yfinance as yf
from pydantic import BaseModel

from api.deps import get_downloader, get_cache, get_live_cache, get_report_generator, get_feature_store, get_scorer, get_market_downloader
from api.exceptions import TickerValidationError, TickerNotFoundError, DownloaderError, InsufficientDataError

from analysis.downloader import YahooDownloader
from analysis.cache import FileCacheManager, InMemoryLiveCache
from analysis.feature_store import FeatureStore
from analysis.scoring import RuleBasedScorer
from market.market_downloader import MarketDownloader
from intelligence import ReportGenerator

from analysis.indicators import calculate_all_indicators
from analysis.candlestick import calculate_all_candlestick_patterns
from analysis.patterns import detect_all_patterns
from analysis.support_resistance import calculate_sr_zones
from analysis.trend import run_trend_engine
from analysis.chart_data import build_chart_data

from market.vix_analysis import analyze_vix
from market.market_analysis import analyze_index_trend
from market.sector_analysis import (
    calculate_beta_correlation, 
    calculate_relative_strength, 
    analyze_sector_performance
)

from config.constants import (
    SECTOR_MAP, SECTOR_NAMES, DEFAULT_BENCHMARK_INDEX, 
    BANK_NIFTY_INDEX, INDIA_VIX_INDEX
)
from analysis.models.market import (
    IndexTrendModel, VolatilityContextModel, 
    SectorAnalysisModel, MarketContextModel
)
from analysis.models.reports import DeterministicAnalysisReport

logger = logging.getLogger("AIEquityResearchPlatform")

router = APIRouter(prefix="/analyze", tags=["Stock Analysis"])


class LiveQuoteModel(BaseModel):
    ticker: str
    price: float
    change: float
    change_pct: float
    high: float
    low: float
    volume: int
    last_updated: str
    is_market_open: bool


def fetch_live_quote(ticker: str, live_cache: InMemoryLiveCache) -> Dict[str, Any]:
    # Check cache first
    cached = live_cache.get_quote(ticker)
    if cached:
        return cached

    tz = pytz.timezone(settings.MARKET_TIMEZONE)
    now = datetime.now(tz)
    
    ticker_obj = yf.Ticker(ticker)
    price = None
    prev_close = None
    high = None
    low = None
    volume = 0
    
    # Try fast_info
    try:
        fast = ticker_obj.fast_info
        price = fast.get("last_price", None)
        prev_close = fast.get("previous_close", None)
        high = fast.get("day_high", None)
        low = fast.get("day_low", None)
        volume = int(fast.get("last_volume", 0))
    except Exception as e:
        logger.warning(f"fast_info failed for {ticker}: {e}")
        
    # Fallback to history for 2 days if fast_info fails or has missing fields
    if price is None or prev_close is None:
        try:
            hist = ticker_obj.history(period="2d")
            if len(hist) >= 1:
                last_row = hist.iloc[-1]
                price = float(last_row["Close"])
                high = float(last_row["High"])
                low = float(last_row["Low"])
                volume = int(last_row["Volume"])
                if len(hist) >= 2:
                    prev_close = float(hist.iloc[-2]["Close"])
                else:
                    prev_close = price
        except Exception as e:
            logger.error(f"history fallback failed for {ticker}: {e}")

    # Set safe defaults
    if price is None:
        price = 0.0
    if prev_close is None:
        prev_close = price
    if high is None:
        high = price
    if low is None:
        low = price
        
    change = price - prev_close
    change_pct = (change / prev_close * 100.0) if prev_close > 0 else 0.0
    
    # Check market clock status
    is_weekday = now.weekday() < 5
    is_trading_hours = dt_time(9, 15) <= now.time() <= dt_time(15, 30)
    is_open = is_weekday and is_trading_hours
    
    quote = {
        "ticker": ticker,
        "price": round(price, 2),
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
        "high": round(high, 2),
        "low": round(low, 2),
        "volume": volume,
        "last_updated": now.isoformat(),
        "is_market_open": is_open
    }
    
    # Save to cache
    live_cache.set_quote(ticker, quote)
    return quote



def _run_deterministic_pipeline(
    ticker: str,
    downloader: YahooDownloader,
    cache: FileCacheManager,
    live_cache: InMemoryLiveCache,
    report_generator: ReportGenerator,
    feature_store: FeatureStore,
    scorer: RuleBasedScorer,
    market_downloader: MarketDownloader,
    interval: str = "1d",
    debug_mode: bool = False
) -> Dict[str, Any]:
    """Helper that runs the complete frozen deterministic pipeline for a stock."""
    # Suffix safety append using TickerNormalizer
    from analysis.normalizer import TickerNormalizer
    processed_ticker = TickerNormalizer.normalize(ticker)
    logger.info(f"Normalized ticker input: {ticker} -> {processed_ticker}", extra={"ticker": processed_ticker})

    # Validate ticker string format
    import re
    if not re.match(r"^[A-Z0-9_\-\^]+(\.[A-Z]{2,4})?$", processed_ticker):
        raise TickerValidationError(f"Invalid ticker symbol format: '{ticker}'")

    # Check Analysis Cache first
    cached_report = live_cache.get_analysis(processed_ticker, interval)
    if cached_report is not None:
        logger.info(f"Analysis cache HIT for {processed_ticker} ({interval})")
        quote = fetch_live_quote(processed_ticker, live_cache)
        
        # Merge latest quote price onto report
        report_copy = dict(cached_report)
        chart_data = dict(report_copy["chart_data"])
        chart_data["close"] = list(chart_data["close"])
        chart_data["high"] = list(chart_data["high"])
        chart_data["low"] = list(chart_data["low"])
        chart_data["volume"] = list(chart_data["volume"])
        
        if chart_data["close"]:
            chart_data["close"][-1] = quote["price"]
            chart_data["high"][-1] = max(chart_data["high"][-1], quote["price"])
            chart_data["low"][-1] = min(chart_data["low"][-1], quote["price"])
            chart_data["volume"][-1] = max(chart_data["volume"][-1], quote["volume"])
            
        report_copy["chart_data"] = chart_data
        report_copy["metadata"]["live_quote"] = quote
        return report_copy

    t_start = time.time()
    timings = {}

    # Step 1: Download raw stock data (or pull from cache)
    t_down = time.time()
    stock_df = cache.get(processed_ticker, interval=interval)
    if stock_df is None:
        try:
            stock_df = downloader.download_ticker_data(processed_ticker, interval=interval)
            cache.set(processed_ticker, stock_df, interval=interval)
        except Exception as e:
            # Check if it was because symbol doesn't exist or other network issue
            if "not found" in str(e).lower() or "delisted" in str(e).lower():
                raise TickerNotFoundError(processed_ticker)
            raise DownloaderError(processed_ticker, str(e))
    
    # yfinance sometimes returns empty or fails silently
    if stock_df is None or stock_df.empty:
        raise TickerNotFoundError(processed_ticker)
        
    # Enforce minimum history length
    if len(stock_df) < 250:
        raise InsufficientDataError(processed_ticker, len(stock_df))
        
    timings["download_time_ms"] = round((time.time() - t_down) * 1000, 2)

    # Step 2: Feature Store calculation (Raw + Indicators + Candlestick)
    t_feat = time.time()
    raw_cols = ["Open", "High", "Low", "Close", "Volume"]
    enriched_df = feature_store.enrich_features(processed_ticker, stock_df[raw_cols], stage_name="raw")
    
    # Compute and enrich Indicators
    ind_df = calculate_all_indicators(enriched_df, settings.INDICATOR_PERIODS)
    enriched_df = feature_store.enrich_features(processed_ticker, ind_df, stage_name="indicators")
    
    # Compute and enrich Candlestick patterns
    candle_df = calculate_all_candlestick_patterns(enriched_df)
    enriched_df = feature_store.enrich_features(processed_ticker, candle_df, stage_name="candlesticks")
    
    timings["features_time_ms"] = round((time.time() - t_feat) * 1000, 2)

    # Step 3: Algorithmic Pattern detection
    t_patt = time.time()
    patterns = detect_all_patterns(enriched_df)
    timings["patterns_time_ms"] = round((time.time() - t_patt) * 1000, 2)

    # Step 4: Support / Resistance zones
    t_sr = time.time()
    support_zones, resistance_zones = calculate_sr_zones(stock_df)
    timings["support_resistance_time_ms"] = round((time.time() - t_sr) * 1000, 2)

    # Step 5: Market Context Engine (Benchmarks, VIX, Sectors)
    t_market = time.time()
    
    # Retrieve indices datasets
    nifty_df = market_downloader.get_index_data(DEFAULT_BENCHMARK_INDEX)
    bank_nifty_df = market_downloader.get_index_data(BANK_NIFTY_INDEX)
    vix_df = market_downloader.get_index_data(INDIA_VIX_INDEX)
    
    # Compute sector index parameters
    sector_symbol = SECTOR_MAP.get(processed_ticker, DEFAULT_BENCHMARK_INDEX)
    sector_name = SECTOR_NAMES.get(sector_symbol, "General Market")
    sector_df = market_downloader.get_index_data(sector_symbol)
    
    # Run macro contexts
    nifty_trend = IndexTrendModel(**analyze_index_trend(nifty_df, DEFAULT_BENCHMARK_INDEX))
    bn_trend = IndexTrendModel(**analyze_index_trend(bank_nifty_df, BANK_NIFTY_INDEX))
    vix_analysis = VolatilityContextModel(**analyze_vix(vix_df))
    
    sector_analysis = SectorAnalysisModel(**analyze_sector_performance(
        sector_df=sector_df,
        nifty_df=nifty_df,
        sector_name=sector_name,
        sector_symbol=sector_symbol
    ))
    
    # Relationship metrics
    beta, corr = calculate_beta_correlation(stock_df, nifty_df)
    rs, rs_rating, rs_line = calculate_relative_strength(stock_df, nifty_df)
    
    market_context = MarketContextModel(
        nifty=nifty_trend,
        bank_nifty=bn_trend,
        vix=vix_analysis,
        sector=sector_analysis,
        stock_beta=beta,
        stock_correlation=corr,
        relative_strength_rating=rs_rating,
        relative_strength_line=rs_line
    )
    timings["market_analysis_time_ms"] = round((time.time() - t_market) * 1000, 2)

    # Step 6: Pluggable scoring
    t_score = time.time()
    scores, risk, pos, neg, neu = scorer.calculate_scores(
        features_df=enriched_df, 
        market_context={
            "nifty": nifty_trend.model_dump(),
            "vix": vix_analysis.model_dump(),
            "sector": sector_analysis.model_dump(),
            "relative_strength_rating": rs_rating,
            "stock_beta": beta,
            "stock_correlation": corr
        }
    )
    timings["scoring_time_ms"] = round((time.time() - t_score) * 1000, 2)

    # Step 7: Visual visualization payload
    chart_payload = build_chart_data(enriched_df, support_zones, resistance_zones, patterns)

    # Total pipeline runtimes
    total_time_ms = round((time.time() - t_start) * 1000, 2)
    timings["total_pipeline_time_ms"] = total_time_ms
    
    # Retrieve company name (use ticker prefix or lookup map)
    company_name = processed_ticker.split(".")[0]
    
    # Set execution and explainability metadata
    report_metadata = {"timings": timings}
    if hasattr(scorer, "_reasoning_context"):
        report_metadata["scoring_explanation"] = scorer._reasoning_context
        
    report = DeterministicAnalysisReport(
        ticker=processed_ticker,
        company_name=company_name,
        analysis_date=datetime.now().strftime("%Y-%m-%d"),
        market_context=market_context,
        scores=scores,
        risk_profile=risk,
        positive_factors=pos,
        negative_factors=neg,
        neutral_factors=neu,
        chart_data=chart_payload,
        patterns=patterns,
        support_zones=support_zones,
        resistance_zones=resistance_zones,
        metadata=report_metadata
    )
    
    # Convert Pydantic model to dictionary
    result = report.model_dump()
    
    # Run the LLM Report Generator Layer (Grounding + Explainability)
    try:
        t_llm = time.time()
        ai_report = report_generator.generate_report(processed_ticker, interval, result)
        result["ai_research_report"] = ai_report
        timings["llm_time_ms"] = round((time.time() - t_llm) * 1000, 2)
    except Exception as e:
        logger.error(f"LLM Intelligence Layer failed: {e}. Returning fallback report structure.")
        try:
            from intelligence.gemini_client import GeminiClient
            client_mock = GeminiClient()
            evidence_pack = report_generator._create_evidence_pack(processed_ticker, result)
            fallback = client_mock._generate_fallback_report(evidence_pack, time.time(), f"pipeline_level_failure: {str(e)}")
            result["ai_research_report"] = fallback
        except Exception as fallback_err:
            logger.error(f"Failed to generate fallback report: {fallback_err}")
            result["ai_research_report"] = None
    
    # Save to analysis cache
    try:
        last_idx = enriched_df.index[-1]
        tz_market = pytz.timezone(settings.MARKET_TIMEZONE)
        if last_idx.tzinfo is None:
            last_index_time = tz_market.localize(last_idx)
        else:
            last_index_time = last_idx.astimezone(tz_market)
            
        live_cache.set_analysis(processed_ticker, interval, last_index_time, result)
    except Exception as e:
        logger.warning(f"Failed to cache analysis for {processed_ticker}: {e}")
        
    logger.info(
        f"Completed deterministic analysis for {processed_ticker} in {total_time_ms:.1f}ms", 
        extra={"ticker": processed_ticker, "execution_time": total_time_ms}
    )
    return result


@router.get("/{ticker}/quote", response_model=LiveQuoteModel)
async def get_live_quote(
    ticker: str,
    live_cache: InMemoryLiveCache = Depends(get_live_cache)
):
    """
    Returns lightweight real-time price quote details for the stock.
    """
    from analysis.normalizer import TickerNormalizer
    processed_ticker = TickerNormalizer.normalize(ticker)
    return fetch_live_quote(processed_ticker, live_cache)


@router.get("/{ticker}", response_model=DeterministicAnalysisReport)
async def analyze_ticker(
    ticker: str,
    timeframe: str = Query(default="1d", description="Candle interval (e.g. 1m, 5m, 15m, 1h, 1d)"),
    debug: bool = Query(default=False, description="Include execution timing information in response metadata"),
    downloader: YahooDownloader = Depends(get_downloader),
    cache: FileCacheManager = Depends(get_cache),
    live_cache: InMemoryLiveCache = Depends(get_live_cache),
    report_generator: ReportGenerator = Depends(get_report_generator),
    feature_store: FeatureStore = Depends(get_feature_store),
    scorer: RuleBasedScorer = Depends(get_scorer),
    market_downloader: MarketDownloader = Depends(get_market_downloader)
):
    """
    Executes the complete deterministic technical and market analysis for a given stock.
    Returns scores, patterns, S/R zones, market trends, and chart visualization data.
    """
    result = _run_deterministic_pipeline(
        ticker=ticker,
        downloader=downloader,
        cache=cache,
        live_cache=live_cache,
        report_generator=report_generator,
        feature_store=feature_store,
        scorer=scorer,
        market_downloader=market_downloader,
        interval=timeframe,
        debug_mode=debug
    )
    return result


@router.post("", response_model=List[DeterministicAnalysisReport])
async def analyze_multiple_tickers(
    tickers: List[str] = Body(..., example=["RELIANCE.NS", "TCS.NS", "INFY.NS"]),
    timeframe: str = Query(default="1d", description="Candle interval (e.g. 1m, 5m, 15m, 1h, 1d)"),
    debug: bool = Query(default=False),
    downloader: YahooDownloader = Depends(get_downloader),
    cache: FileCacheManager = Depends(get_cache),
    live_cache: InMemoryLiveCache = Depends(get_live_cache),
    report_generator: ReportGenerator = Depends(get_report_generator),
    feature_store: FeatureStore = Depends(get_feature_store),
    scorer: RuleBasedScorer = Depends(get_scorer),
    market_downloader: MarketDownloader = Depends(get_market_downloader)
):
    """
    Accepts a list of ticker symbols and returns deterministic analysis reports for all of them.
    Filters out duplicates. Maximum batch size limited to 5.
    """
    # Normalize and de-duplicate tickers
    normalized_tickers = []
    for t in tickers:
        processed = t.upper().strip()
        if not "." in processed:
            processed = f"{processed}.NS"
        normalized_tickers.append(processed)
        
    unique_tickers = list(dict.fromkeys(normalized_tickers))
    
    if not unique_tickers:
        raise TickerValidationError("Request body must contain at least one ticker.")
        
    if len(unique_tickers) > 5:
        raise TickerValidationError("Maximum batch size exceeded. Please request at most 5 tickers at a time.")

    results = []
    for ticker in unique_tickers:
        try:
            report_dict = _run_deterministic_pipeline(
                ticker=ticker,
                downloader=downloader,
                cache=cache,
                live_cache=live_cache,
                report_generator=report_generator,
                feature_store=feature_store,
                scorer=scorer,
                market_downloader=market_downloader,
                interval=timeframe,
                debug_mode=debug
            )
            results.append(report_dict)
        except Exception as e:
            logger.error(f"Batch analysis failed on {ticker}: {str(e)}", extra={"ticker": ticker})
            raise
            
    return results

# Import settings here to avoid circular imports during startup
from config.settings import settings
