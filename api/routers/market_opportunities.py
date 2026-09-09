import time
import logging
import json
import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from api.deps import (
    get_downloader, get_cache, get_live_cache, 
    get_feature_store, get_scorer, get_market_downloader, get_report_generator
)
from analysis.downloader import YahooDownloader
from analysis.cache import FileCacheManager, InMemoryLiveCache
from analysis.feature_store import FeatureStore
from analysis.scoring import RuleBasedScorer
from market.market_downloader import MarketDownloader
from intelligence import ReportGenerator
from analysis.models.market import TopOpportunityCard, TopOpportunitiesResponse, IndexTrendModel
from analysis.normalizer import TickerNormalizer
from config.constants import SECTOR_MAP, SECTOR_NAMES, DEFAULT_BENCHMARK_INDEX, BANK_NIFTY_INDEX, INDIA_VIX_INDEX
from market.market_analysis import analyze_index_trend
from market.vix_analysis import analyze_vix
from market.sector_analysis import analyze_sector_performance

logger = logging.getLogger("AIEquityResearchPlatform")

router = APIRouter(prefix="/market", tags=["Market Opportunities"])

TOP_OPPORTUNITIES_TTL_SECONDS = 900  # 15 minutes TTL
SCAN_UNIVERSE_LIMIT = 20  # symbols.json's first 20 entries are large, liquid names

# InMemoryLiveCache.get_analysis()/set_analysis() are keyed by (ticker,
# interval) and consider a cached report fresh until a new candle for that
# ticker completes - for "1d" that's once per trading day, and while the
# market is closed they never expire at all. That's the wrong staleness
# model for this endpoint's aggregate "top opportunities" response, which
# needs the flat TOP_OPPORTUNITIES_TTL_SECONDS above (declared for exactly
# this but never actually read before this fix - the endpoint was calling
# get_analysis()/set_analysis() instead, so the scan could go stale for a
# full trading day, or indefinitely with the market closed, despite the
# UI describing it as a live feed). Tracked as a small module-level cache
# instead, independent of the per-ticker candle-completion cache above.
_top_opportunities_cache: Dict[str, Any] = {"data": None, "timestamp": 0.0}

# Guards the background scan below. Even with the CPU-bound work reduced
# (20-stock universe, skip_intelligence), the scan reliably still took
# 40s+ on Render's free-tier CPU - past any reasonable HTTP request
# timeout. Racing the platform's request deadline against Yahoo Finance
# latency plus Render's CPU limits is the wrong fight: instead, the scan
# runs in a background thread and the request returns immediately with
# whatever's already cached (stale is fine - it's clearly labeled) while
# the fresh scan populates _top_opportunities_cache for the next request.
_scan_lock = threading.Lock()
_scan_in_progress = False

# Stock Universe Catalog Path
SYMBOLS_JSON_PATH = os.path.join("frontend", "src", "components", "search", "symbols.json")

# The 10 NSE sector indices shown on the Market Overview page. All real,
# fetchable Yahoo Finance index tickers (verified live) - the dashboard used
# to show these with hardcoded daily_change_pct/rs values that never moved
# regardless of the actual date, which is the same class of bug as the
# watchlist "Best Performer" fabrication fixed earlier.
SECTOR_UNIVERSE = [
    ("NIFTY BANK", "^NSEBANK"),
    ("NIFTY IT", "^CNXIT"),
    ("NIFTY PHARMA", "^CNXPHARMA"),
    ("NIFTY AUTO", "^CNXAUTO"),
    ("NIFTY METAL", "^CNXMETAL"),
    ("NIFTY ENERGY", "^CNXENERGY"),
    ("NIFTY CONSUMPTION", "^CNXCONSUMP"),
    ("NIFTY INFRA", "^CNXINFRA"),
    ("NIFTY FMCG", "^CNXFMCG"),
    ("NIFTY REALTY", "^CNXREALTY"),
]

