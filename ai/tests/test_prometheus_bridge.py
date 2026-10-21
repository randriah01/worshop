import importlib.util
from pathlib import Path
from datetime import datetime, timezone

import httpx
import pytest

src = Path(__file__).resolve().parents[1] / "scripts" / "prometheus_bridge.py"
spec = importlib.util.spec_from_file_location("prometheus_bridge", src)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


def transport_for(values):
    def handler(req):
        promql = req.url.params["query"]
        key = next((k for k, v in bridge.QUERIES.items() if v == promql), "unknown")
        if key not in values:
            result = []
        else:
            result = [{"metric": {}, "value": [datetime.now(timezone.utc).timestamp(), str(values[key])]}]
        return httpx.Response(200, json={"status": "success", "data": {"resultType": "vector", "result": result}})
    return httpx.MockTransport(handler)


def test_collect_normal():
    with httpx.Client(transport=transport_for({
        "requests_per_second": 22,
        "error_requests_per_second": 0.22,
        "latency_p95_ms": 170,
        "cpu_cores_used": 0.35,
    })) as client:
        f = bridge.collect(client, "http://prometheus:9090", cpu_budget_cores=1)
    assert f["requests_per_second"] == 22
    assert f["error_rate"] == 0.01
    assert f["latency_p95_ms"] == 170
    assert f["cpu_usage_percent"] == 35


def test_refuses_missing_cpu():
    with httpx.Client(transport=transport_for({
        "requests_per_second": 22,
        "error_requests_per_second": 0,
        "latency_p95_ms": 170,
    })) as client:
        with pytest.raises(bridge.DataNotReady, match="cpu_cores_used"):
            bridge.collect(client, "http://prometheus:9090", cpu_budget_cores=1)


def test_refuses_zero_activity():
    with httpx.Client(transport=transport_for({
        "requests_per_second": 0,
        "error_requests_per_second": 0,
        "latency_p95_ms": 0,
        "cpu_cores_used": 0.1,
    })) as client:
        with pytest.raises(bridge.DataNotReady, match="Aucune transaction"):
            bridge.collect(client, "http://prometheus:9090", cpu_budget_cores=1)


def test_correct_metric_names():
    assert all("novapay_" in q for k,q in bridge.QUERIES.items() if k != "cpu_cores_used")
    assert 'endpoint="/transactions"' in bridge.QUERIES["requests_per_second"]
