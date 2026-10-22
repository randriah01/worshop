import json
import time
import logging

import psycopg2
from fastapi import FastAPI, Depends, HTTPException, Request, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Histogram, Gauge, make_asgi_app

from . import db, config
from .auth import current_merchant, require_admin
from .models import TxIn, IncidentIn

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("payment-api")

app = FastAPI(title="NovaPay payment-api")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

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
        log.info(json.dumps({"evt": "request", "method": request.method, "path": endpoint, "status": status}))


@app.get("/health")
def health():
    ok = db.db_ok()
    DBUP.set(1 if ok else 0)
    if not ok:
        raise HTTPException(status_code=503, detail="Base indisponible")
    return {"status": "ok"}


@app.get("/me")
def me(user=Depends(current_merchant)):
    """Profil du compte connecté (nom du commerce, solde, rôle)."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT name, balance_cents FROM merchants WHERE id = %s", (user["merchant_id"],))
        row = cur.fetchone()
        cur.close()
        return {
            "login": user["sub"],
            "merchant_id": user["merchant_id"],
            "role": user.get("role", "user"),
            "shop_name": row[0] if row else "",
            "balance_cents": row[1] if row else 0,
        }
    finally:
        db.put_conn(conn)


def _existing_tx(cur, merchant_id, key):
    """Retourne la transaction déjà créée pour cette clé d'idempotence, ou None."""
    cur.execute(
        "SELECT id, status FROM transactions "
        "WHERE merchant_id = %s AND idempotency_key = %s",
        (merchant_id, key),
    )
    return cur.fetchone()


def _balance(cur, merchant_id):
    cur.execute("SELECT balance_cents FROM merchants WHERE id = %s", (merchant_id,))
    r = cur.fetchone()
    return r[0] if r else 0


