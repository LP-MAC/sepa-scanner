"""Tests for FastAPI web endpoints."""
from fastapi.testclient import TestClient
from sepa_scanner.web import app

client = TestClient(app)

class TestHealth:
    def test_health(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

class TestUniverses:
    def test_universes(self):
        resp = client.get("/api/universes")
        assert resp.status_code == 200
        assert "presets" in resp.json()

class TestValidate:
    def test_validate(self):
        resp = client.post("/api/tickers/validate", json=["AAPL", "ZZZINVALID"])
        assert resp.status_code == 200
        data = resp.json()
        assert "ZZZINVALID" in data["invalid"]

class TestScan:
    def test_scan_too_many_tickers(self):
        resp = client.post("/api/scan", json={"tickers": [f"T{i}" for i in range(501)], "rs_threshold": 70})
        assert resp.status_code == 400
