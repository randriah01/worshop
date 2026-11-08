"""NovaPay SOAR - phase 1: OBSERVATION UNIQUEMENT.

Ce service n'exécute AUCUNE remédiation, ne publie AUCUN changement d'état
sur les incidents et n'utilise PAS le socket Docker. Il ne permet pas non plus
qu'une variable d'environnement réactive par accident les actions anciennes.

Les incidents sont des SIGNAUX, pas des preuves d'attaque ni de reprise métier.
La vraie remédiation sera un composant séparé, après recettes et approbation.
"""

import json
import os
import time
from datetime import datetime, timezone

import requests

VERSION = "NOVAPAY_SOAR_OBSERVE_ONLY_V1"
PAYMENT_API = os.getenv("PAYMENT_API", "http://payment-api:8080").rstrip("/")
POLL_SECONDS = max(5.0, float(os.getenv("REMEDIATION_POLL_SECONDS", "10")))
MAX_TRACKED = 2000


def event(name, **fields):
    row = {"timestamp": datetime.now(timezone.utc).isoformat(),
           "component": "soar-observer", "version": VERSION, "event": name}
    row.update(fields)
    print(json.dumps(row, ensure_ascii=False, sort_keys=True), flush=True)


def classify(incident):
    """Classifie un intitulé d'incident, sans en déduire une attribution réseau."""
    kind = (incident.get("kind") or "").strip().casefold()
    if kind == "ml_test":
        return "synthetic_test", "OBSERVE_ONLY"
    if any(term in kind for term in ("déni de service", "deni de service", "ddos", "pic de trafic")):
        return "traffic_spike", "OBSERVE_ONLY"
    if "base de données" in kind or "database" in kind or "postgres" in kind:
        return "database_alert", "REVIEW"
    if "5xx" in kind or "hausse des erreurs" in kind:
        return "http_errors", "REVIEW"
    if "indisponib" in kind or "panne" in kind:
        return "service_unavailable", "REVIEW"
    if "ml_anomaly" in kind or "anomalie" in kind:
        return "statistical_anomaly", "OBSERVE_ONLY"
    return "unknown", "REVIEW"


def get_incidents(session):
    resp = session.get(f"{PAYMENT_API}/incidents", timeout=5)
    resp.raise_for_status()
    data = resp.json()
    if not isinstance(data, list):
        raise ValueError("Réponse incidents invalide (liste attendue)")
    return data


def get_api_health(session):
    """Simple signal technique : NE prouve PAS la reprise des paiements."""
    try:
        resp = session.get(f"{PAYMENT_API}/health", timeout=4)
        return resp.status_code == 200 and resp.json().get("status") == "ok"
    except (requests.RequestException, ValueError, AttributeError):
        return False


def analyze(incident, api_healthy):
    category, decision = classify(incident)
    missing = ["waf_log_attributed_to_verified_source", "business_payment_probe",
               "authorized_playbook_and_rollback_validation"]
    return {
        "incident_id": incident.get("id"),
        "incident_status_in_db": incident.get("status"),
        "category": category,
        "decision": decision,
        "technical_api_health_only": api_healthy,
        "missing_independent_evidence": missing,
        "action_executed": False,
        "incident_status_modified": False,
        "reason": "Preuves indépendantes insuffisantes; aucune autorisation d'action",
    }


def run_cycle(session, seen):
    incidents = get_incidents(session)
    if len(incidents) >= 50:
        event("pagination_limit_warning", count=len(incidents),
              warning="L'API /incidents expose les 50 plus récents, risque d'anciens incidents non visibles")
    api_healthy = get_api_health(session)
    for inc in incidents:
        if not isinstance(inc, dict) or inc.get("status") != "open":
            continue
        iid = inc.get("id")
        if not isinstance(iid, int) or iid in seen:
            continue
        if len(seen) >= MAX_TRACKED:
            seen.clear()  # les événements peuvent réapparaître ; pas d'action possible
        seen.add(iid)
        event("incident_observed", **analyze(inc, api_healthy))


def main():
    # Le moteur refuse explicitement d'interpréter les anciens paramètres comme
    # une autorisation de remédiation, même si le socket Docker reste monté.
    event("startup", mode="OBSERVE_ONLY", docker_actions=False,
          writes_to_api=False, target=PAYMENT_API)
    seen = set()
    with requests.Session() as session:
        while True:
            try:
                run_cycle(session, seen)
            except (requests.RequestException, ValueError) as exc:
                event("observation_error", error_type=type(exc).__name__)
            except Exception as exc:
                event("unexpected_error", error_type=type(exc).__name__)
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
