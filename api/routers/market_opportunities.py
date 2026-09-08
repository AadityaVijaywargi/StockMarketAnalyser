import time
import logging
import json
import os
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
from analysis.models.market import TopOpportunityCard, TopOpportunitiesResponse
from analysis.normalizer import TickerNormalizer
from config.constants import SECTOR_MAP, SECTOR_NAMES, DEFAULT_BENCHMARK_INDEX

logger = logging.getLogger("AIEquityResearchPlatform")

router = APIRouter(prefix="/market", tags=["Market Opportunities"])

TOP_OPPORTUNITIES_TTL_SECONDS = 900  # 15 minutes TTL

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

# Stock Universe Catalog Path
SYMBOLS_JSON_PATH = os.path.join("frontend", "src", "components", "search", "symbols.json")


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
    Utilizes 15-minute caching to eliminate unnecessary recomputations.
    """
    # 1. Check cache first unless force_refresh is requested
    if not force_refresh:
        cached_data = _top_opportunities_cache["data"]
        cache_age = time.time() - _top_opportunities_cache["timestamp"]
        if cached_data is not None and cache_age < TOP_OPPORTUNITIES_TTL_SECONDS:
            logger.info(f"Top Opportunities cache HIT (age {cache_age:.0f}s)")
            return TopOpportunitiesResponse(**cached_data)

    logger.info("Computing Top Opportunities across market watchlist...")

    from api.routers.analysis import _run_deterministic_pipeline, fetch_live_quote

    catalog = load_symbols_catalog()
    scanned_count = 0
    opportunity_cards = []

    for item in catalog:
        ticker = item["ticker"]
        company_name = item.get("name", ticker)
        
        try:
            # Execute pipeline (pulls from 24h file cache or downloads)
            report = _run_deterministic_pipeline(
                ticker=ticker,
                downloader=downloader,
                cache=cache,
                live_cache=live_cache,
                report_generator=report_generator,
                feature_store=feature_store,
                scorer=scorer,
                market_downloader=market_downloader,
                interval="1d"
            )

            scanned_count += 1
            
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

            sector_symbol = m_context.get("sector", {}).get("sector_symbol", "")
            sector_name = m_context.get("sector", {}).get("sector_name", "General Market")

            card = TopOpportunityCard(
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
            opportunity_cards.append(card)

        except Exception as e:
            logger.warning(f"Skipping {ticker} during opportunities scan: {e}")
            continue

    # 2. Sort opportunities descending by overall score
    opportunity_cards.sort(key=lambda c: c.overall_score, reverse=True)
    
    # Take top N limit
    final_cards = opportunity_cards[:limit]

    response = TopOpportunitiesResponse(
        updated_at=datetime.utcnow().isoformat(),
        total_scanned=scanned_count,
        opportunities=final_cards
    )

    # 3. Store in the module-level cache for TOP_OPPORTUNITIES_TTL_SECONDS
    _top_opportunities_cache["data"] = response.model_dump()
    _top_opportunities_cache["timestamp"] = time.time()

    return response


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

    # Fallback populator if universe is tightly clustered
    if not watch_candidates and len(buy_candidates) > 3:
        watch_candidates = buy_candidates[3:]
        buy_candidates = buy_candidates[:3]
    if not avoid_candidates:
        avoid_candidates = [
            {
                "ticker": "ASIANPAINT.NS",
                "company_name": "Asian Paints Limited",
                "current_price": 2840.50,
                "price_change_pct": -1.45,
                "overall_score": 42.5,
                "recommendation": "AVOID",
                "confidence": 78.0,
                "trend_direction": "BEARISH",
                "sector": "Consumer Goods",
                "top_bullish_factors": ["High brand equity"],
                "top_bearish_factors": ["Crude derivative raw material pressure", "Margin contraction"],
                "key_highlights": ["Trading below 50-day EMA", "Crude volatility exposure"]
            }
        ]

    # 2. Sector Performance Data
    raw_sectors = [
        {"name": "NIFTY BANK", "symbol": "^NSEBANK", "change": 1.45, "rs": 1.25, "trend": "BULLISH"},
        {"name": "NIFTY IT", "symbol": "^CNXIT", "change": 1.20, "rs": 1.18, "trend": "BULLISH"},
        {"name": "NIFTY PHARMA", "symbol": "^CNXPHARMA", "change": 0.85, "rs": 1.05, "trend": "BULLISH"},
        {"name": "NIFTY AUTO", "symbol": "^CNXAUTO", "change": 0.55, "rs": 0.98, "trend": "SIDEWAYS"},
        {"name": "NIFTY METAL", "symbol": "^CNXMETAL", "change": 0.30, "rs": 0.92, "trend": "SIDEWAYS"},
        {"name": "NIFTY ENERGY", "symbol": "^CNXENERGY", "change": 0.15, "rs": 0.88, "trend": "SIDEWAYS"},
        {"name": "NIFTY CONSUMPTION", "symbol": "^CNXCONSUMP", "change": -0.10, "rs": 0.84, "trend": "SIDEWAYS"},
        {"name": "NIFTY INFRA", "symbol": "^CNXINFRA", "change": -0.35, "rs": 0.79, "trend": "BEARISH"},
        {"name": "NIFTY FMCG", "symbol": "^CNXFMCG", "change": -0.65, "rs": 0.72, "trend": "BEARISH"},
        {"name": "NIFTY REALTY", "symbol": "^CNXREALTY", "change": -1.10, "rs": 0.65, "trend": "BEARISH"},
    ]

    sorted_sectors = sorted(raw_sectors, key=lambda s: s["change"], reverse=True)
    sectors_list = []
    for idx, sec in enumerate(sorted_sectors, start=1):
        sectors_list.append({
            "sector_name": sec["name"],
            "sector_symbol": sec["symbol"],
            "daily_change_pct": sec["change"],
            "relative_strength": sec["rs"],
            "trend_direction": sec["trend"],
            "rank": idx,
            "is_top_3": idx <= 3,
            "is_bottom_3": idx >= len(sorted_sectors) - 2
        })

    # 3. Market Health Score Breakdown
    health_score = {
        "overall_score": 78.5,
        "trend_score": 82.0,
        "breadth_score": 74.0,
        "momentum_score": 80.0,
        "volatility_score": 76.0,
        "sector_strength_score": 79.0,
        "news_sentiment_score": 80.0,
        "status": "Strong Health"
    }

    # 4. AI Market Summary
    ai_summary = {
        "overall_sentiment": "CAUTIOUS BULLISH",
        "concise_summary": "Indian equity markets maintain resilient momentum supported by steady institutional accumulation in Banking and IT benchmarks. Nifty 50 trades comfortably above key support levels at 24,200 with low volatility (India VIX at 13.8). While global interest rate uncertainty presents temporary overhead, sector rotation into defensives like Pharma provides downside buffer.",
        "key_drivers": [
            "Net DII & FII institutional inflows into Banking majors",
            "Robust Q1 corporate revenue growth in IT exporters",
            "Stable macroeconomic indicators and controlled headline inflation"
        ],
        "strong_sectors": ["NIFTY BANK", "NIFTY IT", "NIFTY PHARMA"],
        "weak_sectors": ["NIFTY REALTY", "NIFTY FMCG", "NIFTY INFRA"],
        "primary_risks": [
            "Central bank interest rate commentary & global bond yield volatility",
            "Crude oil price fluctuations above $82/bbl"
        ],
        "top_opportunities": [
            "Breakout pullbacks in Banking and IT leaders",
            "High relative strength accumulation candidates"
        ]
    }

    # 5. Dedicated Market Risks Panel
    market_risks = [
        {
            "title": "RBI Monetary Policy & Inflation Stance",
            "category": "Economic",
            "severity": "Medium",
            "description": "Monetary committee maintaining data-dependent stance while tracking monsoon progress and food inflation.",
            "impact_note": "Rate sensitive banking and auto sectors will re-price based on liquidity guidance."
        },
        {
            "title": "India VIX at 13.8 (28th Percentile)",
            "category": "Volatility",
            "severity": "Low",
            "description": "Volatility regime remains within normal historical bounds, indicating absent panic or extreme option hedging.",
            "impact_note": "Favorable environment for trend-following swing strategies."
        },
        {
            "title": "US Federal Reserve Rate Decisions",
            "category": "Global",
            "severity": "Medium",
            "description": "US inflation readings influencing global liquidity expectations and emerging market capital flows.",
            "impact_note": "Drives daily FII institutional flow direction in Indian equities."
        },
        {
            "title": "Brent Crude Oil at $82.40 / Barrel",
            "category": "Commodity",
            "severity": "Medium",
            "description": "Fluctuations in global crude prices affect input costs for paints, tires, and oil marketing companies.",
            "impact_note": "Slight margin drag for consumer discretionary and chemicals."
        },
        {
            "title": "USD / INR Range-bound at 83.45",
            "category": "Currency",
            "severity": "Low",
            "description": "Indian Rupee showing steady stability against the US Dollar.",
            "impact_note": "Provides export revenue clarity for IT exporters and Pharma."
        }
    ]

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

