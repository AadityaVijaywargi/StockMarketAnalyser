from fastapi import Request
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger("AIEquityResearchPlatform")

class PlatformException(Exception):
    """Base exception for the AI Equity Research Platform."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class TickerValidationError(PlatformException):
    """Exception raised when a ticker format is invalid."""
    def __init__(self, message: str):
        super().__init__(message, status_code=400)


class TickerNotFoundError(PlatformException):
    """Exception raised when a ticker cannot be found or is invalid on Yahoo Finance."""
    def __init__(self, ticker: str):
        super().__init__(f"Stock not found", status_code=404)


class DownloaderError(PlatformException):
    """Exception raised when yfinance fails to download price data."""
    def __init__(self, ticker: str, details: str):
        super().__init__(f"Failed to retrieve data for '{ticker}'. Details: {details}", status_code=502)


class InsufficientDataError(PlatformException):
    """Exception raised when downloaded data is too short for indicator calculation."""
    def __init__(self, ticker: str, length: int):
        super().__init__(
            f"Insufficient historical data for '{ticker}'. Required: at least 250 rows. Found: {length}.",
            status_code=400
        )


async def platform_exception_handler(request: Request, exc: PlatformException) -> JSONResponse:
    """Central handler for custom platform exceptions."""
    logger.error(
        f"API Exception on {request.url.path}: {exc.message}",
        extra={"status_code": exc.status_code}
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message}
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler for unexpected system errors."""
    logger.error(f"Unhandled system exception on {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred."}
    )
