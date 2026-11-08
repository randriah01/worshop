"""Collecte des métriques pour construire une baseline NORMALE, approuvée manuellement.

Exécuter uniquement dans le laboratoire, sans charge offensive en parallèle.
Ne génère aucun paiement et n'écrit dans aucune API.
"""
import argparse
import csv
import json
import os
import time
from pathlib import Path

import requests
from ml_core import feature_window, parse_prometheus


def capture(api: str, samples: int, interval: float, output: str) -> None:
    if samples < 60:
        raise ValueError("60 fenêtres minimum requises")
    if interval < 1:
        raise ValueError("Intervalle minimum : 1 seconde")
    def snapshot():
        resp = requests.get(api.rstrip('/') + '/metrics', timeout=4)
        resp.raise_for_status()
        return parse_prometheus(resp.text)
    rows = []
    prev = snapshot()
    prev_time = time.monotonic()
    for i in range(samples):
        time.sleep(interval)
        new = snapshot()
        t = time.monotonic()
        try:
            row = feature_window(prev, new, t - prev_time)
            rows.append(row)
        except ValueError as exc:
            print(json.dumps({"event": "window_skipped", "reason": str(exc)}, ensure_ascii=False), flush=True)
        prev, prev_time = new, t
        if (i + 1) % 10 == 0:
            print(json.dumps({"event": "capture_progress", "windows": i + 1, "accepted": len(rows)}), flush=True)
    target = Path(output)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['rate', 'err_ratio', 'db_up'])
        writer.writeheader()
        writer.writerows(rows)
    print(json.dumps({"event": "capture_complete", "accepted": len(rows), "output": str(target)}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--api', default=os.getenv('PAYMENT_API', 'http://payment-api:8080'))
    parser.add_argument('--samples', type=int, default=90)
    parser.add_argument('--interval', type=float, default=5)
    parser.add_argument('--out', default='/tmp/novapay_clean_baseline.csv')
    args = parser.parse_args()
    capture(args.api, args.samples, args.interval, args.out)
