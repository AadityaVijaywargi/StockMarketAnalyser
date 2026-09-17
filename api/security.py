"""
Transport and browser-hardening middleware.

Two concerns live here:

1. `force_https` - redirect plain HTTP to HTTPS. Vercel and Render both
   terminate TLS at their edge and already redirect, so in the normal
   deployment this never fires; it exists so the guarantee doesn't depend
   on a specific host's default staying switched on.
2. `security_headers` - the response headers that tell browsers to keep
   using HTTPS (HSTS), not to sniff content types, not to leak full URLs
   in referrers, and which origins may supply scripts (CSP).

Both are no-ops outside production so local http://localhost development
is unaffected.
"""
from typing import Callable

from fastapi import Request
from fastapi.responses import RedirectResponse, Response

# The API serves JSON and the interactive docs, never the React app, so the
# policy can be strict about what it will load. 'unsafe-inline' is required
# for style-src because Swagger UI (/docs) injects inline styles.
_CSP = "; ".join([
    "default-src 'none'",
    "script-src 'self' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "img-src 'self' data: https://fastapi.tiangolo.com",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
])

# 2 years, the value HSTS preload lists require.
_HSTS = "max-age=63072000; includeSubDomains"


def _is_secure(request: Request) -> bool:
    """
    True when the original client request used HTTPS.

    Behind a TLS-terminating proxy the socket itself is plain HTTP, so the
    X-Forwarded-Proto header set by the proxy is what actually describes the
    client hop.
    """
    forwarded = request.headers.get("x-forwarded-proto")
    if forwarded:
        return forwarded.split(",")[0].strip() == "https"
    return request.url.scheme == "https"


def register_security(app, *, production: bool) -> None:
    """Attach the HTTPS redirect and security-header middleware to `app`."""

    @app.middleware("http")
    async def security_headers(request: Request, call_next: Callable) -> Response:
        if production and not _is_secure(request):
            # 307 keeps the method and body, so a POSTed form isn't silently
            # downgraded to a GET on redirect.
            return RedirectResponse(
                str(request.url.replace(scheme="https")),
                status_code=307,
            )

        response = await call_next(request)

        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Content-Security-Policy", _CSP)
        response.headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()"
        )
        if production:
            # Only meaningful over HTTPS, and actively harmful to send on a
            # local http:// dev server (it would pin localhost to HTTPS in the
            # developer's browser for two years).
            response.headers.setdefault("Strict-Transport-Security", _HSTS)
        return response
