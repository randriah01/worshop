#!/usr/bin/env python3
"""Collecte des features NovaPay via le bridge IA-02, sans déclencher de remédiation.

Placer CE script dans le répertoire scripts/ du projet AIOps existant.
Depuis la racine du projet :
    python scripts/collect_baseline.py --cpu-cores 1 --count 3 --interval 10

Collecter uniquement pendant un trafic considéré normal et autorisé.
"""
from __future__ import annotations

import argparse
import csv
import sys
import time
from pathlib import Path
from datetime import datetime, timezone

import httpx
from prometheus_bridge import collect, DataNotReady

FEATURES = ("requests_per_second", "error_rate", "latency_p95_ms", "cpu_usage_percent")
COLUMNS = ("observed_at", "window_seconds", *FEATURES)


def save_row(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    has_content = path.exists() and path.stat().st_size > 0
    with path.open("a", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=COLUMNS)
        if not has_content:
            writer.writeheader()
        writer.writerow({key: row[key] for key in COLUMNS})


def main() -> int:
    parser = argparse.ArgumentParser(description="Collecte read-only des observations de trafic normal NovaPay")
    parser.add_argument("--prometheus-url", default="http://127.0.0.1:9090")
    parser.add_argument("--cpu-cores", type=float, required=True,
                        help="Référence CPU utilisée par le modèle : valider avec l'infra (1 pour test uniquement)")
    parser.add_argument("--count", type=int, default=120, help="Nombre de fenêtres valides à enregistrer")
    parser.add_argument("--interval", type=float, default=10, help="Temps en secondes entre deux relevés")
    parser.add_argument("--max-attempts", type=int, default=250, help="Arrêt après trop de mesures inexploitables")
    parser.add_argument("--output", type=Path, default=Path("data/novapay_normal_raw.csv"))
    args = parser.parse_args()
    if args.count < 1 or args.interval < 0 or args.max_attempts < args.count:
        parser.error("count >= 1, interval >= 0 et max-attempts >= count requis")

    saved = 0
    attempts = 0
    print("Collecte NORMAL uniquement : ne pas déclencher d'attaque ou de remédiation pendant cette capture.", flush=True)
    print("Échantillons successifs potentiellement corrélés : ne pas confondre nombre de lignes et fenêtres indépendantes.", flush=True)
    try:
        with httpx.Client(timeout=5) as client:
            while saved < args.count and attempts < args.max_attempts:
                attempts += 1
                try:
                    observation = collect(client, args.prometheus_url, args.cpu_cores)
                    save_row(args.output, observation)
                    saved += 1
                    print(f"[{saved}/{args.count}] {observation['observed_at']} "
                          f"rps={observation['requests_per_second']}, "
                          f"5xx={observation['error_rate']}, "
                          f"p95_ms={observation['latency_p95_ms']}, "
                          f"cpu_pct={observation['cpu_usage_percent']}", flush=True)
                except (DataNotReady, httpx.HTTPError, ValueError, KeyError, OSError) as exc:
                    print(f"[ignoré {attempts}] {exc}", file=sys.stderr, flush=True)
                if saved < args.count and attempts < args.max_attempts:
                    time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nArrêt demandé, observations déjà écrites préservées.", flush=True)
    print(f"{saved} observation(s) enregistrée(s) dans {args.output}.", flush=True)
    return 0 if saved == args.count else 1

if __name__ == "__main__":
    sys.exit(main())
