import logging
from analysis.downloader import YahooDownloader
from analysis.cache import FileCacheManager, InMemoryLiveCache
from analysis.feature_store import FeatureStore
from analysis.scoring import RuleBasedScorer
from analysis.prediction_engine import DeterministicPredictionEngine
from market.market_downloader import MarketDownloader
from intelligence import LLMResponseCache, GeminiProvider, PromptBuilder, ReportGenerator
from config.settings import settings

logger = logging.getLogger("AIEquityResearchPlatform")

# Singleton instances initialized on startup
_downloader = YahooDownloader()
_cache = FileCacheManager(cache_dir=settings.CACHE_DIR)
_live_cache = InMemoryLiveCache()
_feature_store = FeatureStore(features_dir=settings.FEATURES_DIR)
_scorer = RuleBasedScorer(weights=settings.SCORE_WEIGHTS)
_prediction_engine = DeterministicPredictionEngine()
_market_downloader = MarketDownloader()

# Intelligence Layer Singletons
_llm_cache = LLMResponseCache()
_llm_provider = GeminiProvider()
_prompt_builder = PromptBuilder()
_report_generator = ReportGenerator(provider=_llm_provider, prompt_builder=_prompt_builder, cache=_llm_cache)

def get_downloader() -> YahooDownloader:
    return _downloader

def get_cache() -> FileCacheManager:
    return _cache

def get_live_cache() -> InMemoryLiveCache:
    return _live_cache

def get_feature_store() -> FeatureStore:
    return _feature_store

def get_scorer() -> RuleBasedScorer:
    return _scorer

def get_prediction_engine() -> DeterministicPredictionEngine:
    return _prediction_engine

def get_market_downloader() -> MarketDownloader:
    return _market_downloader

def get_report_generator() -> ReportGenerator:
    return _report_generator

# Market Intelligence Singleton
from intelligence.market_intelligence import MarketIntelligenceEngine
_market_intelligence_engine = MarketIntelligenceEngine()

def get_market_intelligence_engine() -> MarketIntelligenceEngine:
    return _market_intelligence_engine
