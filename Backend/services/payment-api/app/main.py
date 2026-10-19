import json
import time
import logging

from fastapi import FastAPI, Depends, HTTPException, Request, Header
from prometheus_client import Counter, Histogram, Gauge, make_asgi_app

from . import db, config
from .auth import current_merchant
from .models import TxIn, IncidentIn

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("payment-api")

app = FastAPI(title="NovaPay payment-api")

# Métriques exposées sur /metrics pour Prometheus et la détection ML.
app.mount("/metrics", make_asgi_app())

REQS = Counter(
    "novapay_http_requests_total", "Requêtes HTTP", ["method", "endpoint", "status"]
)
LAT = Histogram(
    "novapay_http_request_duration_seconds", "Durée des requêtes", ["endpoint"]
)
TX = Counter("novapay_transactions_total", "Transactions traitées", ["status"])
AMT = Histogram(
    "novapay_transaction_amount_cents",
    "Montant des transactions (centimes)",
    buckets=(100, 500, 1000, 5000, 10000, 50000),
)
DBUP = Gauge("novapay_db_up", "1 si la base répond, 0 sinon")


@app.on_event("startup")
def startup():
    db.init_pool()


@app.middleware("http")
async def observe(request: Request, call_next):
    """Mesure durée et statut de chaque requête, et journalise (pour Loki/SIEM)."""
    start = time.perf_counter()
    endpoint = request.url.path
    status = 500
    try:
        response = await call_next(request)
        status = response.status_code
        return response
    finally:
        LAT.labels(endpoint).observe(time.perf_counter() - start)
        REQS.labels(request.method, endpoint, str(status)).inc()
        log.info(
            json.dumps(
                {
                    "evt": "request",
                    "method": request.method,
                    "path": endpoint,
                    "status": status,
                }
            )
        )


@app.get("/health")
def health():
    ok = db.db_ok()
    DBUP.set(1 if ok else 0)
    if not ok:
        raise HTTPException(status_code=503, detail="Base indisponible")
    return {"status": "ok"}


@app.post("/transactions")
def create_tx(tx: TxIn, merchant=Depends(current_merchant)):
    """Encaisse une transaction : crédite le solde et enregistre l'opération,
    le tout dans une seule transaction SQL pour rester cohérent."""
    merchant_id = merchant["merchant_id"]
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE merchants SET balance_cents = balance_cents + %s "
            "WHERE id = %s RETURNING balance_cents",
            (tx.amount_cents, merchant_id),
        )
        row = cur.fetchone()
        if row is None:
            conn.rollback()
            TX.labels("rejected").inc()
            raise HTTPException(status_code=404, detail="Commerçant inconnu")
        cur.execute(
            "INSERT INTO transactions (merchant_id, amount_cents, status) "
            "VALUES (%s, %s, 'validated') RETURNING id",
            (merchant_id, tx.amount_cents),
        )
        tx_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        TX.labels("validated").inc()
        AMT.observe(tx.amount_cents)
        return {
            "id": tx_id,
            "status": "validated",
            "merchant_id": merchant_id,
            "new_balance_cents": row[0],
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        TX.labels("error").inc()
        log.info(json.dumps({"evt": "tx_error", "error": str(e)}))
        raise HTTPException(status_code=500, detail="Erreur de traitement")
    finally:
        db.put_conn(conn)


@app.get("/transactions")
def list_tx(merchant=Depends(current_merchant)):
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT t.id, m.name, t.amount_cents, t.status, t.created_at "
            "FROM transactions t JOIN merchants m ON m.id = t.merchant_id "
            "ORDER BY t.id DESC LIMIT 20"
        )
        rows = cur.fetchall()
        cur.close()
        return [
            {
                "id": r[0],
                "merchant": r[1],
                "amount_cents": r[2],
                "status": r[3],
                "created_at": r[4].isoformat(),
            }
            for r in rows
        ]
    finally:
        db.put_conn(conn)


@app.get("/merchants")
def merchants():
    """Soldes des commerçants — utile au dashboard de supervision."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, name, balance_cents FROM merchants ORDER BY id")
        rows = cur.fetchall()
        cur.close()
        return [{"id": r[0], "name": r[1], "balance_cents": r[2]} for r in rows]
    finally:
        db.put_conn(conn)


@app.post("/incidents")
def create_incident(inc: IncidentIn, x_internal_token: str = Header(default=None)):
    """Réservé aux composants internes (détection, remédiation)."""
    if x_internal_token != config.INTERNAL_TOKEN:
        raise HTTPException(status_code=403, detail="Accès interne requis")
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO incidents (kind, detail) VALUES (%s, %s) RETURNING id",
            (inc.kind, inc.detail),
        )
        incident_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        return {"id": incident_id, "status": "open"}
    finally:
        db.put_conn(conn)


@app.get("/incidents")
def list_incidents():
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, kind, detail, status, created_at "
            "FROM incidents ORDER BY id DESC LIMIT 50"
        )
        rows = cur.fetchall()
        cur.close()
        return [
            {
                "id": r[0],
                "kind": r[1],
                "detail": r[2],
                "status": r[3],
                "created_at": r[4].isoformat(),
            }
            for r in rows
        ]
    finally:
        db.put_conn(conn)