CRUDE_OIL_TICKER = "CL=F"       # WTI Crude Futures, USD/barrel
USD_INR_TICKER = "USDINR=X"     # USD/INR spot rate


@router.get("/search")
def search_symbols(
    q: str = Query(..., min_length=1, description="Search query string")
) -> List[Dict[str, Any]]:
    """
    Backend search endpoint supporting exact, partial, prefix, alias, and fuzzy matching.
    """
    catalog = load_symbols_catalog()
    norm_q = q.strip().upper().replace("&", " ").replace(".", " ").replace("-", " ")
    norm_q = " ".join(norm_q.split())

    results = []
    for item in catalog:
        ticker = item.get("ticker", "").upper()
        ticker_base = ticker.split(".")[0]
        name = item.get("name", "").upper()
        aliases = [a.upper() for a in item.get("aliases", [])]

        score = 0
        if norm_q == ticker_base or norm_q == ticker:
            score = 1000
        elif norm_q in aliases:
            score = 950
        elif norm_q == name:
            score = 900
        elif ticker_base.startswith(norm_q) or ticker.startswith(norm_q):
            score = 850
        elif any(a.startswith(norm_q) for a in aliases) or name.startswith(norm_q):
            score = 800
        elif any(norm_q in a for a in aliases) or norm_q in name or norm_q in ticker_base:
            score = 500

        if score > 0:
            results.append({**item, "match_score": score})

    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results


