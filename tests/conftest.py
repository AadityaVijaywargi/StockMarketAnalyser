"""
Shared pytest setup. Every test file in this suite instantiates its own
`TestClient(app)` at module import time, before any fixture can run — so
authentication has to be injected here, at conftest import time, rather
than through a fixture. This patches TestClient to always carry a valid
admin bearer token, so existing tests keep exercising the endpoints
directly without needing to know about login.
"""
from starlette.testclient import TestClient
from api.auth import create_access_token

_TEST_TOKEN = create_access_token("admin", role="admin")
_original_init = TestClient.__init__


def _patched_init(self, *args, **kwargs):
    _original_init(self, *args, **kwargs)
    self.headers["Authorization"] = f"Bearer {_TEST_TOKEN}"


TestClient.__init__ = _patched_init
