#!/usr/bin/env python3
"""Surveille NovaPay via Prometheus, interroge l'API Isolation Forest et journalise.

Usage depuis la racine ai/ (avec le venv activé) :
  python scripts/monitor_ai.py --cpu-cores 1 --count 6
  python scripts/monitor_ai.py --cpu-cores 1 --interval 10

Ce processus est en lecture seule : pas d'accès SSH/Docker, pas d'Ansible,
pas de remédiation. Le journal JSONL n'est pas une commande de reprise.
"""
import argparse
import csv
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import httpx
from prometheus_bridge import DataNotReady, collect

FIELDS = [
    "collected_at", "run_id", "phase", "status", "service", "observed_at",
    "window_seconds", "requests_per_second", "error_rate", "latency_p95_ms",
    "cpu_usage_percent", "incident_id", "anomaly_detected", "anomaly_score",
    "model_version", "recommendation", "message",
]


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def append_csv(path, record):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS, extrasaction="ignore")
        if stream.tell() == 0:
            writer.writeheader()
        writer.writerow({key: record.get(key, "") for key in FIELDS})


def append_jsonl(path, record):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(record, ensure_ascii=False, allow_nan=False) + "\n")


def monitor_once(client, prom_url, detector_url, cpu_cores, run_id, phase):
    result = {
        "collected_at": utc_now(),
        "run_id": run_id,
        "phase": phase,
        "service": "payment-api",
    }
    try:
        features = collect(client, prom_url, cpu_cores)
        result.update(features)
    except (DataNotReady, ValueError) as exc:
        result.update(status="DATA_UNAVAILABLE", message=str(exc))
        return result, None
    except httpx.HTTPError as exc:
        result.update(status="PROMETHEUS_ERROR", message=str(exc))
        return result, None

    try:
        reply = client.post(f"{detector_url.rstrip('/')}/v1/detect", json=features)
        reply.raise_for_status()
        detection = reply.json()
        if not isinstance(detection, dict) or not all(
            k in detection for k in ("anomaly_detected", "anomaly_score", "model_version", "incident_id")
        ):
            raise ValueError("Réponse IA incomplète")
        if type(detection["anomaly_detected"]) is not bool:
            raise ValueError("anomaly_detected doit être un booléen")
        result.update({
            "status": "ANOMALY" if detection["anomaly_detected"] else "NORMAL",
            "incident_id": detection["incident_id"],
            "anomaly_detected": detection["anomaly_detected"],
            "anomaly_score": detection["anomaly_score"],
            "model_version": detection["model_version"],
            "recommendation": detection.get("recommendation", ""),
        })
        # Alerte indicative uniquement. La corrélation SOC et l'action sont distinctes.
        alert = {
            "recorded_at": result["collected_at"],
            "run_id": run_id,
            "phase": phase,
            "incident_id": detection["incident_id"],
            "service": features["service"],
            "model_version": detection["model_version"],
            "anomaly_score": detection["anomaly_score"],
            "observed_at": features["observed_at"],
            "evidence": {k: features[k] for k in (
                "requests_per_second", "error_rate", "latency_p95_ms", "cpu_usage_percent")},
            "recommendation": detection.get("recommendation", "CORRELATE_WITH_WAF_AND_BUSINESS_CHECKS"),
            "alert_type": "ML_ANOMALY_INDICATIVE",
        } if detection["anomaly_detected"] else None
        return result, alert
    except (httpx.HTTPError, ValueError, json.JSONDecodeError) as exc:
        result.update(status="DETECTOR_ERROR", message=str(exc))
        return result, None


def main(argv=None, *, client_factory=httpx.Client, sleep=time.sleep, clock=time.monotonic):
    parser = argparse.ArgumentParser(description="Surveillance IA NovaPay en lecture seule")
    parser.add_argument("--prometheus-url", default="http://127.0.0.1:9090")
    parser.add_argument("--detector-url", default="http://127.0.0.1:8008")
    parser.add_argument("--cpu-cores", type=float, required=True)
    parser.add_argument("--interval", type=float, default=10, help="Secondes entre observations (>= 5)")
    parser.add_argument("--count", type=int, default=0, help="0 = continu, sinon nombre de cycles")
    parser.add_argument("--phase", choices=("unlabeled", "normal", "attack", "recovery"), default="unlabeled")
    parser.add_argument("--output", default="data/monitor_evidence.csv")
    parser.add_argument("--alerts-output", default="data/ml_alerts.jsonl")
    args = parser.parse_args(argv)
    if args.interval < 5 or args.count < 0 or not 0 < args.cpu_cores <= 256:
        parser.error("interval >= 5, count >= 0, et 0 < cpu-cores <= 256 requis")
    run_id = f"RUN-{uuid4().hex[:12].upper()}"
    print(f"Surveillance démarrée {run_id} | Ctrl+C pour arrêter | aucune remédiation", flush=True)
    try:
        with client_factory(timeout=5) as client:
            counter = 0
            while args.count == 0 or counter < args.count:
                start = clock()
                record, alert = monitor_once(
                    client, args.prometheus_url, args.detector_url,
                    args.cpu_cores, run_id, args.phase,
                )
                append_csv(args.output, record)
                if alert is not None:
                    append_jsonl(args.alerts_output, alert)
                summary = f"[{record['collected_at']}] {record['status']}"
                if record.get("anomaly_score") is not None:
                    summary += f" | score={record['anomaly_score']} rps={record.get('requests_per_second')}"
                if record.get("message"):
                    summary += f" | {record['message']}"
                print(summary, flush=True)
                counter += 1
                if args.count == 0 or counter < args.count:
                    sleep(max(0, args.interval - (clock() - start)))
    except KeyboardInterrupt:
        print("Surveillance arrêtée. Journaux enregistrés.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
