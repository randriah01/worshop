"""
ml-detector — Détection d'anomalies pour NovaPay (pilier IA / Data).

Principe : le détecteur interroge en continu les métriques de payment-api
(/metrics), apprend un comportement de référence (débit de requêtes normal),
et signale une anomalie quand le trafic ou les erreurs s'écartent nettement de
cette référence. La détection n'est PAS une simple règle fixe : elle repose sur
une référence glissante (moyenne + écart-type) et un score d'écart (z-score),
complétée par des seuils métier (taux d'erreur, disponibilité).

Quand une anomalie est détectée, le détecteur crée un incident via l'API
interne (POST /incidents, protégé par un jeton). Il ne répare rien : la
remédiation est un composant séparé.
"""

import os
import time
import math
import statistics
from collections import deque

import requests

PAYMENT_API = os.getenv("PAYMENT_API", "http://payment-api:8080")
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN", "internal-dev-token")
POLL = float(os.getenv("DETECTOR_POLL_SECONDS", "5"))

# Paramètres de la détection statistique.
BASELINE_WINDOW = int(os.getenv("DETECTOR_WINDOW", "20"))   # nb d'échantillons de référence
MIN_SAMPLES = int(os.getenv("DETECTOR_MIN_SAMPLES", "5"))    # avant de pouvoir juger
Z_THRESHOLD = float(os.getenv("DETECTOR_Z", "3.0"))         # écart-types pour un pic
MIN_SPIKE_RATE = float(os.getenv("DETECTOR_MIN_RATE", "15"))  # req/s minimum pour parler de pic
ERR_RATIO = float(os.getenv("DETECTOR_ERR_RATIO", "0.30"))  # part d'erreurs 5xx
COOLDOWN = float(os.getenv("DETECTOR_COOLDOWN", "45"))      # s entre deux incidents


def log(msg):
    print(f"[ml-detector] {msg}", flush=True)


def fetch_metrics():
    """Récupère et additionne les métriques utiles de payment-api."""
    r = requests.get(f"{PAYMENT_API}/metrics", timeout=4)
    r.raise_for_status()
    total = 0.0
    errors = 0.0
    db_up = 1.0
    for line in r.text.splitlines():
        if line.startswith("novapay_http_requests_total{"):
            try:
                value = float(line.rsplit(" ", 1)[1])
            except (ValueError, IndexError):
                continue
            total += value
            # status="5xx" = erreur serveur
            if 'status="5' in line:
                errors += value
        elif line.startswith("novapay_db_up "):
            try:
                db_up = float(line.rsplit(" ", 1)[1])
            except (ValueError, IndexError):
                pass
    return total, errors, db_up


def create_incident(kind, detail):
    try:
        requests.post(
            f"{PAYMENT_API}/incidents",
            json={"kind": kind, "detail": detail},
            headers={"X-Internal-Token": INTERNAL_TOKEN},
            timeout=4,
        )
        log(f"INCIDENT créé → {kind} : {detail}")
    except Exception as e:
        log(f"Échec création incident : {e}")


def main():
    log(f"Démarrage. Cible={PAYMENT_API}, intervalle={POLL}s")
    baseline = deque(maxlen=BASELINE_WINDOW)
    prev_total = prev_errors = None
    active = False          # une anomalie est-elle en cours ?
    last_incident = 0.0     # horodatage du dernier incident

    while True:
        time.sleep(POLL)
        now = time.time()

        # 1) Récupérer les métriques (échec = API injoignable).
        try:
            total, errors, db_up = fetch_metrics()
        except Exception:
            if now - last_incident > COOLDOWN:
                create_incident("Indisponibilité de l'API", "L'API de paiement ne répond plus (timeout).")
                last_incident = now
                active = True
            continue

        if prev_total is None:
            prev_total, prev_errors = total, errors
            continue

        # 2) Calculer débit et taux d'erreur sur l'intervalle.
        d_req = max(total - prev_total, 0.0)
        d_err = max(errors - prev_errors, 0.0)
        prev_total, prev_errors = total, errors
        rate = d_req / POLL
        err_ratio = (d_err / d_req) if d_req > 0 else 0.0

        # 3) Décider s'il y a anomalie.
        reason = None
        if db_up < 1.0:
            reason = ("Base de données indisponible", "La base ne répond plus (novapay_db_up=0).")
        elif d_req >= 5 and err_ratio >= ERR_RATIO:
            reason = ("Hausse des erreurs (5xx)", f"Taux d'erreur {err_ratio*100:.0f}% sur {int(d_req)} requêtes.")
        elif len(baseline) >= MIN_SAMPLES and rate >= MIN_SPIKE_RATE:
            mean = statistics.fmean(baseline)
            std = statistics.pstdev(baseline) or 1.0
            z = (rate - mean) / std
            if z >= Z_THRESHOLD:
                reason = (
                    "Pic de trafic — déni de service",
                    f"Débit {rate:.0f} req/s (référence {mean:.0f}, écart {z:.1f}σ).",
                )

        # 4) Mettre à jour la référence UNIQUEMENT en période normale,
        #    pour que l'attaque ne "pollue" pas le comportement de référence.
        if reason is None:
            baseline.append(rate)

        # 5) Créer un incident à l'apparition de l'anomalie (avec anti-spam).
        if reason:
            if not active or (now - last_incident > COOLDOWN):
                create_incident(*reason)
                last_incident = now
            active = True
        else:
            if active:
                log("Retour à la normale.")
            active = False

        log(f"rate={rate:.1f} req/s err={err_ratio*100:.0f}% db_up={db_up:.0f} "
            f"baseline={len(baseline)} {'ANOMALIE' if reason else 'ok'}")


if __name__ == "__main__":
    main()
