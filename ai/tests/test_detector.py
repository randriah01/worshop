import json
from pathlib import Path
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from anomaly_detector.model import FEATURES, detect, train
import anomaly_detector.api as api

ROOT = Path(__file__).resolve().parents[1]

@pytest.fixture()
def model_file(tmp_path, monkeypatch):
    from subprocess import run
    from sys import executable
    run([executable, str(ROOT / "scripts/generate_demo_data.py")], check=True)
    output = tmp_path / "model.joblib"
    train(pd.read_csv(ROOT / "data/normal_train.csv"), output)
    monkeypatch.setattr(api, "DEFAULT_MODEL_FILE", output)
    api.model_artifact.cache_clear()
    yield output
    api.model_artifact.cache_clear()


def test_normal_and_incident(model_file):
    client = TestClient(api.app)
    assert client.get("/ready").status_code == 200
    normal = json.loads((ROOT / "examples/normal.json").read_text())
    incident = json.loads((ROOT / "examples/incident.json").read_text())
    resp_normal = client.post("/v1/detect", json=normal)
    resp_bad = client.post("/v1/detect", json=incident)
    assert resp_normal.status_code == 200, resp_normal.text
    assert resp_bad.status_code == 200, resp_bad.text
    assert resp_normal.json()["anomaly_detected"] is False
    assert resp_bad.json()["anomaly_detected"] is True
    assert resp_bad.json()["recommendation"] == "CORRELATE_WITH_WAF_AND_BUSINESS_CHECKS"


def test_invalid_metrics_are_rejected(model_file):
    client = TestClient(api.app)
    payload = json.loads((ROOT / "examples/normal.json").read_text())
    payload["error_rate"] = 3.5
    assert client.post("/v1/detect", json=payload).status_code == 422


def test_service_does_not_execute_actions(model_file):
    client = TestClient(api.app)
    res = client.post("/v1/detect", json=json.loads((ROOT / "examples/incident.json").read_text()))
    assert "playbook" not in res.json()
    assert "recommendation" in res.json()
