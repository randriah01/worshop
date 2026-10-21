"""Ingestion des alertes ML, avec authentification et historique idempotent.

Le ML n'ordonne aucune remédiation. Ce module ne fait que consigner une
suspicion d'anomalie pour la corrélation par le contrôleur SOAR.
"""
import logging
import secrets
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from psycopg2.extras import Json

from . import config, db

logger = logging.getLogger("payment-api.ml")
router = APIRouter(tags=["ml-incidents"])


class MLAlert(BaseModel):
    source_event_id: str = Field(min_length=1, max_length=120)
    data_origin: Literal["prometheus", "synthetic"] = "prometheus"
    service: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{0,63}$")
    observed_at: datetime
    model_version: str = Field(min_length=1, max_length=120)
    anomaly_score: float
    evidence: dict[str, float] = Field(default_factory=dict)
    recommendation: str = Field(default="CORRELATE_WITH_WAF_AND_BUSINESS_CHECKS", max_length=180)

    @field_validator("anomaly_score")
    @classmethod
    def finite_score(cls, value):
        import math
        if not math.isfinite(value):
            raise ValueError("score doit être fini")
        return value

    @field_validator("evidence")
    @classmethod
    def finite_evidence(cls, value):
        import math
        if len(value) > 20 or not all(math.isfinite(v) for v in value.values()):
            raise ValueError("evidence: max 20 métriques finies")
        return value


def require_internal_token(token: str | None):
    expected = config.INTERNAL_TOKEN
    if not token or not expected or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=403, detail="Accès interne requis")


@router.post("/internal/ml-alerts", status_code=200)
def ingest_ml_alert(
    alert: MLAlert,
    x_internal_token: Annotated[str | None, Header()] = None,
):
    """Un incident 'open' par service, plusieurs événements; replay sans doublon."""
    require_internal_token(x_internal_token)
    dedup_key = f"ml:{alert.data_origin}:{alert.service}:performance"
    is_test = alert.data_origin == "synthetic"
    details = {
        "source_event_id": alert.source_event_id,
        "data_origin": alert.data_origin,
        "model_version": alert.model_version,
        "anomaly_score": alert.anomaly_score,
        "evidence": alert.evidence,
        "recommendation": alert.recommendation,
        "observed_at": alert.observed_at.isoformat(),
        "classification": "SYNTHETIC_TEST" if is_test else "ML_INDICATIVE_UNCONFIRMED",
    }
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            # Sérialise les requêtes concurrentes correspondant au même incident.
            cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (dedup_key,))
            cur.execute(
                "SELECT incident_id FROM incident_events WHERE event_key = %s",
                (alert.source_event_id,),
            )
            previous = cur.fetchone()
            if previous:
                incident_id = previous[0]
                cur.execute(
                    "SELECT observation_count, status FROM incidents WHERE id=%s", (incident_id,)
                )
                count_row = cur.fetchone()
                conn.commit()
                return {"id": incident_id, "status": count_row[1] if count_row else None,
                        "duplicate": True,
                        "observation_count": count_row[0] if count_row else None}

            cur.execute(
                """
                INSERT INTO incidents
                  (kind, detail, status, source, service, severity, anomaly_score,
                   model_version, evidence, last_observed_at, dedup_key, observation_count)
                VALUES
                  (%s, %s, 'open', %s, %s, %s, %s, %s, %s, %s, %s, 1)
                ON CONFLICT (dedup_key)
                  WHERE status = 'open' AND dedup_key IS NOT NULL
                DO UPDATE SET
                  last_observed_at = EXCLUDED.last_observed_at,
                  anomaly_score = EXCLUDED.anomaly_score,
                  model_version = EXCLUDED.model_version,
                  evidence = EXCLUDED.evidence,
                  observation_count = incidents.observation_count + 1
                RETURNING id, observation_count
                """,
                ("ml_test" if is_test else "ml_anomaly",
                 "Test synthétique ML — aucune attaque réelle" if is_test else
                 "Anomalie ML indicative, à corréler avec le WAF et le service",
                 "ml-test" if is_test else "ml-detector",
                 alert.service, "info" if is_test else "warning",
                 alert.anomaly_score, alert.model_version,
                 Json(alert.evidence), alert.observed_at, dedup_key),
            )
            incident_id, observations = cur.fetchone()
            cur.execute(
                """
                INSERT INTO incident_events
                  (incident_id, event_key, event_type, actor, event_data, occurred_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (incident_id, alert.source_event_id,
                 "ml_synthetic_test" if is_test else "ml_anomaly_observed",
                 "ml-test" if is_test else "ml-detector",
                 Json(details), alert.observed_at),
            )
        conn.commit()
        return {"id": incident_id, "status": "open", "duplicate": False,
                "observation_count": observations}
    except Exception:
        conn.rollback()
        logger.exception("Échec d'enregistrement de l'alerte ML")
        raise HTTPException(status_code=500, detail="Impossible d'enregistrer l'alerte")
    finally:
        db.put_conn(conn)


@router.get("/internal/incidents/{incident_id}/events")
def get_incident_events(
    incident_id: int,
    x_internal_token: Annotated[str | None, Header()] = None,
):
    require_internal_token(x_internal_token)
    conn = db.get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, event_type, actor, event_data, occurred_at
                FROM incident_events WHERE incident_id=%s
                ORDER BY occurred_at ASC, id ASC LIMIT 500
                """, (incident_id,),
            )
            rows = cur.fetchall()
        return [{"id": r[0], "event_type": r[1], "actor": r[2],
                 "event_data": r[3], "occurred_at": r[4].isoformat()} for r in rows]
    finally:
        db.put_conn(conn)
