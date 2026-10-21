import importlib.util
import json
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
# Bridge for functional tests shipped in the main ai/ bundle.
try:
    import prometheus_bridge  # noqa
except ModuleNotFoundError:
    raise RuntimeError("Lancer ces tests depuis ai/ après avoir copié le script dans le projet principal")

spec = importlib.util.spec_from_file_location("monitor_ai", SCRIPTS / "monitor_ai.py")
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)


def mock_client(bridge, *, rps=0.5, latency="8.5", anomaly=False):
    def handler(req):
        if req.url.path.endswith("/api/v1/query"):
            q = req.url.params["query"]
            key = next(k for k, v in bridge.QUERIES.items() if v == q)
            values = dict(requests_per_second=rps, error_requests_per_second=0,
                          latency_p95_ms=latency, cpu_cores_used=0.005)
            from datetime import datetime, timezone
            return httpx.Response(200, json={"status": "success", "data": {"result": [
                {"metric": {}, "value": [datetime.now(timezone.utc).timestamp(), str(values[key])]}
            ]}})
        return httpx.Response(200, json={
            "incident_id": "INC-TEST", "anomaly_detected": anomaly,
            "anomaly_score": -0.12 if anomaly else 0.12, "model_version": "iforest-novapay-normal-v0",
            "recommendation": "CORRELATE_WITH_WAF_AND_BUSINESS_CHECKS" if anomaly else "NO_ACTION",
        })
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_normal(monkeypatch):
    import prometheus_bridge as bridge
    with mock_client(bridge) as client:
        rec, alert = monitor.monitor_once(client, "http://localhost:9090", "http://localhost:8008", 1, "run", "normal")
    assert rec["status"] == "NORMAL"
    assert rec["anomaly_detected"] is False
    assert alert is None


def test_anomaly_does_not_remediate():
    import prometheus_bridge as bridge
    with mock_client(bridge, anomaly=True) as client:
        rec, alert = monitor.monitor_once(client, "http://localhost:9090", "http://localhost:8008", 1, "run", "attack")
    assert rec["status"] == "ANOMALY"
    assert alert["alert_type"] == "ML_ANOMALY_INDICATIVE"
    assert "action" not in alert


def test_nan_is_no_data_not_attack():
    import prometheus_bridge as bridge
    with mock_client(bridge, latency="NaN") as client:
        rec, alert = monitor.monitor_once(client, "http://localhost:9090", "http://localhost:8008", 1, "run", "unlabeled")
    assert rec["status"] == "DATA_UNAVAILABLE"
    assert alert is None


def test_csv_and_alert_write(tmp_path):
    file = tmp_path / "monitor.csv"
    alert = tmp_path / "alerts.jsonl"
    monitor.append_csv(file, {"collected_at": "now", "status": "NORMAL"})
    monitor.append_csv(file, {"collected_at": "later", "status": "DATA_UNAVAILABLE"})
    assert file.read_text().count("collected_at") == 1
    assert file.read_text().count("\n") == 3
    monitor.append_jsonl(alert, {"incident_id": "INC-TEST", "score": -0.12})
    assert json.loads(alert.read_text())["incident_id"] == "INC-TEST"
