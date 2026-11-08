"""Fonctions de lecture Prometheus et modèle Isolation Forest de NovaPay.

Aucune fonction de ce module n'écrit dans Payment API ni dans le WAF.
"""
from __future__ import annotations

import hashlib
import math
import re
from pathlib import Path

FEATURES = ("rate", "err_ratio", "db_up")
COUNTER = re.compile(r'^novapay_http_requests_total\{([^}]*)\}\s+([\d.eE+\-]+)(?:\s|$)')
STATUS = re.compile(r'(?:^|,)\s*status="([^"]+)"')
DATABASE = re.compile(r'^novapay_db_up\s+([\d.eE+\-]+)(?:\s|$)')


def parse_prometheus(body: str) -> tuple[float, float, float]:
    total = errors = 0.0
    found_counter = found_database = False
    db_up = None
    for line in body.splitlines():
        m = COUNTER.match(line)
        if m:
            found_counter = True
            value = float(m.group(2))
            if not math.isfinite(value) or value < 0:
                raise ValueError("Compteur HTTP non fini ou négatif")
            total += value
            status = STATUS.search(m.group(1))
            if status and status.group(1).startswith('5'):
                errors += value
            continue
        m = DATABASE.match(line)
        if m:
            found_database = True
            db_up = float(m.group(1))
    if not found_counter or not found_database or db_up is None:
        raise ValueError("Métrique HTTP ou novapay_db_up absente : score suspendu")
    if not math.isfinite(db_up):
        raise ValueError("Métrique novapay_db_up invalide")
    return total, errors, db_up


def feature_window(previous: tuple[float, float, float], current: tuple[float, float, float], seconds: float) -> dict:
    if seconds <= 0:
        raise ValueError("Intervalle de collecte invalide")
    d_req = current[0] - previous[0]
    d_err = current[1] - previous[1]
    if d_req < 0 or d_err < 0:
        raise ValueError("Compteur Prometheus réinitialisé : échantillon ignoré")
    return {
        "rate": round(d_req / seconds, 6),
        "err_ratio": round(min(1.0, d_err / d_req), 6) if d_req else 0.0,
        "db_up": float(current[2]),
    }


def load_model(path: str):
    # Un fichier joblib est un pickle. Charger UNIQUEMENT nos propres modèles
    # locaux produits avec train_model.py, jamais un modèle téléchargé ou reçu.
    from joblib import load
    payload = load(path)
    if not isinstance(payload, dict) or tuple(payload.get("features", ())) != FEATURES:
        raise ValueError("Modèle incompatible : features incorrectes")
    if "model" not in payload or "version" not in payload:
        raise ValueError("Modèle incomplet")
    return payload


def score_model(payload: dict, features: dict) -> dict:
    x = [[float(features[name]) for name in FEATURES]]
    score = float(payload["model"].decision_function(x)[0])
    prediction = int(payload["model"].predict(x)[0])
    return {"score": round(score, 8), "anomaly": prediction == -1, "model_version": payload["version"]}
