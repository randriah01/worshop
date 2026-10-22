"""
remediation-engine — Moteur de remédiation automatique de NovaPay.

Boucle : lit les incidents OUVERTS (créés par la détection), choisit une action
corrective AUTORISÉE selon le TYPE d'incident, VÉRIFIE que le service est
réellement revenu à la normale, puis marque l'incident résolu — ou l'escalade.

Stratégies :
  - déni de service (DDoS) → LIMITATION DE DÉBIT sur le WAF (nginx limit_req),
    temporaire, levée automatiquement après une période de calme. On ne
    redémarre PAS l'API pour un DDoS : ça coupe le service sans arrêter l'attaque.
  - panne / hausse d'erreurs → relance du conteneur payment-api.
  - test synthétique ML    → aucune action (on ne touche pas la prod pour un test).
  - anomalie ML indicative → corrélation (santé + débit) avant toute action.

Sécurité (moindre privilège) : le moteur ne peut faire QUE des actions d'une
liste blanche :
  * relancer le conteneur payment-api,
  * recharger la config du conteneur WAF (commandes fixes `nginx -t` puis
    `nginx -s reload`),
  * écrire UN fichier de limitation dans un volume partagé avec le WAF.
Aucune commande libre. Il a besoin du socket Docker : c'est le composant
« à privilèges élevés » du projet, volontairement limité.

Règle d'or : un incident n'est jamais déclaré résolu parce qu'une commande a
tourné — seulement après vérification (santé + débit sous le seuil).
"""

import os
import time
from collections import deque
from pathlib import Path

import requests

PAYMENT_API = os.getenv("PAYMENT_API", "http://payment-api:8080")
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN", "internal-dev-token")
POLL = float(os.getenv("REMEDIATION_POLL_SECONDS", "5"))

# --- Listes blanches -------------------------------------------------------
TARGET_CONTAINER = os.getenv("TARGET_CONTAINER", "novapay-payment-api")
WAF_CONTAINER = os.getenv("WAF_CONTAINER", "novapay-waf")
ALLOWED_RESTART = {TARGET_CONTAINER}   # conteneurs qu'on a le droit de relancer
ALLOWED_RELOAD = {WAF_CONTAINER}       # conteneurs dont on peut recharger la config

# --- Remédiation « relance » ----------------------------------------------
MAX_ATTEMPTS = int(os.getenv("REMEDIATION_MAX_ATTEMPTS", "2"))
HEALTH_TIMEOUT = float(os.getenv("REMEDIATION_HEALTH_TIMEOUT", "40"))  # s pour vérifier la reprise
# Disjoncteur anti-boucle : pas plus de N relances par fenêtre glissante.
MAX_RESTARTS = int(os.getenv("REMEDIATION_MAX_RESTARTS", "3"))
RESTART_WINDOW = float(os.getenv("REMEDIATION_RESTART_WINDOW", "600"))

# --- Remédiation « limitation de débit » (DDoS) ----------------------------
RATE_OK = float(os.getenv("REMEDIATION_RATE_OK", "15"))          # req/s considérés « normaux »
RATE_WINDOW = float(os.getenv("REMEDIATION_RATE_WINDOW", "5"))   # s par mesure de débit
RL_BURST = int(os.getenv("REMEDIATION_RATELIMIT_BURST", "20"))   # rafale tolérée par IP
RL_HOLD = float(os.getenv("REMEDIATION_RATELIMIT_HOLD", "180"))  # s de maintien avant levée
RL_ZONE = os.getenv("REMEDIATION_RATELIMIT_ZONE", "novapay_perip")  # définie dans infra/waf
RL_DIR = Path(os.getenv("WAF_DYNAMIC_DIR", "/waf-dynamic"))
RL_FILE = RL_DIR / "ratelimit.inc"      # inclus par le WAF (glob *.inc) : présent = limitation active
RL_TMP = RL_DIR / "ratelimit.inc.tmp"   # ne matche pas *.inc → jamais lu à moitié par nginx

