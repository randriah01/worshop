import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from monitor_persist import publish_alert


def test_publisher_uses_protected_api_and_stable_key():
    def handler(req):
        assert req.url.path == "/api/internal/ml-alerts"
        assert req.headers["X-Internal-Token"] == "secret-for-test"
        body = __import__("json").loads(req.content)
        assert body["source_event_id"] == "RUN-123:INC-ABC"
        assert body["evidence"]["requests_per_second"] == 20
        return httpx.Response(200, json={"id": 42, "observation_count": 1})
    alert = {
        "run_id": "RUN-123", "incident_id": "INC-ABC", "service": "payment-api",
        "observed_at": "2026-10-21T15:00:00Z",
        "model_version": "iforest-novapay-normal-v0", "anomaly_score": -0.1,
        "evidence": {"requests_per_second": 20}, "recommendation": "CORRELATE",
    }
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert publish_alert(client, "http://localhost", "secret-for-test", alert)["id"] == 42
