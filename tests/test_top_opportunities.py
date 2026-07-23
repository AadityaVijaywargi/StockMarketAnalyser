import pytest
from fastapi.testclient import TestClient
from api.api import create_app

app = create_app()
client = TestClient(app)

def test_get_top_opportunities_endpoint_success():
    """Verify that GET /market/top-opportunities returns a valid response with sorted opportunities."""
    response = client.get("/market/top-opportunities?limit=5")
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    
    data = response.json()
    assert "updated_at" in data
    assert "total_scanned" in data
    assert "opportunities" in data
    
    opps = data["opportunities"]
    assert isinstance(opps, list)
    assert len(opps) <= 5
    
    if len(opps) > 1:
        # Check descending order by overall score
        scores = [o["overall_score"] for o in opps]
        assert scores == sorted(scores, reverse=True), f"Expected sorted scores, got: {scores}"

def test_get_top_opportunities_caching():
    """Verify that calling the endpoint twice hits the cache."""
    res1 = client.get("/market/top-opportunities?limit=3")
    assert res1.status_code == 200
    
    res2 = client.get("/market/top-opportunities?limit=3")
    assert res2.status_code == 200
    
    assert res1.json()["updated_at"] == res2.json()["updated_at"]
