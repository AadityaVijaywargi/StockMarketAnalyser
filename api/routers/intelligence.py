import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status
from pydantic import BaseModel, Field

from api.deps import (
    get_report_generator, get_downloader, get_cache, get_live_cache,
    get_feature_store, get_scorer, get_market_downloader
)
from api.routers.analysis import _run_deterministic_pipeline
from intelligence.report_generator import ReportGenerator

logger = logging.getLogger("AIEquityResearchPlatform")

router = APIRouter(prefix="/intelligence", tags=["AI Intelligence Engine"])


class IntelligenceReportRequest(BaseModel):
    ticker: Optional[str] = Field(default=None, example="RELIANCE.NS", description="Stock ticker symbol")
    timeframe: Optional[str] = Field(default="1d", example="1d", description="Candle interval")
    analysis_report: Optional[Dict[str, Any]] = Field(default=None, description="Deterministic analysis report dictionary")


@router.post("/report", response_model=Dict[str, Any])
async def generate_intelligence_report(
    payload: IntelligenceReportRequest = Body(...),
    report_generator: ReportGenerator = Depends(get_report_generator),
    downloader = Depends(get_downloader),
    cache = Depends(get_cache),
    live_cache = Depends(get_live_cache),
    feature_store = Depends(get_feature_store),
    scorer = Depends(get_scorer),
    market_downloader = Depends(get_market_downloader)
):
    """
    POST /intelligence/report
    Generates an institutional AI research report by converting deterministic quantitative evidence.
    Accepts either an existing analysis report payload or a ticker/timeframe pair.
    """
    import time
    t_start = time.time()
    ticker = payload.ticker
    timeframe = payload.timeframe or "1d"
    analysis_report = payload.analysis_report
    logger.info(f"START POST /intelligence/report for {ticker}")

    # If deterministic analysis report wasn't provided, run pipeline to generate it
    if not analysis_report:
        if not ticker:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Request must contain either 'analysis_report' dictionary or 'ticker' symbol."
            )
        analysis_report = _run_deterministic_pipeline(
            ticker=ticker,
            downloader=downloader,
            cache=cache,
            live_cache=live_cache,
            report_generator=report_generator,
            feature_store=feature_store,
            scorer=scorer,
            market_downloader=market_downloader,
            interval=timeframe,
            debug_mode=False
        )

    ticker = ticker or analysis_report.get("ticker", "UNKNOWN")
    
    # Generate AI research report
    ai_report = report_generator.generate_report(ticker=ticker, timeframe=timeframe, report_dict=analysis_report)
    
    # Return merged payload
    merged_response = dict(analysis_report)
    merged_response["ai_research_report"] = ai_report
    elapsed_ms = round((time.time() - t_start) * 1000, 2)
    logger.info(f"Response returned for POST /intelligence/report ({elapsed_ms} ms)")
    return merged_response


@router.get("/news/{ticker}", response_model=Dict[str, Any])
async def get_market_intelligence_news(
    ticker: str,
    company_name: Optional[str] = Query(default="", description="Optional company name"),
    sector_name: Optional[str] = Query(default="", description="Optional sector name")
):
    """
    GET /intelligence/news/{ticker}
    Gathers news articles, corporate events, macro trends, and market sentiment metrics into an IntelligencePack.
    """
    import time
    from analysis.normalizer import TickerNormalizer
    from api.deps import get_market_intelligence_engine
    
    t_start = time.time()
    logger.info(f"START GET /intelligence/news/{ticker}")
    processed_ticker = TickerNormalizer.normalize(ticker)
    intel_engine = get_market_intelligence_engine()
    
    intel_pack = intel_engine.get_intelligence_pack(
        ticker=processed_ticker,
        company_name=company_name or processed_ticker.split(".")[0],
        sector_name=sector_name or "General Market"
    )
    elapsed_ms = round((time.time() - t_start) * 1000, 2)
    logger.info(f"Response returned for GET /intelligence/news/{ticker} ({elapsed_ms} ms)")
    return intel_pack.model_dump()
