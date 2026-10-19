import os
import time

import psycopg2
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from prometheus_client import Counter, Histogram, make_asgi_app

app = FastAPI(title="NovaPay payment-api")

# Expose /metrics pour Prometheus (pilier Infrastructure).
app.mount("/metrics", make_asgi_app())

TX = Counter("novapay_transactions_total", "Transactions traitées", ["status"])
LAT = Histogram("novapay_tx_latency_seconds", "Latence de traitement d'une transaction")


def db():
    """Connexion PostgreSQL avec quelques tentatives, le temps que la base démarre."""
    for _ in range(20):
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


class Tx(BaseModel):
    merchant: str
    amount_cents: int


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/transactions")
def create_tx(tx: Tx):
    with LAT.time():
        if tx.amount_cents <= 0:
            TX.labels("rejected").inc()
            raise HTTPException(status_code=400, detail="Montant invalide")
        conn = db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO transactions (merchant, amount_cents, status) "
            "VALUES (%s, %s, 'validated') RETURNING id",
            (tx.merchant, tx.amount_cents),
        )
        tid = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        TX.labels("validated").inc()
        return {"id": tid, "status": "validated"}


@app.get("/transactions")
def list_tx():
    conn = db()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, merchant, amount_cents, status "
        "FROM transactions ORDER BY id DESC LIMIT 20"
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {"id": r[0], "merchant": r[1], "amount_cents": r[2], "status": r[3]}
        for r in rows
    ]
