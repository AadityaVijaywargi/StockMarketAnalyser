from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from api.routers import health, analysis, market_opportunities, intelligence, backtest, auth, user_data, access, paper
from api.auth import decode_access_token
from api.exceptions import PlatformException, platform_exception_handler, generic_exception_handler
from api.security import register_security
from api.startup_checks import check_config, is_production
from config.settings import settings
import jwt

# Paths reachable without a login session
# Paths reachable without a login session.
# Note /access-requests is public for POST only - the GET and DELETE on the
# same path are admin review endpoints, guarded by the route dependency
# rather than by this set, which cannot distinguish methods.
PUBLIC_PATHS = {
    "/", "/health", "/auth/login", "/auth/signup",
    "/access-requests",
    "/docs", "/openapi.json", "/redoc",
}

def create_app(run_paper_bot: bool = False) -> FastAPI:
    """
    Creates and configures the FastAPI application instance.
    Registers middleware, exception handlers, and API endpoints.

    run_paper_bot starts the paper trading background thread (target/stop
    checks + bot) for the app's lifetime. Only the real server entrypoint
    (main.py) turns it on, so the test suite never spawns it.
    """
    # Refuse to start with a config that would make sessions forgeable.
    check_config(settings)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        if run_paper_bot:
            from api import paper_bot
            paper_bot.start()
        yield
        if run_paper_bot:
            paper_bot.stop()

    app = FastAPI(
        title="AI Equity Research Platform",
        description="Quantitative technical analysis, macro-economic context, and explanation engine API.",
        version="1.0.0",
        lifespan=lifespan,
    )

    production = is_production(settings)

    # Cross-Origin Resource Sharing, restricted to origins we actually serve.
    # allow_origins=["*"] together with allow_credentials=True would let any
    # website on the internet issue authenticated requests using a logged-in
    # visitor's session, so the list is explicit and configured per deploy.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origin_list,
        allow_origin_regex=settings.allowed_origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # Registered after CORS so it runs first on the way in (Starlette applies
    # middleware in reverse registration order) and the HTTPS redirect happens
    # before anything else touches the request.
    register_security(app, production=production)

    def _unauthenticated(request: Request, detail: str) -> JSONResponse:
        # This middleware sits outside CORSMiddleware, so a response returned
        # here without calling call_next() never passes through it and would
        # otherwise arrive at the browser with no CORS headers — which surfaces
        # to the frontend as an opaque "CORS policy" network error instead of a
        # readable 401, breaking the auto-redirect-to-login on session expiry.
        origin = request.headers.get("origin")
        headers = {"Access-Control-Allow-Origin": origin} if origin else {}
        if origin:
            headers["Vary"] = "Origin"
        return JSONResponse(status_code=401, content={"detail": detail}, headers=headers)

    @app.middleware("http")
    async def require_login_session(request: Request, call_next):
        if request.method == "OPTIONS" or request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        token = auth_header[len("Bearer "):] if auth_header.startswith("Bearer ") else None
        if not token:
            return _unauthenticated(request, "Not authenticated")
        try:
            decode_access_token(token)
        except jwt.PyJWTError:
            return _unauthenticated(request, "Invalid or expired session")

        return await call_next(request)

    # Include Router Endpoints
    app.include_router(auth.router)
    app.include_router(health.router)
    app.include_router(analysis.router)
    app.include_router(market_opportunities.router)
    app.include_router(intelligence.router)
    app.include_router(backtest.router)
    app.include_router(user_data.router)
    app.include_router(access.router)
    app.include_router(paper.router)

    # Register Centralized Error Handlers
    app.add_exception_handler(PlatformException, platform_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
    
    return app
