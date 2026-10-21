import os
import re
import time
import datetime
import hashlib
import secrets

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


def make_token(login: str, merchant_id: int, role: str) -> str:
    return jwt.encode(
        {
            "sub": login,
            "merchant_id": merchant_id,
            "role": role,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2),
        },
        SECRET,
        algorithm="HS256",
    )


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
        return {"access_token": make_token(login, merchant_id, "user"), "token_type": "bearer"}
    except HTTPException:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.post("/login")
def login(creds: Login):
    conn = db()
    cur = conn.cursor()
    cur.execute(
        "SELECT password_hash, merchant_id, role FROM merchant_users WHERE login = %s",
        (creds.login.strip().lower(),),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row or not verify_password(creds.password, row[0]):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    return {
        "access_token": make_token(creds.login.strip().lower(), row[1], row[2]),
        "token_type": "bearer",
    }
