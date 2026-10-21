#!/usr/bin/env python3
"""Surveille les métriques réelles et publie uniquement les alertes ML.

Le stockage CSV / JSONL précède toujours la publication réseau. Aucune
commande de remédiation n'est exécutée. Pour la VM2, préciser l'URL VM1.
"""
import argparse
import os
import sys
import time
from uuid import uuid4

import httpx

from monitor_ai import append_csv, append_jsonl, monitor_once


def publish_alert(client, backend_url, internal_token, alert):
    payload = {
        "source_event_id": f"{alert['run_id']}:{alert['incident_id']}",
        "data_origin": alert.get("data_origin", "prometheus"),
        "service": alert["service"],
        "observed_at": alert["observed_at"],
        "model_version": alert["model_version"],
        "anomaly_score": alert["anomaly_score"],
        "evidence": alert["evidence"],
        "recommendation": alert["recommendation"],
    }
    res = client.post(
        f"{backend_url.rstrip('/')}/api/internal/ml-alerts",
        headers={"X-Internal-Token": internal_token}, json=payload,
    )
    res.raise_for_status()
    return res.json()


def main(argv=None, client_factory=httpx.Client, sleep=time.sleep, clock=time.monotonic):
    parser = argparse.ArgumentParser(description="NovaPay AI -> PostgreSQL via API interne")
    parser.add_argument("--prometheus-url", default="http://127.0.0.1:9090")
    parser.add_argument("--detector-url", default="http://127.0.0.1:8008")
    parser.add_argument("--backend-url", default="http://127.0.0.1")
    parser.add_argument("--cpu-cores", type=float, required=True)
    parser.add_argument("--interval", type=float, default=10)
    parser.add_argument("--count", type=int, default=0)
    parser.add_argument("--phase", choices=("unlabeled", "normal", "attack", "recovery"), default="unlabeled")
    parser.add_argument("--output", default="data/monitor_evidence.csv")
    parser.add_argument("--alerts-output", default="data/ml_alerts.jsonl")
    parser.add_argument("--token-env", default="NOVAPAY_INTERNAL_TOKEN")
    args = parser.parse_args(argv)
    if args.interval < 5 or args.count < 0 or not (0 < args.cpu_cores <= 256):
        parser.error("interval >= 5, count >= 0, et 0 < cpu-cores <= 256 requis")
    internal_token = os.environ.get(args.token_env, "")
    if not internal_token:
        parser.error(f"Variable d'environnement {args.token_env} manquante ; pas de publication")
    run_id = f"RUN-{uuid4().hex[:12].upper()}"
    print(f"Surveillance et archivage ML démarrés ({run_id}), aucune remédiation", flush=True)
    try:
        with client_factory(timeout=5) as client:
            cycles = 0
            while not args.count or cycles < args.count:
                start = clock()
                rec, alert = monitor_once(client, args.prometheus_url, args.detector_url,
                                          args.cpu_cores, run_id, args.phase)
                append_csv(args.output, rec)
                message = rec["status"]
                if alert:
                    append_jsonl(args.alerts_output, alert)
                    try:
                        saved = publish_alert(client, args.backend_url, internal_token, alert)
                        message += f" | PostgreSQL INC-{saved['id']} ({saved['observation_count']} observations)"
                    except (httpx.HTTPError, ValueError, KeyError) as exc:
                        message += f" | PERSIST_FAILED: {type(exc).__name__} (alerte conservée en JSONL)"
                if rec.get("anomaly_score") is not None:
                    message += f" | score={rec['anomaly_score']}"
                if rec.get("message"):
                    message += f" | {rec['message']}"
                print(f"[{rec['collected_at']}] {message}", flush=True)
                cycles += 1
                if not args.count or cycles < args.count:
                    sleep(max(0, args.interval - (clock() - start)))
    except KeyboardInterrupt:
        print("Moniteur arrêté, journaux conservés.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
