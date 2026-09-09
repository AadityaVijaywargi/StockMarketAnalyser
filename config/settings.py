import os
from typing import Dict, List, Any
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from config.weights import DEFAULT_SCORE_WEIGHTS, DEFAULT_BUY_THRESHOLD, DEFAULT_WATCH_THRESHOLD, INDICATOR_SETTINGS, PREDICTION_HORIZON_WEIGHTS, EVENT_OVERRIDE_IMPORTANCE_THRESHOLD
from config.constants import SUPPORTED_TIMEFRAMES, MARKET_TIMEZONE

class Settings(BaseSettings):
    """
    App settings loaded from environment variables or .env file.
    All configurable parameters are centralized here.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # General Environment settings
    ENV: str = Field(default="development", description="Application environment (development/production/test)")
    LOG_LEVEL: str = Field(default="INFO", description="Log level (DEBUG/INFO/WARNING/ERROR)")
    LOG_TO_CONSOLE: bool = Field(default=True)
    LOG_TO_FILE: bool = Field(default=True)
    LOG_FILE_PATH: str = Field(default="storage/logs/platform.log")
    LOG_STRUCTURED_JSON: bool = Field(default=False, description="Log in JSON format when True")
    
    # Storage Paths (relative to project root)
    STORAGE_BASE: str = Field(default="storage", description="Base directory for local storage")
    CACHE_DIR: str = Field(default="storage/cache", description="Directory for raw OHLCV cache")
    FEATURES_DIR: str = Field(default="storage/features", description="Directory for feature store Parquet files")
    REPORTS_DIR: str = Field(default="storage/reports", description="Directory for final JSON analyst reports")
    MARKET_DIR: str = Field(default="storage/market", description="Directory for index/macro data")
    NEWS_DIR: str = Field(default="storage/news", description="Directory for news data (future support)")

    # Data Source & Caching Configuration
    DATA_PROVIDER: str = Field(default="yahoo", description="Historical price data provider (e.g. yahoo, nse)")
    DEFAULT_YEARS_DATA: int = Field(default=5, description="Number of years of historical data to download (2 to 5)")
    PRIMARY_WINDOW_MONTHS: int = Field(default=6, description="Analysis window in months for detailed scanning")
    CACHE_EXPIRY_SECONDS: int = Field(default=86400, description="Cache TTL in seconds (default 24 hours)")
    
    # Market Trading Clock Rules
    MARKET_TIMEZONE: str = Field(default=MARKET_TIMEZONE, description="Market timezone (e.g. Asia/Kolkata)")
    
    # Supported Timeframes
    ANALYSIS_WINDOWS: List[str] = Field(default_factory=lambda: SUPPORTED_TIMEFRAMES)

    # Technical Indicator Calculation Lengths
    INDICATOR_PERIODS: Dict[str, Any] = Field(default_factory=lambda: INDICATOR_SETTINGS)
    
    # LLM Configuration
    GEMINI_API_KEY: str = Field(default="", description="API key for Gemini LLM model")
    GEMINI_MODEL: str = Field(default="gemini-2.5-flash", description="Gemini model for explanation generation")
    GEMINI_TEMPERATURE: float = Field(default=0.1, description="Model sampling temperature")
    GEMINI_MAX_OUTPUT_TOKENS: int = Field(default=2048, description="Maximum output tokens for report generation")
    GEMINI_TIMEOUT_SECONDS: int = Field(default=30, description="Timeout in seconds for model response")
    PROMPT_VERSION: str = Field(default="1.0", description="Active prompt structure version string")

    # Scoring Weights & Decision Thresholds
    SCORE_WEIGHTS: Dict[str, float] = Field(default_factory=lambda: DEFAULT_SCORE_WEIGHTS)
    BUY_THRESHOLD: float = Field(default=DEFAULT_BUY_THRESHOLD)
    WATCH_THRESHOLD: float = Field(default=DEFAULT_WATCH_THRESHOLD)
    PREDICTION_HORIZON_WEIGHTS: Dict[str, Dict[str, float]] = Field(default_factory=lambda: PREDICTION_HORIZON_WEIGHTS)
    EVENT_OVERRIDE_IMPORTANCE_THRESHOLD: float = Field(default=EVENT_OVERRIDE_IMPORTANCE_THRESHOLD)

    # API Server Settings
    API_HOST: str = Field(default="127.0.0.1")
    API_PORT: int = Field(default=8000)

    # Authentication Settings
    JWT_SECRET_KEY: str = Field(default="", description="Secret key used to sign login session tokens")
    JWT_ALGORITHM: str = Field(default="HS256")
    JWT_EXPIRY_HOURS: int = Field(default=24 * 7, description="Login session validity in hours")
    ADMIN_USERNAME: str = Field(default="admin")
    ADMIN_PASSWORD_HASH: str = Field(default="", description="PBKDF2 hash of the admin password, format salt$hash")

    # Optional persistent database for invited-user accounts/invites (see
    # api/db.py). storage/users.json lives on local disk, which most PaaS
    # free tiers wipe on every redeploy - set this to a Postgres connection
    # string (e.g. Render's free/paid Postgres, Supabase, Neon) to persist
    # real accounts across deploys. Left unset, nothing changes: user_store.py
    # keeps using the JSON file exactly as before.
    DATABASE_URL: str = Field(default="", description="Postgres connection string for persistent user/invite storage")

    def create_directories(self) -> None:
        """Helper to ensure all storage directories exist."""
        for path in [
            self.STORAGE_BASE,
            self.CACHE_DIR,
            self.FEATURES_DIR,
            self.REPORTS_DIR,
            self.MARKET_DIR,
            self.NEWS_DIR,
            os.path.dirname(self.LOG_FILE_PATH)
        ]:
            os.makedirs(path, exist_ok=True)

# Instantiated settings instance
settings = Settings()
# Ensure directories are created on startup
settings.create_directories()
