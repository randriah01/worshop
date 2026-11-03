import os
import re
import time
import datetime
import hashlib
import secrets
import uuid

import jwt
import psycopg2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

SECRET = os.getenv("JWT_SECRET", "dev-secret-a-remplacer")
ADMIN_LOGIN = os.getenv("ADMIN_LOGIN", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin1234")


def db():
    """Connexion PostgreSQL, avec attente le temps que la base soit prête."""
    for _ in range(30):
        try:
            return psycopg2.connect(
                host=os.getenv("DB_HOST", "postgres"),
                dbname=os.getenv("DB_NAME", "novapay"),
                user=os.getenv("DB_USER", "novapay"),
                password=os.getenv("DB_PASSWORD", "changeme"),
            )
        except Exception:
            time.sleep(2)
    raise RuntimeError("Base de données indisponible")


def hash_password(password: str, iterations: int = 200_000) -> str:
    """Hachage PBKDF2-HMAC-SHA256 avec sel aléatoire (bibliothèque standard)."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2${iterations}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations)
        )
        return secrets.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def face_required() -> bool:
    """Activation progressive : activer sur le Mac après tests, puis sur VM1."""
    return os.getenv("FACE_LOGIN_REQUIRED", "false").lower() in ("1", "true", "yes", "on")


def make_token(login: str, merchant_id: int, role: str, *,
               level: str = "legacy", methods: list[str] | None = None) -> str:
    """Un token 'setup' ne doit JAMAIS autoriser l'API de paiement."""
    now = datetime.datetime.now(datetime.timezone.utc)
    payload = {
        "sub": login,
        "merchant_id": merchant_id,
        "role": role,
        "auth_level": level,
        "amr": methods or ["pwd"],
        "iat": now,
        "exp": now + datetime.timedelta(minutes=15 if level == "setup" else 120),
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")


app = FastAPI(title="NovaPay auth-service")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


@app.on_event("startup")
def seed_admin():
    """Crée le compte administrateur au démarrage s'il n'existe pas."""
    conn = db()
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM merchant_users WHERE login = %s", (ADMIN_LOGIN,))
    if not cur.fetchone():
        cur.execute(
            "INSERT INTO merchants (slug, name) VALUES ('administration', 'Administration') "
            "ON CONFLICT (slug) DO NOTHING RETURNING id"
        )
        row = cur.fetchone()
        if row:
            merchant_id = row[0]
        else:
            cur.execute("SELECT id FROM merchants WHERE slug = 'administration'")
            merchant_id = cur.fetchone()[0]
        cur.execute(
            "INSERT INTO merchant_users (login, password_hash, merchant_id, role) "
            "VALUES (%s, %s, %s, 'admin')",
            (ADMIN_LOGIN, hash_password(ADMIN_PASSWORD), merchant_id),
        )
    conn.commit()
    cur.close()
    conn.close()


class Login(BaseModel):
    login: str
    password: str


class Register(BaseModel):
    login: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=6, max_length=100)
    shop_name: str = Field(min_length=2, max_length=80)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/register")
def register(data: Register):
    login = data.login.strip().lower()
    if not re.fullmatch(r"[a-z0-9_.-]+", login):
        raise HTTPException(status_code=400, detail="Identifiant : lettres, chiffres, . _ - uniquement")
    if face_required():
        # Pas de création de comptes sans configuration WebAuthn / Face-AI.
        from .face_auth import config as face_config
        face_config()
    conn = db()
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM merchant_users WHERE login = %s", (login,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Cet identifiant est déjà pris")
        # Un commerce par compte. Slug unique dérivé du login.
        slug = login
        cur.execute("SELECT 1 FROM merchants WHERE slug = %s", (slug,))
        if cur.fetchone():
            slug = f"{login}-{secrets.token_hex(3)}"
        cur.execute(
            "INSERT INTO merchants (slug, name) VALUES (%s, %s) RETURNING id",
            (slug, data.shop_name.strip()),
        )
        merchant_id = cur.fetchone()[0]
        cur.execute(
            "INSERT INTO merchant_users (login, password_hash, merchant_id, role) "
            "VALUES (%s, %s, %s, 'user')",
            (login, hash_password(data.password), merchant_id),
        )
        conn.commit()
        cur.close()
        level = "setup" if face_required() else "legacy"
        return {
            "access_token": make_token(login, merchant_id, "user", level=level,
                                       methods=["registration"] if level == "setup" else ["pwd"]),
            "token_type": "bearer",
            "requires_enrollment": face_required(),
        }
    except HTTPException:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.post("/login")
def login(creds: Login):
    login_name = creds.login.strip().lower()
    if face_required():
        from .face_auth import config as face_config
        face_config()
    conn = db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, password_hash, merchant_id, role FROM merchant_users WHERE login=%s",
                (login_name,),
            )
            row = cur.fetchone()
            if not row or not verify_password(creds.password, row[1]):
                raise HTTPException(status_code=401, detail="Identifiants invalides")

            user_id, _, merchant_id, role = row
            if not face_required():
                return {"access_token": make_token(login_name, merchant_id, role), "token_type": "bearer"}

            cur.execute(
                "SELECT EXISTS(SELECT 1 FROM face_templates WHERE user_id=%s), "
                "EXISTS(SELECT 1 FROM passkey_credentials WHERE user_id=%s)",
                (user_id, user_id),
            )
            face_enrolled, has_passkey = cur.fetchone()
            if not (face_enrolled and has_passkey):
                # Bootstrap limité : permet seulement l'enrôlement, jamais /api/*.
                return {
                    "requires_enrollment": True,
                    "setup_token": make_token(login_name, merchant_id, role, level="setup", methods=["pwd"]),
                }

            cur.execute("DELETE FROM biometric_challenges WHERE expires_at < now()-interval '1 day'")
            cur.execute(
                "SELECT count(*) FROM biometric_challenges "
                "WHERE user_id=%s AND purpose='face_login' AND created_at>now()-interval '15 minutes'",
                (user_id,),
            )
            if cur.fetchone()[0] >= 8:
                raise HTTPException(429, "Trop de tentatives : réessaie plus tard")
            challenge_id = uuid.uuid4()
            cur.execute(
                "INSERT INTO biometric_challenges(id,user_id,purpose,expires_at) "
                "VALUES (%s,%s,'face_login',now()+interval '3 minutes')",
                (str(challenge_id), user_id),
            )
        conn.commit()
        return {"requires_face": True, "challenge_id": str(challenge_id), "expires_in_seconds": 180}
    finally:
        conn.close()

# Module de connexion faciale optionnel : l'ancienne connexion reste intacte.
from .face_auth import router as face_router
app.include_router(face_router)
