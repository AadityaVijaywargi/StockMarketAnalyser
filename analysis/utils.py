import json
import logging
import os
import sys
import time
from logging.handlers import RotatingFileHandler
from typing import Optional, Any, Dict

class StructuredFormatter(logging.Formatter):
    """
    Custom logging formatter that outputs JSON lines for structured logging.
    Includes custom fields such as ticker and execution_time if provided in 'extra'.
    """
    def __init__(self, datefmt: Optional[str] = None):
        super().__init__(datefmt=datefmt)

    def format(self, record: logging.LogRecord) -> str:
        # Default record fields
        log_record: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "module": record.module,
            "levelname": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "line": record.lineno,
        }
        
        # Capture custom extra fields if they are attached to the LogRecord
        ticker = getattr(record, "ticker", None)
        if ticker:
            log_record["ticker"] = ticker
            
        execution_time = getattr(record, "execution_time", None)
        if execution_time is not None:
            log_record["execution_time_ms"] = execution_time

        return json.dumps(log_record)


class StructuredTextFormatter(logging.Formatter):
    """
    Development-friendly human-readable text formatter showing structured fields.
    Format: [TIMESTAMP] LEVEL - [MODULE:LINE] - MSG | ticker=XYZ exec=12.3ms
    """
    def __init__(self, datefmt: Optional[str] = None):
        super().__init__(datefmt=datefmt)

    def format(self, record: logging.LogRecord) -> str:
        timestamp = self.formatTime(record, self.datefmt)
        module_info = f"{record.module}:{record.lineno}"
        message = record.getMessage()
        
        extra_info = []
        ticker = getattr(record, "ticker", None)
        if ticker:
            extra_info.append(f"ticker={ticker}")
            
        execution_time = getattr(record, "execution_time", None)
        if execution_time is not None:
            extra_info.append(f"execution_time={execution_time:.2f}ms")

        extra_str = f" | {' '.join(extra_info)}" if extra_info else ""
        return f"[{timestamp}] {record.levelname:<7} - [{module_info:<15}] - {message}{extra_str}"


def setup_logging(
    log_level: str = "INFO",
    log_to_console: bool = True,
    log_to_file: bool = True,
    log_file_path: str = "storage/logs/platform.log",
    structured_json: bool = False,
    force_reconfigure: bool = False
) -> logging.Logger:
    """
    Configures the application-wide logging system.
    Supports console logging, rotating file logging, and structured JSON output.
    """
    # Convert string log level to logging int value
    if isinstance(log_level, int):
        numeric_level = log_level
    else:
        numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    logger = logging.getLogger("AIEquityResearchPlatform")
    logger.setLevel(numeric_level)
    
    # Avoid duplicate handlers if setup is called multiple times
    if logger.handlers and not force_reconfigure:
        return logger

    # Clear existing handlers if force reconfiguring
    if force_reconfigure:
        for handler in logger.handlers[:]:
            handler.close()
            logger.removeHandler(handler)

    # Pick formatters based on structured setting
    if structured_json:
        formatter = StructuredFormatter()
    else:
        formatter = StructuredTextFormatter()

    if log_to_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)

    if log_to_file:
        # Create storage logs directory if it doesn't exist
        log_dir = os.path.dirname(log_file_path)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)
            
        file_handler = RotatingFileHandler(
            log_file_path,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger

# Default logger setup
logger = setup_logging()


class StructuredLoggerAdapter(logging.LoggerAdapter):
    """
    Logger adapter to easily pass structured fields (ticker, execution_time) to log calls.
    Usage:
        adapter = StructuredLoggerAdapter(logger, {"ticker": "RELIANCE.NS"})
        adapter.info("Starting download", extra={"execution_time": 123.45})
    """
    def __init__(self, logger: logging.Logger, extra_defaults: Optional[Dict[str, Any]] = None):
        super().__init__(logger, extra_defaults or {})

    def process(self, msg: Any, kwargs: Any) -> tuple[Any, Any]:
        extra = kwargs.setdefault("extra", {})
        # Merge adapter defaults with custom extra call arguments
        for k, v in self.extra.items():
            if k not in extra:
                extra[k] = v
        return msg, kwargs