ACTION_RESTART = "Relance automatique du service de paiement"
ACTION_RATELIMIT = "Limitation de débit activée sur le WAF"

# Client Docker (optionnel : absent si le socket n'est pas monté).
try:
    import docker
    DOCKER = docker.from_env()
except Exception as e:  # pragma: no cover
    DOCKER = None
    print(f"[remediation] Docker indisponible : {e}", flush=True)

_restarts = deque()   # horodatages des relances récentes (disjoncteur)
_pending = {}         # incident_id -> (issue, action, tentatives) à rapporter à l'API


def log(msg):
    print(f"[remediation] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Lecture de l'état
# ---------------------------------------------------------------------------

def open_incidents():
    try:
        r = requests.get(f"{PAYMENT_API}/incidents", timeout=4)
        r.raise_for_status()
        return [i for i in r.json() if i.get("status") == "open"]
    except Exception:
        return []


def service_healthy():
    try:
        r = requests.get(f"{PAYMENT_API}/health", timeout=3)
        return r.status_code == 200 and r.json().get("status") == "ok"
    except Exception:
        return False


def read_total():
    """Total cumulé des requêtes HTTP vu par payment-api (None si injoignable)."""
    try:
        r = requests.get(f"{PAYMENT_API}/metrics", timeout=4)
        r.raise_for_status()
        total = 0.0
        for line in r.text.splitlines():
            if line.startswith("novapay_http_requests_total{"):
                total += float(line.rsplit(" ", 1)[1])
        return total
    except Exception:
        return None


def sample_rate(window=None):
    """Débit moyen (req/s) sur une fenêtre ; None si la mesure est impossible
    (API injoignable, ou compteur remis à zéro par un redémarrage)."""
    window = window or RATE_WINDOW
    t0, a = time.time(), read_total()
    time.sleep(window)
    t1, b = time.time(), read_total()
    if a is None or b is None or b < a:
        return None
    return (b - a) / (t1 - t0)


# ---------------------------------------------------------------------------
# Action 1 : relance du service
# ---------------------------------------------------------------------------

def _restart_budget_left():
    now = time.time()
    while _restarts and now - _restarts[0] > RESTART_WINDOW:
        _restarts.popleft()
    return len(_restarts) < MAX_RESTARTS


def restart_service():
    """Action autorisée : relancer proprement le service de paiement.
    Retourne True UNIQUEMENT si la relance a réellement eu lieu."""
    if TARGET_CONTAINER not in ALLOWED_RESTART:
        log(f"REFUS : {TARGET_CONTAINER} hors liste blanche.")
        return False
    if DOCKER is None:
        log("REFUS : accès Docker indisponible (socket non monté).")
        return False
    if not _restart_budget_left():
        log(f"REFUS : disjoncteur — déjà {MAX_RESTARTS} relances en {int(RESTART_WINDOW)} s.")
        return False
    try:
        DOCKER.containers.get(TARGET_CONTAINER).restart(timeout=10)
        _restarts.append(time.time())
        log(f"Action : conteneur {TARGET_CONTAINER} relancé.")
        return True
    except Exception as e:
        log(f"Échec de la relance : {e}")
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


def remediate_service():
    performed = 0
    for _ in range(MAX_ATTEMPTS):
        if not restart_service():
            log("Relance impossible → inutile d'attendre, escalade.")
            break
        performed += 1
        log(f"Vérification de la reprise (relance {performed}/{MAX_ATTEMPTS})…")
        if verify_recovery():
            return "resolved", ACTION_RESTART, performed
        log(f"Service toujours dégradé après la relance {performed}.")
    action = ACTION_RESTART if performed else "Aucune action appliquée (relance refusée ou impossible)"
    return "escalated", action, performed


# ---------------------------------------------------------------------------
# Action 2 : limitation de débit sur le WAF (DDoS)
# ---------------------------------------------------------------------------

def _rl_content():
    return (
        "# Généré par remediation-engine — mitigation DDoS temporaire.\n"
        "# Supprimer ce fichier + recharger le WAF = limitation levée.\n"
        f"limit_req zone={RL_ZONE} burst={RL_BURST} nodelay;\n"
        "limit_req_status 429;\n"
    )


def reload_waf():
    """Recharge la config du WAF (commandes fixes de la liste blanche)."""
    if WAF_CONTAINER not in ALLOWED_RELOAD:
        log(f"REFUS : {WAF_CONTAINER} hors liste blanche.")
        return False
    if DOCKER is None:
        log("REFUS : accès Docker indisponible (socket non monté).")
        return False
    try:
        waf = DOCKER.containers.get(WAF_CONTAINER)
        for cmd in (["nginx", "-t"], ["nginx", "-s", "reload"]):
            res = waf.exec_run(cmd)
            if res.exit_code != 0:
                out = (res.output or b"").decode(errors="replace").strip()
                log(f"WAF : `{' '.join(cmd)}` a échoué ({res.exit_code}) : {out}")
                return False
        return True
    except Exception as e:
        log(f"Échec du rechargement du WAF : {e}")
        return False


def enable_rate_limit():
    """Active la limitation (idempotent). True si elle est effective."""
    try:
        RL_DIR.mkdir(parents=True, exist_ok=True)
        if RL_FILE.exists():            # déjà active : on prolonge le maintien
            RL_FILE.touch()
            log("Limitation de débit déjà active : maintien prolongé.")
            return True
        RL_TMP.write_text(_rl_content())
        os.replace(RL_TMP, RL_FILE)     # écriture atomique
    except OSError as e:
        log(f"Impossible d'écrire la limitation ({RL_DIR}) : {e}")
        return False
    if reload_waf():
        log(f"Action : limitation de débit ACTIVÉE sur le WAF (rafale {RL_BURST}, maintien {int(RL_HOLD)} s).")
        return True
    RL_FILE.unlink(missing_ok=True)     # on ne laisse jamais une config non appliquée
    return False


def disable_rate_limit():
    """Lève la limitation. En cas d'échec du rechargement, on restaure l'état
    pour réessayer au tour suivant (le fichier reflète ce que le WAF applique)."""
    try:
        st = RL_FILE.stat()
        content = RL_FILE.read_text()
        RL_FILE.unlink()
    except OSError:
        return False
    if reload_waf():
        log("Retour à la normale : limitation de débit LEVÉE.")
        return True
    RL_FILE.write_text(content)
    os.utime(RL_FILE, (st.st_atime, st.st_mtime))
    return False


def maybe_lift_rate_limit():
    """Lève la limitation après RL_HOLD secondes sans nouvel incident DDoS.
    Si l'attaque persiste, la détection recrée un incident et on réactive."""
    try:
        age = time.time() - RL_FILE.stat().st_mtime
    except OSError:
        return
    if age >= RL_HOLD:
        disable_rate_limit()


def verify_ddos_contained():
    """Preuve de contenance : deux fenêtres consécutives avec débit <= seuil
    ET service en bonne santé."""
    deadline = time.time() + HEALTH_TIMEOUT
    good = 0
    while time.time() < deadline:
        rate = sample_rate()
        healthy = service_healthy()
        if rate is None:
            good = 0
            continue
        log(f"Contrôle : débit {rate:.1f} req/s (seuil {RATE_OK:.0f}), "
            f"service {'OK' if healthy else 'dégradé'}.")
        good = good + 1 if (rate <= RATE_OK and healthy) else 0
        if good >= 2:
            return True
    return False


def remediate_ddos():
    if not enable_rate_limit():
        # Pas de redémarrage de substitution : il ne stopperait pas l'attaque.
        return "escalated", "Limitation de débit impossible (WAF injoignable ou config refusée)", 0
    log("Vérification de la mitigation…")
    if verify_ddos_contained():
        return "resolved", ACTION_RATELIMIT, 1
    # Limite en place mais le service ne répond toujours pas : relance en complément.
    if not service_healthy():
        log("API toujours dégradée malgré la limitation → relance en complément.")
        if restart_service():
            if verify_ddos_contained():
                return "resolved", f"{ACTION_RATELIMIT} + relance du service", 2
            return "escalated", f"{ACTION_RATELIMIT} + relance du service (insuffisant)", 2
    return "escalated", f"{ACTION_RATELIMIT} (trafic toujours anormal)", 1


# ---------------------------------------------------------------------------
# Décision
# ---------------------------------------------------------------------------

def classify(inc):
    kind = (inc.get("kind") or "").lower()
    if kind == "ml_test":
        return "test"
    if "déni de service" in kind or "ddos" in kind or "pic de trafic" in kind:
        return "ddos"
    if kind == "ml_anomaly":
        return "ml"
    return "service"


def diagnose():
    """Corrèle une anomalie ML indicative avec l'état réel du service."""
    if not service_healthy():
        return "service"
    rate = sample_rate()
    if rate is not None and rate > RATE_OK:
        return "ddos"
    return "benign"


def handle(inc):
    """Retourne (issue, action, tentatives) ; issue ∈ {'resolved', 'escalated'}."""
    category = classify(inc)
    log(f"Incident #{inc['id']} ({inc.get('kind')}) → catégorie « {category} ».")
    if category == "test":
        return "resolved", "Test synthétique : aucune action (la production n'est pas touchée)", 0
    if category == "ml":
        category = diagnose()
        if category == "benign":
            return "resolved", "Aucune action : anomalie ML non confirmée (service sain, débit normal)", 0
    if category == "ddos":
        return remediate_ddos()
    return remediate_service()


# ---------------------------------------------------------------------------
# Compte rendu à l'API (avec reprise en cas d'échec)
# ---------------------------------------------------------------------------

def _post(path, action, attempts):
    try:
        r = requests.post(
            f"{PAYMENT_API}{path}",
            json={"action": action, "attempts": attempts},
            headers={"X-Internal-Token": INTERNAL_TOKEN},
            timeout=6,
        )
        r.raise_for_status()
        return True
    except Exception as e:
        log(f"Échec mise à jour incident : {e}")
        return False


def report(incident_id, issue, action, attempts):
    """Ne prétend avoir clos l'incident que si l'API l'a réellement enregistré."""
    path = "resolve" if issue == "resolved" else "escalate"
    if _post(f"/incidents/{incident_id}/{path}", action, attempts):
        _pending.pop(incident_id, None)
        if issue == "resolved":
            log(f"Incident #{incident_id} RÉSOLU ({action}) après {attempts} tentative(s).")
        else:
            log(f"Incident #{incident_id} ESCALADÉ ({action}) après {attempts} tentative(s).")
    else:
        _pending[incident_id] = (issue, action, attempts)
        log(f"Incident #{incident_id} : compte rendu en attente, nouvel essai au prochain cycle.")


def flush_pending():
    for incident_id, (issue, action, attempts) in list(_pending.items()):
        report(incident_id, issue, action, attempts)


def main():
    log(f"Démarrage. Cible={TARGET_CONTAINER}, WAF={WAF_CONTAINER}, API={PAYMENT_API}")
    handled = set()
    failures = {}
    while True:
        time.sleep(POLL)
        flush_pending()
        for inc in open_incidents():
            iid = inc["id"]
            if iid in handled:
                continue
            handled.add(iid)
            try:
                issue, action, attempts = handle(inc)
            except Exception as e:
                failures[iid] = failures.get(iid, 0) + 1
                log(f"Erreur pendant la remédiation de #{iid} ({failures[iid]}) : {e}")
                if failures[iid] >= MAX_ATTEMPTS:
                    report(iid, "escalated", "Remédiation en erreur (voir les logs du moteur)", 0)
                else:
                    handled.discard(iid)   # sera retenté au prochain cycle
                continue
            report(iid, issue, action, attempts)
        maybe_lift_rate_limit()


if __name__ == "__main__":
    main()
