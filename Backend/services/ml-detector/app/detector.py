"""NovaPay ML V3 — Isolation Forest en MODE SHADOW EXCLUSIF.

Le détecteur ne possède volontairement aucun appel POST, aucune décision SOAR,
aucune interface d'exécution. Il publie des scores JSON dans stdout.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from ml_core import feature_window, load_model, parse_prometheus, score_model

PAYMENT_API = os.getenv("PAYMENT_API", "http://payment-api:8080").rstrip("/")
POLL = max(1.0, float(os.getenv("DETECTOR_POLL_SECONDS", "5")))
MODEL_PATH = os.getenv("ML_MODEL_PATH", "/tmp/novapay_iforest.joblib")
MODEL_RELOAD_SECONDS = max(5.0, float(os.getenv("ML_RELOAD_SECONDS", "15")))
VERSION = "NOVAPAY_ML_IFOREST_SHADOW_V3"


def log(event: str, **fields) -> None:
    print(json.dumps({
        "component": "ml-detector",
        "version": VERSION,
        "mode": "SHADOW_ONLY",
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **fields,
    }, ensure_ascii=False, sort_keys=True), flush=True)


def metrics() -> tuple[float, float, float]:
    r = requests.get(f"{PAYMENT_API}/metrics", timeout=4)
    r.raise_for_status()
    return parse_prometheus(r.text)


def main() -> None:
    log("startup", model_path=MODEL_PATH, incident_writes=False, remediation_actions=False)
    previous = None
    previous_at = None
    loaded = None
    loaded_mtime = None
    last_reload = 0.0
    last_warning = 0.0
    consecutive = 0
    while True:
        time.sleep(POLL)
        now = time.monotonic()
        if now - last_reload >= MODEL_RELOAD_SECONDS:
            last_reload = now
            try:
                mtime = Path(MODEL_PATH).stat().st_mtime_ns
                if loaded is None or loaded_mtime != mtime:
                    loaded = load_model(MODEL_PATH)
                    loaded_mtime = mtime
                    consecutive = 0
                    log("model_loaded", model_version=loaded["version"], features=list(loaded["features"]), baseline_sha256=loaded.get("baseline_sha256"))
            except FileNotFoundError:
                if now - last_warning > 60:
                    log("awaiting_approved_baseline_model", message="Aucun score jusqu'à l'entraînement d'une baseline saine")
                    last_warning = now
            except Exception as exc:
                loaded = None
                log("model_load_error", error=str(exc)[:180])
        try:
            current = metrics()
        except Exception as exc:
            previous = previous_at = None
            consecutive = 0
            log("metrics_unavailable", error=str(exc)[:180], incident_writes=False)
            continue
        if previous is None:
            previous, previous_at = current, now
            continue
        try:
            features = feature_window(previous, current, now - previous_at)
        except ValueError as exc:
            log("invalid_window", error=str(exc))
            previous, previous_at = current, now
            continue
        previous, previous_at = current, now
        if loaded is None:
            # Ne pas remplir une baseline implicitement : elle doit être capturée
            # puis validée manuellement dans un environnement autorisé.
            if now - last_warning > 60:
                log("waiting_for_model", features=features)
                last_warning = now
            continue
        try:
            result = score_model(loaded, features)
        except Exception as exc:
            log("score_error", error=str(exc)[:180])
            continue
        consecutive = consecutive + 1 if result["anomaly"] else 0
        log("ml_score", features=features, **result, consecutive_anomalies=consecutive,
            suggest_review=consecutive >= 3, incident_writes=False, remediation_actions=False)


if __name__ == "__main__":
    main()
