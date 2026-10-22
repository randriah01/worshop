"""
remediation-engine — Moteur de remédiation automatique de NovaPay.

Boucle : lit les incidents OUVERTS (créés par la détection), applique une
action corrective AUTORISÉE, VÉRIFIE que le service répond réellement, puis
marque l'incident résolu — ou l'escalade si la reprise échoue.

Sécurité (principe de moindre privilège) : le moteur ne peut faire QUE les
actions d'une liste blanche (relancer un conteneur précis). Il n'exécute
aucune commande libre. Il a besoin du socket Docker pour relancer un service :
c'est le composant « à privilèges élevés » du projet, volontairement limité.

Règle d'or : un incident n'est jamais déclaré résolu parce qu'une commande a
tourné — il l'est seulement après vérification que /health répond.
"""

import os
import time

import requests

PAYMENT_API = os.getenv("PAYMENT_API", "http://payment-api:8080")
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN", "internal-dev-token")
POLL = float(os.getenv("REMEDIATION_POLL_SECONDS", "5"))

# Liste blanche : le SEUL conteneur que le moteur a le droit de relancer.
TARGET_CONTAINER = os.getenv("TARGET_CONTAINER", "novapay-payment-api")
ALLOWED_CONTAINERS = {TARGET_CONTAINER}

MAX_ATTEMPTS = int(os.getenv("REMEDIATION_MAX_ATTEMPTS", "2"))
HEALTH_TIMEOUT = float(os.getenv("REMEDIATION_HEALTH_TIMEOUT", "40"))  # s pour vérifier la reprise

# Client Docker (optionnel : absent si le socket n'est pas monté).
try:
    import docker
    DOCKER = docker.from_env()
except Exception as e:  # pragma: no cover
    DOCKER = None
    print(f"[remediation] Docker indisponible : {e}", flush=True)


def log(msg):
    print(f"[remediation] {msg}", flush=True)


def open_incidents():
    try:
        r = requests.get(f"{PAYMENT_API}/incidents", timeout=4)
        r.raise_for_status()
        return [i for i in r.json() if i.get("status") == "open"]
    except Exception:
        return []


def restart_service():
    """Action autorisée : relancer proprement le service de paiement."""
    if TARGET_CONTAINER not in ALLOWED_CONTAINERS:
        log(f"REFUS : {TARGET_CONTAINER} hors liste blanche.")
        return False
    if DOCKER is None:
        log("REFUS : accès Docker indisponible (socket non monté).")
        return False
    try:
        c = DOCKER.containers.get(TARGET_CONTAINER)
        c.restart(timeout=10)
        log(f"Action : conteneur {TARGET_CONTAINER} relancé.")
        return True
    except Exception as e:
        log(f"Échec de la relance : {e}")
        return False


def service_healthy():
    try:
        r = requests.get(f"{PAYMENT_API}/health", timeout=3)
        return r.status_code == 200 and r.json().get("status") == "ok"
    except Exception:
        return False


def verify_recovery():
    """Vérifie que le service répond RÉELLEMENT (pas juste qu'on a agi).
    Exige deux contrôles de santé OK consécutifs dans la fenêtre impartie."""
    deadline = time.time() + HEALTH_TIMEOUT
    good = 0
    while time.time() < deadline:
        if service_healthy():
            good += 1
            if good >= 2:
                return True
        else:
            good = 0
        time.sleep(2)
    return False


def resolve(incident_id, action, attempts):
    _post(f"/incidents/{incident_id}/resolve", action, attempts)
    log(f"Incident #{incident_id} RÉSOLU après {attempts} tentative(s).")


def escalate(incident_id, action, attempts):
    _post(f"/incidents/{incident_id}/escalate", action, attempts)
    log(f"Incident #{incident_id} ESCALADÉ (reprise impossible après {attempts} tentatives).")


def _post(path, action, attempts):
    try:
        requests.post(
            f"{PAYMENT_API}{path}",
            json={"action": action, "attempts": attempts},
            headers={"X-Internal-Token": INTERNAL_TOKEN},
            timeout=6,
        )
    except Exception as e:
        log(f"Échec mise à jour incident : {e}")


def handle(inc):
    incident_id = inc["id"]
    action = "Relance automatique du service de paiement"
    log(f"Incident #{incident_id} ({inc.get('kind')}) → remédiation en cours.")
    for attempt in range(1, MAX_ATTEMPTS + 1):
        restart_service()
        log(f"Vérification de la reprise (tentative {attempt}/{MAX_ATTEMPTS})…")
        if verify_recovery():
            resolve(incident_id, action, attempt)
            return
        log(f"Service toujours dégradé après la tentative {attempt}.")
    escalate(incident_id, action, MAX_ATTEMPTS)


def main():
    log(f"Démarrage. Cible={TARGET_CONTAINER}, API={PAYMENT_API}")
    handled = set()
    while True:
        time.sleep(POLL)
        for inc in open_incidents():
            if inc["id"] in handled:
                continue
            handled.add(inc["id"])
            try:
                handle(inc)
            except Exception as e:
                log(f"Erreur pendant la remédiation : {e}")


if __name__ == "__main__":
    main()
