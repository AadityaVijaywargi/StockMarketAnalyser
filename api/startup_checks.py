"""
Configuration sanity checks run when the app is created.

Misconfiguration here fails silently in the worst way: an empty
JWT_SECRET_KEY still signs tokens - with an empty key anyone can use to
forge an admin session - and a missing DATABASE_URL quietly puts accounts
and user data on disk that the host wipes on every deploy.
"""
import logging
import os
from typing import List

from config.settings import Settings

logger = logging.getLogger("AIEquityResearchPlatform")

MIN_JWT_SECRET_LENGTH = 32


class InsecureConfigError(RuntimeError):
    pass


def is_production(settings: Settings) -> bool:
    # Render sets RENDER=true on every service, so production is detected even
    # if ENV was never set there.
    return settings.ENV == "production" or bool(os.environ.get("RENDER"))


def check_config(settings: Settings) -> List[str]:
    """Raises InsecureConfigError for fatal problems; returns (and logs) warnings."""
    if not settings.JWT_SECRET_KEY:
        raise InsecureConfigError(
            "JWT_SECRET_KEY is not set, so session tokens would be signed with an empty key "
            "and could be forged by anyone. Generate one with: "
            "python -c \"import secrets; print(secrets.token_hex(32))\""
        )

    warnings: List[str] = []
    if len(settings.JWT_SECRET_KEY) < MIN_JWT_SECRET_LENGTH:
        warnings.append(
            f"JWT_SECRET_KEY is shorter than {MIN_JWT_SECRET_LENGTH} characters; use a long random value."
        )

    hash_parts = settings.ADMIN_PASSWORD_HASH.split("$", 1)
    if not settings.ADMIN_PASSWORD_HASH:
        warnings.append("ADMIN_PASSWORD_HASH is not set; the admin account cannot log in.")
    elif len(hash_parts) != 2 or not all(_is_hex(part) for part in hash_parts):
        warnings.append("ADMIN_PASSWORD_HASH is not in 'salt$hash' hex format; the admin account cannot log in.")

    if is_production(settings) and not settings.DATABASE_URL:
        warnings.append(
            "DATABASE_URL is not set in production: user accounts, invites and synced data are stored "
            "on local disk and will be lost on the next deploy."
        )

    for message in warnings:
        logger.warning("Config check: %s", message)
    return warnings


def _is_hex(value: str) -> bool:
    try:
        bytes.fromhex(value)
        return bool(value)
    except ValueError:
        return False
