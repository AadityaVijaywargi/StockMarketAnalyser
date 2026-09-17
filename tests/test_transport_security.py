"""
Transport hardening: HTTPS redirect, security response headers, and the
CORS allowlist that replaced allow_origins=["*"].
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.api import create_app
from api.security import register_security
from api.startup_checks import check_config
from config.settings import Settings, settings


def _app(production: bool) -> FastAPI:
    app = FastAPI()
    register_security(app, production=production)

    @app.get("/ping")
    def ping():
        return {"ok": True}

    return app


# --------------------------------------------------------------------------
# HTTPS redirect
# --------------------------------------------------------------------------

def test_production_redirects_plain_http_to_https():
    client = TestClient(_app(production=True), base_url="http://testserver")
    response = client.get("/ping", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "https://testserver/ping"


def test_production_redirect_preserves_method_and_path_query():
    client = TestClient(_app(production=True), base_url="http://testserver")
    response = client.post("/ping?next=%2Fdashboard", follow_redirects=False)
    # 307 (not 301/302) is what keeps a POST a POST instead of silently
    # downgrading it to a GET and dropping the body.
    assert response.status_code == 307
    assert response.headers["location"] == "https://testserver/ping?next=%2Fdashboard"


def test_production_trusts_x_forwarded_proto_from_the_tls_proxy():
    # Render/Vercel terminate TLS, so the socket is plain HTTP even when the
    # client used HTTPS. Without honouring this header every request behind
    # the proxy would redirect to itself forever.
    client = TestClient(_app(production=True), base_url="http://testserver")
    response = client.get("/ping", headers={"x-forwarded-proto": "https"}, follow_redirects=False)
    assert response.status_code == 200


def test_development_does_not_redirect():
    client = TestClient(_app(production=False), base_url="http://testserver")
    assert client.get("/ping", follow_redirects=False).status_code == 200


# --------------------------------------------------------------------------
# Security headers
# --------------------------------------------------------------------------

def test_security_headers_present():
    client = TestClient(_app(production=False), base_url="http://testserver")
    headers = client.get("/ping").headers
    assert headers["X-Content-Type-Options"] == "nosniff"
    assert headers["X-Frame-Options"] == "DENY"
    assert headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert "frame-ancestors 'none'" in headers["Content-Security-Policy"]
    assert "camera=()" in headers["Permissions-Policy"]


def test_hsts_only_in_production():
    dev = TestClient(_app(production=False), base_url="http://testserver")
    assert "Strict-Transport-Security" not in dev.get("/ping").headers

    prod = TestClient(_app(production=True), base_url="https://testserver")
    hsts = prod.get("/ping", headers={"x-forwarded-proto": "https"}).headers["Strict-Transport-Security"]
    assert "max-age=63072000" in hsts
    assert "includeSubDomains" in hsts


def test_hsts_absent_in_dev_so_localhost_is_not_pinned_to_https():
    # Sending HSTS from a local dev server would pin localhost to HTTPS in the
    # developer's browser for the full max-age, breaking every other local
    # http:// project on the same host.
    client = TestClient(_app(production=False), base_url="http://localhost")
    assert "Strict-Transport-Security" not in client.get("/ping").headers


# --------------------------------------------------------------------------
# CORS allowlist
# --------------------------------------------------------------------------

def test_allowed_origin_list_parses_and_strips_trailing_slashes():
    s = Settings(ALLOWED_ORIGINS="https://a.example.com/, https://b.example.com ")
    assert s.allowed_origin_list == ["https://a.example.com", "https://b.example.com"]


def test_unset_origins_fall_back_to_any_localhost_port():
    import re
    s = Settings(ALLOWED_ORIGINS="")
    assert s.allowed_origin_list == []
    for ok in ["http://localhost:5173", "http://localhost:5190", "http://127.0.0.1:5199", "http://localhost"]:
        assert re.match(s.allowed_origin_regex, ok)
    for bad in ["https://evil.example.com", "http://localhost.evil.com", "http://evil.com/?http://localhost:5173"]:
        assert not re.match(s.allowed_origin_regex, bad)


def test_configured_origins_disable_the_localhost_fallback():
    assert Settings(ALLOWED_ORIGINS="https://good.example.com").allowed_origin_regex is None


def test_unlisted_origin_gets_no_cors_approval(monkeypatch):
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", "https://good.example.com")
    client = TestClient(create_app())
    response = client.get("/health", headers={"Origin": "https://evil.example.com"})
    # Starlette omits the header entirely for a disallowed origin, which is
    # what makes the browser refuse to hand the response to the attacker page.
    assert response.headers.get("access-control-allow-origin") != "https://evil.example.com"


def test_listed_origin_is_approved(monkeypatch):
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", "https://good.example.com")
    client = TestClient(create_app())
    response = client.get("/health", headers={"Origin": "https://good.example.com"})
    assert response.headers.get("access-control-allow-origin") == "https://good.example.com"


def test_production_without_allowed_origins_warns(monkeypatch):
    monkeypatch.setattr(settings, "ENV", "production")
    monkeypatch.setattr(settings, "ALLOWED_ORIGINS", "")
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "x" * 64)
    monkeypatch.delenv("RENDER", raising=False)
    warnings = check_config(settings)
    assert any("ALLOWED_ORIGINS" in w for w in warnings)
