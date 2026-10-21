"""Service d'analyse (lecture seule, sans droits d'administration)."""
from datetime import datetime, timezone
from functools import lru_cache
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from .model import DEFAULT_MODEL_FILE, FEATURES, detect, load_model
from .schemas import MetricsWindow, AnomalyResponse

app = FastAPI(title="Resilience Alpha - AIOps Detector", version="0.1.0")


@lru_cache(maxsize=1)
def model_artifact():
    return load_model(DEFAULT_MODEL_FILE)


@app.get("/health")
def health():
    return {"service": "anomaly-detector", "alive": True}


@app.get("/ready")
def ready():
    if not DEFAULT_MODEL_FILE.is_file():
        raise HTTPException(status_code=503, detail="Modèle non entraîné : exécuter scripts/train.py")
    try:
        model_artifact()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Modèle indisponible ou incompatible") from exc
    return {"ready": True, "model_version": model_artifact()["version"]}


@app.post("/v1/detect", response_model=AnomalyResponse)
def predict(window: MetricsWindow):
    if not DEFAULT_MODEL_FILE.is_file():
        raise HTTPException(status_code=503, detail="Modèle non entraîné")
    try:
        artifact = model_artifact()
        is_anomaly, score = detect(artifact, window.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Modèle indisponible ou incompatible") from exc
    evidence = {name: float(getattr(window, name)) for name in FEATURES}
    return AnomalyResponse(
        incident_id=f"INC-{uuid4().hex[:12].upper()}",
        timestamp=datetime.now(timezone.utc),
        service=window.service,
        anomaly_detected=is_anomaly,
        anomaly_score=round(score, 6),
        model_version=artifact["version"],
        recommendation="CORRELATE_WITH_WAF_AND_BUSINESS_CHECKS" if is_anomaly else "NO_ACTION",
        evidence=evidence,
        note="Détection ML indicative, pas un ordre de remédiation ; aucun privilège système accordé.",
    )
