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

# In-Memory Cache Key for Top Opportunities
TOP_OPPORTUNITIES_CACHE_KEY = "top_market_opportunities"
TOP_OPPORTUNITIES_TTL_SECONDS = 900  # 15 minutes TTL

# Stock Universe Catalog Path
SYMBOLS_JSON_PATH = os.path.join("frontend", "src", "components", "search", "symbols.json")


def load_symbols_catalog() -> List[Dict[str, str]]:
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
        cached_data = live_cache.get_analysis(TOP_OPPORTUNITIES_CACHE_KEY, "1d")
        if cached_data is not None:
            logger.info("Top Opportunities cache HIT")
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

    # 3. Store in live cache for 15 minutes
    live_cache.set_analysis(TOP_OPPORTUNITIES_CACHE_KEY, "1d", datetime.now(live_cache.timezone), response.model_dump())

    return response
