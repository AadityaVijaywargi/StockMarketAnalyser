from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import health, analysis, market_opportunities, intelligence
from api.exceptions import PlatformException, platform_exception_handler, generic_exception_handler

def create_app() -> FastAPI:
    """
    Creates and configures the FastAPI application instance.
    Registers middleware, exception handlers, and API endpoints.
    """
    app = FastAPI(
        title="AI Equity Research Platform",
        description="Quantitative technical analysis, macro-economic context, and explanation engine API.",
        version="1.0.0"
    )
    
    # Enable Cross-Origin Resource Sharing (CORS)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include Router Endpoints
    app.include_router(health.router)
    app.include_router(analysis.router)
    app.include_router(market_opportunities.router)
    app.include_router(intelligence.router)
    
    # Register Centralized Error Handlers
    app.add_exception_handler(PlatformException, platform_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
    
    return app