@app.post("/transactions")
def create_tx(
    tx: TxIn,
    user=Depends(current_merchant),
    idempotency_key: str = Header(default=None, alias="Idempotency-Key"),
):
    """Encaisse une transaction pour le commerce du compte connecté.

    Idempotence : si l'en-tête Idempotency-Key a déjà été traité pour ce
    commerçant, on renvoie la transaction existante sans en créer une nouvelle
    ni recréditer le solde (protège contre les doublons en cas de renvoi)."""
    merchant_id = user["merchant_id"]
    conn = db.get_conn()
    try:
        cur = conn.cursor()

        # 1) Rejeu : la clé a déjà été traitée → on renvoie l'existant.
        if idempotency_key:
            existing = _existing_tx(cur, merchant_id, idempotency_key)
            if existing:
                bal = _balance(cur, merchant_id)
                cur.close()
                return {
                    "id": existing[0], "status": existing[1],
                    "merchant_id": merchant_id, "new_balance_cents": bal,
                    "idempotent_replay": True,
                }

        # 2) Traitement normal : crédit du solde + enregistrement, atomiques.
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
            "INSERT INTO transactions (merchant_id, amount_cents, status, idempotency_key) "
            "VALUES (%s, %s, 'validated', %s) RETURNING id",
            (merchant_id, tx.amount_cents, idempotency_key),
        )
        tx_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        TX.labels("validated").inc()
        AMT.observe(tx.amount_cents)
        return {"id": tx_id, "status": "validated", "merchant_id": merchant_id, "new_balance_cents": row[0]}

    except psycopg2.errors.UniqueViolation:
        # Deux requêtes identiques en parallèle : la 2e est rejetée par l'index
        # unique. On annule et on renvoie la transaction déjà créée.
        conn.rollback()
        cur = conn.cursor()
        existing = _existing_tx(cur, merchant_id, idempotency_key)
        bal = _balance(cur, merchant_id)
        cur.close()
        if existing:
            return {
                "id": existing[0], "status": existing[1],
                "merchant_id": merchant_id, "new_balance_cents": bal,
                "idempotent_replay": True,
            }
        raise HTTPException(status_code=409, detail="Conflit d'idempotence")
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
def list_tx(
    user=Depends(current_merchant),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status: str = Query(None),
):
    """Transactions DU compte connecté uniquement."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        where = "WHERE t.merchant_id = %s"
        params = [user["merchant_id"]]
        if status:
            where += " AND t.status = %s"
            params.append(status)
        params.extend([limit, offset])
        cur.execute(
            "SELECT t.id, m.name, t.amount_cents, t.status, t.created_at "
            "FROM transactions t JOIN merchants m ON m.id = t.merchant_id "
            f"{where} ORDER BY t.id DESC LIMIT %s OFFSET %s",
            params,
        )
        rows = cur.fetchall()
        cur.close()
        return [
            {"id": r[0], "merchant": r[1], "amount_cents": r[2], "status": r[3], "created_at": r[4].isoformat()}
            for r in rows
        ]
    finally:
        db.put_conn(conn)


@app.get("/stats")
def stats(user=Depends(current_merchant)):
    """Agrégats DU compte connecté (dashboard personnel)."""
    mid = user["merchant_id"]
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT COUNT(*), "
            "COUNT(*) FILTER (WHERE status = 'validated'), "
            "COUNT(*) FILTER (WHERE status IN ('rejected','error')), "
            "COUNT(*) FILTER (WHERE status = 'pending'), "
            "COALESCE(SUM(amount_cents) FILTER (WHERE status = 'validated'), 0) "
            "FROM transactions WHERE merchant_id = %s",
            (mid,),
        )
        total, validated, failed, pending, volume = cur.fetchone()
        cur.execute(
            "SELECT to_char(d.day, 'YYYY-MM-DD'), COUNT(t.id), "
            "COALESCE(SUM(t.amount_cents) FILTER (WHERE t.status = 'validated'), 0) "
            "FROM generate_series((now()::date - interval '6 day'), now()::date, interval '1 day') AS d(day) "
            "LEFT JOIN transactions t ON t.created_at::date = d.day AND t.merchant_id = %s "
            "GROUP BY d.day ORDER BY d.day",
            (mid,),
        )
        series = [{"day": r[0], "count": r[1], "volume_cents": r[2]} for r in cur.fetchall()]
        cur.execute("SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'open') FROM incidents")
        inc_total, inc_open = cur.fetchone()
        cur.close()
        success_rate = round(100.0 * validated / total, 1) if total else 0.0
        return {
            "total": total, "validated": validated, "failed": failed, "pending": pending,
            "volume_cents": volume, "success_rate": success_rate,
            "incidents_total": inc_total, "incidents_open": inc_open, "series": series,
        }
    finally:
        db.put_conn(conn)


@app.get("/admin/users")
def admin_users(admin=Depends(require_admin)):
    """ADMIN : tous les comptes avec leurs transactions."""
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT m.id, m.name, m.balance_cents, u.login, u.role, u.created_at "
            "FROM merchant_users u JOIN merchants m ON m.id = u.merchant_id "
            "ORDER BY u.id"
        )
        users = {}
        order = []
        for r in cur.fetchall():
            users[r[0]] = {
                "merchant_id": r[0], "shop_name": r[1], "balance_cents": r[2],
                "login": r[3], "role": r[4], "created_at": r[5].isoformat(),
                "transactions": [],
            }
            order.append(r[0])
        cur.execute(
            "SELECT merchant_id, id, amount_cents, status, created_at "
            "FROM transactions ORDER BY id DESC"
        )
        for r in cur.fetchall():
            if r[0] in users:
                users[r[0]]["transactions"].append(
                    {"id": r[1], "amount_cents": r[2], "status": r[3], "created_at": r[4].isoformat()}
                )
        cur.close()
        return [users[i] for i in order]
    finally:
        db.put_conn(conn)


@app.post("/incidents")
def create_incident(inc: IncidentIn, x_internal_token: str = Header(default=None)):
    if x_internal_token != config.INTERNAL_TOKEN:
        raise HTTPException(status_code=403, detail="Accès interne requis")
    conn = db.get_conn()
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO incidents (kind, detail) VALUES (%s, %s) RETURNING id", (inc.kind, inc.detail))
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
        cur.execute("SELECT id, kind, detail, status, created_at FROM incidents ORDER BY id DESC LIMIT 50")
        rows = cur.fetchall()
        cur.close()
        return [
            {"id": r[0], "kind": r[1], "detail": r[2], "status": r[3], "created_at": r[4].isoformat()}
            for r in rows
        ]
    finally:
        db.put_conn(conn)
