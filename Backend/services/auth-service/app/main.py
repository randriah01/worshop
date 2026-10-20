import os
import time
import datetime
import hashlib
import secrets

import jwt
import psycopg2
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

SECRET = os.getenv("JWT_SECRET", "dev-secret-a-remplacer")

# Comptes de démonstration : (login, mot de passe, slug du commerçant).
# Créés automatiquement au démarrage s'ils n'existent pas déjà.
DEMO_USERS = [
    ("fournil", "demo1234", "fournil"),
    ("cafe", "demo1234", "cafe"),
    ("epicerie", "demo1234", "epicerie"),
]


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


app = FastAPI(title="NovaPay auth-service")


@app.on_event("startup")
def seed_demo_users():
    conn = db()
    cur = conn.cursor()
    for login, password, slug in DEMO_USERS:
        cur.execute("SELECT id FROM merchants WHERE slug = %s", (slug,))
        row = cur.fetchone()
        if not row:
            continue
        merchant_id = row[0]
        cur.execute("SELECT 1 FROM merchant_users WHERE login = %s", (login,))
        if cur.fetchone():
            continue
        cur.execute(
            "INSERT INTO merchant_users (login, password_hash, merchant_id) "
            "VALUES (%s, %s, %s)",
            (login, hash_password(password), merchant_id),
        )
    conn.commit()
    cur.close()
    conn.close()


class Login(BaseModel):
    login: str
    password: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/login")
def login(creds: Login):
    conn = db()
    cur = conn.cursor()
    cur.execute(
        "SELECT password_hash, merchant_id FROM merchant_users WHERE login = %s",
        (creds.login,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row or not verify_password(creds.password, row[0]):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    token = jwt.encode(
        {
            "sub": creds.login,
            "merchant_id": row[1],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2),
        },
        SECRET,
        algorithm="HS256",
    )
    return {"access_token": token, "token_type": "bearer"}
