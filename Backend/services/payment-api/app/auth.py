import jwt
from fastapi import Header, HTTPException, Depends

from . import config


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
    return payload


def require_admin(user=Depends(current_merchant)):
    """Dépendance : réservée aux comptes administrateur."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur")
    return user
