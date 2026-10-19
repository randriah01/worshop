import os
import datetime

import jwt
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="NovaPay auth-service")

SECRET = os.getenv("JWT_SECRET", "dev-secret-a-remplacer")


class Login(BaseModel):
    merchant: str
    password: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/login")
def login(creds: Login):
    # DÉMO : vérification volontairement minimale.
    # À remplacer par une vraie authentification (hash + base commerçants).
    if not creds.merchant or not creds.password:
        raise HTTPException(status_code=401, detail="Identifiants requis")
    token = jwt.encode(
        {
            "sub": creds.merchant,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        },
        SECRET,
        algorithm="HS256",
    )
    return {"access_token": token, "token_type": "bearer"}
