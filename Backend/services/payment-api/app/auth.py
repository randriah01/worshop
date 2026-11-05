import jwt
import os
from fastapi import Header, HTTPException, Depends

from . import config, db


def current_merchant(authorization: str = Header(default=None)):
    """Dépendance FastAPI : exige un JWT valide émis par l'auth-service."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")
    if "merchant_id" not in payload:
        raise HTTPException(status_code=401, detail="Token incomplet")
    if os.getenv("FACE_LOGIN_REQUIRED", "false").lower() in ("1", "true", "yes", "on"):
        if payload.get("auth_level") != "full" or not {"pwd", "face", "webauthn"}.issubset(
            set(payload.get("amr", []))
        ):
            raise HTTPException(status_code=403, detail="Vérification faciale obligatoire avant accès à NovaPay")
    # Protection contre les JWT conservés après suppression des données biométriques.
    # Les anciens JWT sans le claim sv sont rejetés (reconnexion nécessaire).
    sv = payload.get("sv")
    if type(sv) is not int or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Session invalide")
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT session_version, role FROM merchant_users WHERE login=%s AND merchant_id=%s",
                (payload["sub"], payload["merchant_id"]),
            )
            row = cur.fetchone()
    except Exception:
        # En cas d'indisponibilité de la base, refuser l'accès plutôt que d'accepter
        # un JWT dont on ne peut vérifier la révocation.
        raise HTTPException(status_code=503, detail="Vérification de session indisponible")
    finally:
        db.put_conn(conn)
    if row is None or int(row[0]) != sv:
        raise HTTPException(status_code=401, detail="Session révoquée ou invalide")
    payload["role"] = row[1]
    return payload


def require_admin(user=Depends(current_merchant)):
    """Dépendance : réservée aux comptes administrateur."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur")
    return user