def load_symbols_catalog() -> List[Dict[str, Any]]:
    """Loads default symbols catalog from json or fallback list."""
    if os.path.exists(SYMBOLS_JSON_PATH):
        try:
            with open(SYMBOLS_JSON_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load symbols.json: {e}")
    
    # Fallback liquid list
    return [
        {"ticker": "RELIANCE.NS", "name": "Reliance Industries Limited", "exchange": "NSE"},
        {"ticker": "TCS.NS", "name": "Tata Consultancy Services Limited", "exchange": "NSE"},
        {"ticker": "INFY.NS", "name": "Infosys Limited", "exchange": "NSE"},
        {"ticker": "HDFCBANK.NS", "name": "HDFC Bank Limited", "exchange": "NSE"},
        {"ticker": "ICICIBANK.NS", "name": "ICICI Bank Limited", "exchange": "NSE"},
        {"ticker": "SBIN.NS", "name": "State Bank of India", "exchange": "NSE"},
        {"ticker": "BHARTIARTL.NS", "name": "Bharti Airtel Limited", "exchange": "NSE"},
        {"ticker": "LT.NS", "name": "Larsen & Toubro Limited", "exchange": "NSE"},
        {"ticker": "ITC.NS", "name": "ITC Limited", "exchange": "NSE"},
        {"ticker": "ASIANPAINT.NS", "name": "Asian Paints Limited", "exchange": "NSE"},
        {"ticker": "BAJFINANCE.NS", "name": "Bajaj Finance Limited", "exchange": "NSE"},
        {"ticker": "SUNPHARMA.NS", "name": "Sun Pharmaceutical Industries Limited", "exchange": "NSE"},
        {"ticker": "TITAN.NS", "name": "Titan Company Limited", "exchange": "NSE"},
        {"ticker": "ULTRACEMCO.NS", "name": "UltraTech Cement Limited", "exchange": "NSE"}
    ]


def _compute_top_opportunities(
    downloader: YahooDownloader,
    cache: FileCacheManager,
    live_cache: InMemoryLiveCache,
    feature_store: FeatureStore,
    scorer: RuleBasedScorer,
    market_downloader: MarketDownloader,
    report_generator: ReportGenerator,
) -> None:
    """Runs the full scan and populates _top_opportunities_cache with every
    scanned card (unlimited - the `limit` query param is applied when a
    request is served, not here, so one caller's limit=3 can't leave the
    cache unable to satisfy a later limit=12 caller). Always called on a
    background thread - never awaited by a request handler, see the note
    on _scan_lock above for why."""
    global _scan_in_progress
    try:
        logger.info("Computing Top Opportunities across market watchlist...")
        from api.routers.analysis import _run_deterministic_pipeline, fetch_live_quote

        catalog = load_symbols_catalog()[:SCAN_UNIVERSE_LIMIT]
        scanned_count = 0
        opportunity_cards: List[TopOpportunityCard] = []

        def _scan_one(item: Dict[str, Any]) -> Optional[TopOpportunityCard]:
            ticker = item["ticker"]
            company_name = item.get("name", ticker)

            # Execute pipeline (pulls from 24h file cache or downloads).
            # skip_intelligence=True: per-stock news fetch (up to 3.5s each)
            # adds meaningfully to a 20-stock scan's wall-clock time and
            # isn't needed for a quick score-ranked list - only a single
            # /analyze/{ticker} call needs it.
            report = _run_deterministic_pipeline(
                ticker=ticker,
                downloader=downloader,
                cache=cache,
                live_cache=live_cache,
                report_generator=report_generator,
                feature_store=feature_store,
                scorer=scorer,
                market_downloader=market_downloader,
                interval="1d",
                skip_intelligence=True
            )

            # Extract key details from report output
            scores = report["scores"]
            ai_report = report.get("ai_research_report", {}) or {}
            m_context = report.get("market_context", {}) or {}

            # Fetch or fallback live quote safely
            try:
                quote = fetch_live_quote(ticker, live_cache)
            except Exception:
                chart_closes = report.get("chart_data", {}).get("close", [])
                current_p = chart_closes[-1] if chart_closes else 0.0
                quote = {"price": current_p, "change_pct": 0.0}

            # Key Highlights (Extract up to 3 short bullet points)
            bullish_factors = [f.get("title", "") for f in ai_report.get("bullish_factors", [])] if isinstance(ai_report, dict) else []
            bearish_factors = [f.get("title", "") for f in ai_report.get("bearish_factors", [])] if isinstance(ai_report, dict) else []

            highlights = []
            if scores["trend"]["value"] > 60:
                highlights.append("Solid uptrend structure")
            if scores["volume"]["value"] > 60:
                highlights.append("Institutional accumulation")
            if scores["sector"]["value"] > 60:
                highlights.append("Outperforming Nifty 50")
            if not highlights:
                highlights = [f[:40] for f in bullish_factors[:2]] if bullish_factors else ["Consolidating structure"]

            sector_name = m_context.get("sector", {}).get("sector_name", "General Market")

            return TopOpportunityCard(
                ticker=report["ticker"],
                company_name=company_name,
                current_price=quote["price"],
                price_change_pct=quote["change_pct"],
                overall_score=scores["overall_score"],
                recommendation=scores["recommendation"],
                confidence=scores["confidence"],
                trend_direction="BULLISH" if scores["trend"]["value"] >= 50 else "BEARISH",
                sector=sector_name,
                top_bullish_factors=bullish_factors[:3],
                top_bearish_factors=bearish_factors[:2],
                key_highlights=highlights[:3]
            )

        # Running the catalog concurrently helps with this pipeline's I/O
        # waits (data download); the indicator/pattern/scoring math stays
        # serialized under Python's GIL regardless of worker count, which is
        # why this alone wasn't enough (see SCAN_UNIVERSE_LIMIT / the
        # background-thread architecture above for the rest of the story).
        with ThreadPoolExecutor(max_workers=8) as executor:
            future_to_ticker = {executor.submit(_scan_one, item): item["ticker"] for item in catalog}
            for future in as_completed(future_to_ticker):
                ticker = future_to_ticker[future]
                try:
                    card = future.result()
                    scanned_count += 1
                    if card is not None:
                        opportunity_cards.append(card)
                except Exception as e:
                    logger.warning(f"Skipping {ticker} during opportunities scan: {e}")

        # Sort opportunities descending by overall score - unlimited, see
        # docstring above for why `limit` isn't applied here.
        opportunity_cards.sort(key=lambda c: c.overall_score, reverse=True)

        response = TopOpportunitiesResponse(
            updated_at=datetime.utcnow().isoformat(),
            total_scanned=scanned_count,
            opportunities=opportunity_cards
        )

        _top_opportunities_cache["data"] = response.model_dump()
        _top_opportunities_cache["timestamp"] = time.time()
        logger.info(f"Top Opportunities scan complete: {scanned_count} scanned, {len(opportunity_cards)} cards cached")
    except Exception as e:
        logger.error(f"Top Opportunities background scan failed: {e}")
    finally:
        with _scan_lock:
            _scan_in_progress = False


@router.get("/top-opportunities", response_model=TopOpportunitiesResponse)
def get_top_opportunities(
    limit: int = Query(default=12, ge=1, le=50, description="Max number of top opportunities to return"),
    force_refresh: bool = Query(default=False, description="Bypass cache and force recomputation"),
    live_cache: InMemoryLiveCache = Depends(get_live_cache),
    downloader: YahooDownloader = Depends(get_downloader),
    cache: FileCacheManager = Depends(get_cache),
    feature_store: FeatureStore = Depends(get_feature_store),
    scorer: RuleBasedScorer = Depends(get_scorer),
    market_downloader: MarketDownloader = Depends(get_market_downloader),
    report_generator: ReportGenerator = Depends(get_report_generator)
):
    """
    Returns top-ranked stock opportunities scanned across liquid NSE stocks.

    Non-blocking: the actual scan (still tens of seconds even after cutting
    the universe to 20 stocks and skipping per-stock news - confirmed live,
    it kept exceeding 40s+ on Render's free-tier CPU) runs on a background
    thread. This request returns immediately with whatever's cached, which
    may be stale (or, on the very first call ever, empty) rather than
    block on a computation that was reliably outliving any reasonable HTTP
    timeout. `computing: true` in the response tells the frontend a fresh
    scan is in flight so it can retry shortly instead of treating an empty
    list as "no opportunities found".
    """
    global _scan_in_progress

    cached_data = _top_opportunities_cache["data"]
    cache_age = time.time() - _top_opportunities_cache["timestamp"]
    cache_fresh = cached_data is not None and cache_age < TOP_OPPORTUNITIES_TTL_SECONDS

    if cache_fresh and not force_refresh:
        logger.info(f"Top Opportunities cache HIT (age {cache_age:.0f}s)")
        full = TopOpportunitiesResponse(**cached_data)
        return TopOpportunitiesResponse(
            updated_at=full.updated_at,
            total_scanned=full.total_scanned,
            opportunities=full.opportunities[:limit],
            computing=False
        )

    # Cache is stale, absent, or a refresh was explicitly requested - kick
    # off exactly one background scan (skip if one's already running) and
    # respond immediately either way.
    with _scan_lock:
        already_running = _scan_in_progress
        if not already_running:
            _scan_in_progress = True

    if not already_running:
        threading.Thread(
            target=_compute_top_opportunities,
            args=(downloader, cache, live_cache, feature_store, scorer, market_downloader, report_generator),
            daemon=True
        ).start()

    if cached_data is not None:
        # Serve the stale cache immediately while a fresh scan runs.
        full = TopOpportunitiesResponse(**cached_data)
        return TopOpportunitiesResponse(
            updated_at=full.updated_at,
            total_scanned=full.total_scanned,
            opportunities=full.opportunities[:limit],
            computing=True
        )

    # No cache at all yet (first request since the process started).
    return TopOpportunitiesResponse(
        updated_at=datetime.utcnow().isoformat(),
        total_scanned=0,
        opportunities=[],
        computing=True
    )


@router.get("/overview", response_model=Dict[str, Any])
def get_market_overview(
    force_refresh: bool = Query(default=False, description="Force refresh market intelligence"),
    live_cache: InMemoryLiveCache = Depends(get_live_cache),
    downloader: YahooDownloader = Depends(get_downloader),
    cache: FileCacheManager = Depends(get_cache),
    feature_store: FeatureStore = Depends(get_feature_store),
    scorer: RuleBasedScorer = Depends(get_scorer),
    market_downloader: MarketDownloader = Depends(get_market_downloader),
    report_generator: ReportGenerator = Depends(get_report_generator)
):
    """
    Returns comprehensive Market Intelligence Dashboard payload containing:
    - AI Market Summary (Sentiment, drivers, risks)
    - Market Health Score (0-100 & 6 component breakdown)
    - Sector Performance (Sorted with Top 3 & Bottom 3 highlights)
    - Categorized Opportunities (BUY, WATCH, AVOID)
    - Market Risks (Economic, Volatility, Global, Commodity, Currency)
    """
    CACHE_KEY = "market_dashboard_overview"
    if not force_refresh:
        cached = live_cache.get_analysis(CACHE_KEY, "1d")
        if cached is not None:
            return cached

    # 1. Fetch Top Opportunities to categorize candidates
    top_opps = get_top_opportunities(
        limit=20, 
        force_refresh=force_refresh, 
        live_cache=live_cache, 
        downloader=downloader, 
        cache=cache, 
        feature_store=feature_store, 
        scorer=scorer, 
        market_downloader=market_downloader, 
        report_generator=report_generator
    )

    all_cards = top_opps.opportunities

    buy_candidates = [c for c in all_cards if c.overall_score >= 70.0][:6]
    watch_candidates = [c for c in all_cards if 50.0 <= c.overall_score < 70.0][:6]
    avoid_candidates = [c for c in all_cards if c.overall_score < 50.0][:6]

    # Fallback populator if universe is tightly clustered. No fabricated
    # fallback stock card here (a hardcoded "ASIANPAINT.NS AVOID" used to be
    # inserted whenever the real scan found zero avoid candidates) - if the
    # scanned universe genuinely has no avoid-grade stocks right now, the
    # honest answer is an empty list, not an invented one.
    if not watch_candidates and len(buy_candidates) > 3:
        watch_candidates = buy_candidates[3:]
        buy_candidates = buy_candidates[:3]

    full_buy_count = len([c for c in all_cards if c.overall_score >= 70.0])
    avg_confidence = (sum(c.confidence for c in all_cards) / len(all_cards)) if all_cards else 50.0

    # 2. Real macro context: Nifty/Bank Nifty trend, India VIX regime, and
    # crude/USDINR levels - all fetched from the same Yahoo index/downloader
    # infrastructure the per-stock analysis pipeline already uses.
    nifty_df = market_downloader.get_index_data(DEFAULT_BENCHMARK_INDEX)
    bank_nifty_df = market_downloader.get_index_data(BANK_NIFTY_INDEX)
    vix_df = market_downloader.get_index_data(INDIA_VIX_INDEX)

    nifty_trend = IndexTrendModel(**analyze_index_trend(nifty_df, DEFAULT_BENCHMARK_INDEX))
    bank_nifty_trend = IndexTrendModel(**analyze_index_trend(bank_nifty_df, BANK_NIFTY_INDEX))
    vix_analysis = analyze_vix(vix_df)

    nifty_last = float(nifty_df["Close"].iloc[-1]) if not nifty_df.empty else 0.0
    nifty_change_pct = (
        (nifty_df["Close"].iloc[-1] - nifty_df["Close"].iloc[-2]) / nifty_df["Close"].iloc[-2] * 100.0
        if len(nifty_df) >= 2 else 0.0
    )

    try:
        crude_df = market_downloader.get_index_data(CRUDE_OIL_TICKER)
        crude_price = float(crude_df["Close"].iloc[-1]) if not crude_df.empty else None
        crude_change_pct = (
            float((crude_df["Close"].iloc[-1] - crude_df["Close"].iloc[-2]) / crude_df["Close"].iloc[-2] * 100.0)
            if len(crude_df) >= 2 else 0.0
        )
    except Exception as e:
        logger.warning(f"Failed to fetch crude oil data: {e}")
        crude_price, crude_change_pct = None, 0.0

    try:
        usdinr_df = market_downloader.get_index_data(USD_INR_TICKER)
        usdinr_price = float(usdinr_df["Close"].iloc[-1]) if not usdinr_df.empty else None
        usdinr_change_pct = (
            float((usdinr_df["Close"].iloc[-1] - usdinr_df["Close"].iloc[-2]) / usdinr_df["Close"].iloc[-2] * 100.0)
            if len(usdinr_df) >= 2 else 0.0
        )
    except Exception as e:
        logger.warning(f"Failed to fetch USD/INR data: {e}")
        usdinr_price, usdinr_change_pct = None, 0.0

    # 3. Sector Performance Data - real daily change per sector index, and a
    # real relative-strength ratio. Note: relative_strength here is each
    # sector's own 6-month return vs Nifty's 6-month return - i.e. (1 +
    # sector_return) / (1 + nifty_return), which stays meaningfully near 1.0x
    # - NOT analyze_sector_performance's raw index-point ratio (that divides
    # e.g. Bank Nifty's ~51,000 level by Nifty's ~24,000 level, which would
    # show a nonsensical "2.1x" for every sector regardless of performance;
    # that function is built for tracking one stock's RS line over time, not
    # a cross-sector snapshot comparison).
    nifty_return_6m = (
        float((nifty_df["Close"].iloc[-1] - nifty_df["Close"].iloc[-126]) / nifty_df["Close"].iloc[-126])
        if len(nifty_df) >= 126 else 0.0
    )

    sectors_list = []
    for name, symbol in SECTOR_UNIVERSE:
        try:
            sec_df = market_downloader.get_index_data(symbol)
        except Exception as e:
            logger.warning(f"Failed to fetch sector index {name} ({symbol}): {e}")
            continue
        if sec_df.empty or len(sec_df) < 2:
            continue

        daily_change_pct = float((sec_df["Close"].iloc[-1] - sec_df["Close"].iloc[-2]) / sec_df["Close"].iloc[-2] * 100.0)
        sector_perf = analyze_sector_performance(sec_df, nifty_df, name, symbol)

        sector_return_6m = (
            float((sec_df["Close"].iloc[-1] - sec_df["Close"].iloc[-126]) / sec_df["Close"].iloc[-126])
            if len(sec_df) >= 126 else 0.0
        )
        relative_strength = round((1.0 + sector_return_6m) / (1.0 + nifty_return_6m), 3) if (1.0 + nifty_return_6m) != 0 else 1.0

        sectors_list.append({
            "sector_name": name,
            "sector_symbol": symbol,
            "daily_change_pct": round(daily_change_pct, 2),
            "relative_strength": relative_strength,
            "trend_direction": sector_perf["direction"],
            "sector_momentum": sector_perf["sector_momentum"],
        })

    sectors_list.sort(key=lambda s: s["daily_change_pct"], reverse=True)
    for idx, sec in enumerate(sectors_list, start=1):
        sec["rank"] = idx
        sec["is_top_3"] = idx <= 3
        sec["is_bottom_3"] = idx >= len(sectors_list) - 2 if sectors_list else False

    strong_sector_names = [s["sector_name"] for s in sectors_list[:3]]
    weak_sector_names = [s["sector_name"] for s in sectors_list[-3:]][::-1] if sectors_list else []
    avg_sector_momentum = (
        sum(s["sector_momentum"] for s in sectors_list) / len(sectors_list) if sectors_list else 50.0
    )

    # 4. Market Health Score Breakdown - every component derived from a real
    # computed number above instead of a fixed placeholder that never moved.
    trend_score = round(min(max(50.0 + (nifty_trend.strength / 2.0 if nifty_trend.direction == "BULLISH"
                          else -nifty_trend.strength / 2.0 if nifty_trend.direction == "BEARISH" else 0.0), 0.0), 100.0), 1)
    momentum_score = round(nifty_trend.momentum, 1)
    breadth_score = round((full_buy_count / len(all_cards) * 100.0) if all_cards else 50.0, 1)
    volatility_score = round(max(0.0, min(100.0, 100.0 - vix_analysis["percentile"])), 1)
    sector_strength_score = round(avg_sector_momentum, 1)
    model_confidence_score = round(avg_confidence, 1)

    overall_score = round(
        (trend_score + momentum_score + breadth_score + volatility_score + sector_strength_score + model_confidence_score) / 6.0, 1
    )
    if overall_score >= 75:
        health_status = "Strong Health"
    elif overall_score >= 60:
        health_status = "Moderate Health"
    elif overall_score >= 45:
        health_status = "Cautious"
    else:
        health_status = "Weak Health"

    health_score = {
        "overall_score": overall_score,
        "trend_score": trend_score,
        "breadth_score": breadth_score,
        "momentum_score": momentum_score,
        "volatility_score": volatility_score,
        "sector_strength_score": sector_strength_score,
        "model_confidence_score": model_confidence_score,
        "status": health_status
    }

    # 5. AI Market Summary - templated from the real numbers computed above,
    # not a fixed narrative (the old copy referenced a static "Nifty at
    # 24,200" / "VIX at 13.8" regardless of what the market actually did).
    if nifty_trend.direction == "BULLISH":
        overall_sentiment = "BULLISH" if overall_score >= 65 else "CAUTIOUS BULLISH"
    elif nifty_trend.direction == "BEARISH":
        overall_sentiment = "BEARISH" if overall_score < 45 else "CAUTIOUS BEARISH"
    else:
        overall_sentiment = "NEUTRAL"

    concise_summary = (
        f"Nifty 50 trades at {nifty_last:,.2f} ({nifty_change_pct:+.2f}% today), tracking a "
        f"{nifty_trend.direction.lower()} 6-month trend (trend strength {nifty_trend.strength:.0f}/100). "
        f"India VIX is at {vix_analysis['vix_value']} ({vix_analysis['regime']} regime, "
        f"{vix_analysis['percentile']:.0f}th percentile of the past year)."
    )
    if strong_sector_names and weak_sector_names:
        concise_summary += f" {strong_sector_names[0]} leads sector performance today while {weak_sector_names[0]} lags."

    key_drivers = [
        f"{nifty_trend.direction.title()} Nifty 50 trend, {nifty_trend.strength:.0f}/100 trend strength over the last 6 months",
        f"India VIX at {vix_analysis['vix_value']} indicates a {vix_analysis['regime'].lower()} volatility regime",
        f"{full_buy_count} of {len(all_cards)} scanned stocks meet BUY-grade technical criteria (score ≥ 70)" if all_cards else "Market scan warming up - opportunity counts will populate shortly",
    ]

    primary_risks = []
    if vix_analysis["regime"] in ("Elevated", "Extreme"):
        primary_risks.append(f"Elevated India VIX ({vix_analysis['vix_value']}, {vix_analysis['regime'].lower()} regime) signals heightened hedging activity")
    if crude_price is not None:
        primary_risks.append(f"WTI Crude at ${crude_price:,.2f}/bbl ({crude_change_pct:+.2f}%) - a swing factor for input costs and inflation")
    if usdinr_price is not None:
        primary_risks.append(f"USD/INR at ₹{usdinr_price:,.2f} ({usdinr_change_pct:+.2f}%) affects import costs and IT/Pharma export margins")
    if weak_sector_names:
        primary_risks.append(f"{weak_sector_names[0]} showing relative weakness vs Nifty 50")
    if not primary_risks:
        primary_risks.append("No elevated risk signals detected in current scan")

    ai_summary = {
        "overall_sentiment": overall_sentiment,
        "concise_summary": concise_summary,
        "key_drivers": key_drivers,
        "strong_sectors": strong_sector_names,
        "weak_sectors": weak_sector_names,
        "primary_risks": primary_risks[:3],
        "top_opportunities": (
            [f"{full_buy_count} stocks meet BUY-grade criteria (score ≥ 70) in today's scan"]
            + ([f"{strong_sector_names[0]} showing the strongest relative sector momentum"] if strong_sector_names else [])
        ) if all_cards else ["Market scan in progress - check back shortly"]
    }

    # 6. Dedicated Market Risks Panel - every card backed by a real fetched
    # number (VIX, Bank Nifty as a rate-sensitivity proxy, crude, USD/INR,
    # Nifty trend strength) instead of static prose with invented figures.
    market_risks = [
        {
            "title": f"India VIX at {vix_analysis['vix_value']} ({vix_analysis['percentile']:.0f}th Percentile)",
            "category": "Volatility",
            "severity": "High" if vix_analysis["regime"] == "Extreme" else "Medium" if vix_analysis["regime"] == "Elevated" else "Low",
            "description": f"Volatility regime is currently classified as {vix_analysis['regime']}, based on trailing 1-year VIX percentile.",
            "impact_note": "Favorable environment for trend-following swing strategies." if vix_analysis["regime"] in ("Low", "Normal") else "Wider stops and reduced position sizing are warranted while volatility remains elevated."
        },
        {
            "title": f"Bank Nifty {bank_nifty_trend.direction.title()} ({bank_nifty_trend.momentum:.0f}/100 Momentum)",
            "category": "Economic",
            "severity": "Medium" if bank_nifty_trend.direction == "BEARISH" else "Low",
            "description": f"Bank Nifty, a proxy for rate-sensitive financials, shows a {bank_nifty_trend.direction.lower()} trend with {bank_nifty_trend.strength:.0f}/100 trend strength over 6 months.",
            "impact_note": "Rate-sensitive banking and auto sectors typically re-price in line with this trend."
        },
    ]
    if crude_price is not None:
        market_risks.append({
            "title": f"WTI Crude Oil at ${crude_price:,.2f}/Barrel ({crude_change_pct:+.2f}%)",
            "category": "Commodity",
            "severity": "Medium" if abs(crude_change_pct) >= 2.0 else "Low",
            "description": "Fluctuations in global crude prices affect input costs for paints, tires, and oil marketing companies.",
            "impact_note": "Slight margin drag for consumer discretionary and chemicals when crude trends higher."
        })
    if usdinr_price is not None:
        market_risks.append({
            "title": f"USD/INR at ₹{usdinr_price:,.2f} ({usdinr_change_pct:+.2f}%)",
            "category": "Currency",
            "severity": "Medium" if abs(usdinr_change_pct) >= 0.5 else "Low",
            "description": "Indian Rupee movement against the US Dollar, tracked from live FX spot data.",
            "impact_note": "A weaker Rupee provides export revenue tailwinds for IT exporters and Pharma; a stronger Rupee compresses those margins."
        })
    market_risks.append({
        "title": f"Nifty 50 {nifty_trend.direction.title()} Trend ({nifty_trend.strength:.0f}/100 Strength)",
        "category": "Global",
        "severity": "Medium" if nifty_trend.direction == "BEARISH" else "Low",
        "description": f"Broad market trend strength over the last 6 months, based on {DEFAULT_BENCHMARK_INDEX} regression fit.",
        "impact_note": "Drives overall risk appetite and FII/DII flow direction across Indian equities."
    })

    payload = {
        "updated_at": datetime.utcnow().isoformat(),
        "ai_summary": ai_summary,
        "health_score": health_score,
        "sectors": sectors_list,
        "buy_candidates": buy_candidates,
        "watch_candidates": watch_candidates,
        "avoid_candidates": avoid_candidates,
        "market_risks": market_risks
    }

    live_cache.set_analysis(CACHE_KEY, "1d", datetime.now(live_cache.timezone), payload)
    return payload

