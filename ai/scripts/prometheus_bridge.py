#!/usr/bin/env python3
"""NovaPay -> Prometheus -> existing AIOps /v1/detect adapter.

Read-only; it never sends a remediation instruction.
Requires httpx (included in the AIOps starter requirements).
"""
import argparse
import json
import math
import sys
from datetime import datetime, timezone

import httpx

WINDOW = "1m"
# Match the actual backend's instrumented metric names and route labels.
QUERIES = {
    "requests_per_second": 'sum(rate(novapay_http_requests_total{job="payment-api",endpoint="/transactions"}[1m]))',
    "error_requests_per_second": 'sum(rate(novapay_http_requests_total{job="payment-api",endpoint="/transactions",status=~"5.."}[1m])) or vector(0)',
    "latency_p95_ms": 'histogram_quantile(0.95, sum by (le) (rate(novapay_http_request_duration_seconds_bucket{job="payment-api",endpoint="/transactions"}[1m]))) * 1000',
    "cpu_cores_used": 'rate(process_cpu_seconds_total{job="payment-api"}[1m])',
}


class DataNotReady(Exception):
    """Missing/stale/invalid Prometheus metric. Do not fabricate a feature."""


def query_number(client: httpx.Client, prom_url: str, query: str, field: str):
    res = client.get(f"{prom_url.rstrip('/')}/api/v1/query", params={"query": query})
    res.raise_for_status()
    data = res.json()
    if data.get("status") != "success":
        raise DataNotReady(f"{field}: Prometheus n'a pas renvoyé 'success'")
    vals = data.get("data", {}).get("result", [])
    if len(vals) != 1 or not vals[0].get("value"):
        raise DataNotReady(f"{field}: pas de série exploitable (trafic / collecte insuffisants ?)")
    timestamp, val = vals[0]["value"]
    try:
        num = float(val)
        ts = float(timestamp)
    except (TypeError, ValueError) as exc:
        raise DataNotReady(f"{field}: métrique non numérique") from exc
    if not math.isfinite(num) or not math.isfinite(ts):
        raise DataNotReady(f"{field}: NaN/Inf")
    # Instant queries should use fresh data. Normally Prometheus returns a recent sample;
    # reject data older than ~1 min (including a small clock-skew allowance).
    if abs(datetime.now(timezone.utc).timestamp() - ts) > 90:
        raise DataNotReady(f"{field}: mesure périmée ou horloges désynchronisées")
    return num


def collect(client: httpx.Client, prom_url: str, cpu_budget_cores: float):
    if not 0 < cpu_budget_cores <= 256:
        raise ValueError("cpu_budget_cores doit être >0 et documenté")
    values = {
        key: query_number(client, prom_url, promql, key)
        for key, promql in QUERIES.items()
    }
    rps = values["requests_per_second"]
    if rps <= 0:
        raise DataNotReady("Aucune transaction observée dans la fenêtre : ne pas inférer")
    error_rate = values["error_requests_per_second"] / rps
    cpu_percent = (values["cpu_cores_used"] / cpu_budget_cores) * 100.0
    p95 = values["latency_p95_ms"]
    if not (0 <= error_rate <= 1.001 and 0 <= cpu_percent <= 100 and p95 >= 0):
        raise DataNotReady("Features hors plages ; vérifier CPU alloué et statistiques Prometheus")
    return {
        "service": "payment-api",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "window_seconds": 60,
        "requests_per_second": round(rps, 4),
        "error_rate": round(min(1.0, error_rate), 6),
        "latency_p95_ms": round(p95, 3),
        "cpu_usage_percent": round(cpu_percent, 3),
    }


def main():
    ap = argparse.ArgumentParser(description="NovaPay Prometheus -> AIOps (no remediation)")
    ap.add_argument("--prometheus-url", default="http://127.0.0.1:9090")
    ap.add_argument("--detector-url", default="http://127.0.0.1:8008")
    ap.add_argument("--cpu-cores", type=float, required=True, help="Nombre de vCPU de référence pour la métrique CPU ; confirmer avec Infra")
    ap.add_argument("--features-only", action="store_true", help="N'appelle pas l'API IA ; imprime seulement les quatre métriques")
    args = ap.parse_args()
    try:
        with httpx.Client(timeout=5) as client:
            features = collect(client, args.prometheus_url, args.cpu_cores)
            print("FEATURES\n" + json.dumps(features, ensure_ascii=False, indent=2))
            if not args.features_only:
                res = client.post(f"{args.detector_url.rstrip('/')}/v1/detect", json=features)
                res.raise_for_status()
                print("DETECTION\n" + json.dumps(res.json(), ensure_ascii=False, indent=2))
    except (DataNotReady, ValueError, httpx.HTTPError) as exc:
        print(f"PAS DE PRÉDICTION : {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
