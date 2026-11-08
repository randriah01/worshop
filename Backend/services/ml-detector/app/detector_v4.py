"""NovaPay Isolation Forest V4 - lecture seule, sans action SOAR."""

import argparse
import json
import os
import time
from datetime import datetime, timezone

import joblib
import requests

from ml_features_v4 import FEATURES, parse_metrics, window

PAYMENT_API = os.getenv(
    "PAYMENT_API", "http://payment-api:8080"
).rstrip("/")

MODEL_PATH = os.getenv(
    "ML_V4_MODEL_PATH",
    "/tmp/novapay_iforest_v4_candidate.joblib"
)


def log(event, **details):
    print(json.dumps({
        "component": "ml-detector",
        "version": "NOVAPAY_ML_IFOREST_SHADOW_V4",
        "mode": "SHADOW_ONLY",
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "incident_writes": False,
        "remediation_actions": False,
        **details
    }, ensure_ascii=False), flush=True)


def get_snapshot():
    response = requests.get(
        f"{PAYMENT_API}/metrics", timeout=4
    )
    response.raise_for_status()
    return parse_metrics(response.text)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=12)
    parser.add_argument("--interval", type=float, default=5)
    args = parser.parse_args()

    if args.samples < 0 or args.interval < 1:
        parser.error("samples et interval doivent etre >= 1")

    # Ne charger que le modele genere localement et sauvegarde.
    package = joblib.load(MODEL_PATH)

    if tuple(package.get("features", ())) != FEATURES:
        raise ValueError("Variables du modele V4 incompatibles")

    if package.get("candidate_only") is not True:
        raise ValueError("Le modele n'est pas un candidat V4")

    model = package["model"]
    version = package["version"]

    log(
        "startup",
        model_version=version,
        model_path=MODEL_PATH,
        features=list(FEATURES),
        target_samples=args.samples
    )

    previous = None
    previous_at = None
    consecutive = 0
    scored = 0
    anomalies = 0
    attempts = 0
    max_attempts = args.samples * 3 + 10

    while (args.samples == 0 or scored < args.samples) and (args.samples == 0 or attempts < max_attempts):
        attempts += 1
        time.sleep(args.interval)
        now = time.monotonic()

        try:
            current = get_snapshot()

            if previous is None:
                previous = current
                previous_at = now
                continue

            features = window(
                previous, current, now - previous_at
            )

            previous = current
            previous_at = now

            vector = [[float(features[k]) for k in FEATURES]]

            prediction = int(model.predict(vector)[0])
            decision = float(model.decision_function(vector)[0])

            anomaly = prediction == -1
            consecutive = consecutive + 1 if anomaly else 0
            anomalies += int(anomaly)
            scored += 1

            log(
                "ml_score",
                model_version=version,
                features=features,
                decision_score=round(decision, 6),
                anomaly=anomaly,
                consecutive_anomalies=consecutive,
                suggest_review=consecutive >= 3
            )

        except Exception as exc:
            previous = None
            previous_at = None
            consecutive = 0
            log("observation_error", error=str(exc)[:200])

    log(
        "evaluation_finished",
        scored_windows=scored,
        anomaly_windows=anomalies,
        observed_anomaly_pct=round(100 * anomalies / scored, 2)
        if scored else None,
        completed=scored == args.samples
    )

    if args.samples > 0 and scored != args.samples:
        raise RuntimeError("Nombre de fenetres insuffisant")


if __name__ == "__main__":
    main()
