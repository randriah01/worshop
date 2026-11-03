"""Service privé : reconnaissance faciale + contrôle anti-spoofing expérimental.

Aucune décision d'authentification et aucun JWT ne sont produits ici.
Les résultats ne prouvent PAS la vivacité contre une caméra virtuelle ou une vidéo.
"""
import base64
import binascii
import os
import secrets

import cv2
import numpy as np
from deepface import DeepFace
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="NovaPay Face AI (internal)", docs_url=None, redoc_url=None)
MODEL = "Facenet512"
MAX_IMAGE_BYTES = 550_000

class Samples(BaseModel):
    images: list[str] = Field(min_length=3, max_length=3)


def decode_frame(raw: str):
    if not raw.startswith("data:image/jpeg;base64,") or len(raw) > 750_000:
        raise HTTPException(400, "Format d'image non pris en charge")
    try:
        data = base64.b64decode(raw.split(",", 1)[1], validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "Image invalide")
    if len(data) > MAX_IMAGE_BYTES or not data.startswith(b"\xff\xd8"):
        raise HTTPException(400, "Image trop volumineuse ou invalide")
    frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None or frame.ndim != 3 or frame.shape[0] < 160 or frame.shape[1] < 160:
        raise HTTPException(400, "Résolution insuffisante")
    if frame.shape[0] > 1920 or frame.shape[1] > 1920:
        raise HTTPException(400, "Résolution trop élevée")
    return frame


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL}


@app.post("/embeddings")
def embeddings(samples: Samples, x_internal_token: str | None = Header(default=None)):
    expected = os.getenv("FACE_INTERNAL_TOKEN", "")
    if not expected or not x_internal_token or not secrets.compare_digest(x_internal_token, expected):
        raise HTTPException(403, "Accès interdit")
    vectors = []
    for raw in samples.images:
        frame = decode_frame(raw)
        try:
            # Contrôle anti-présentation réel (modèle ML), PAS seulement un clignement d'yeux.
            faces = DeepFace.extract_faces(
                img_path=frame,
                detector_backend="opencv",
                enforce_detection=True,
                anti_spoofing=True,
            )
            if len(faces) != 1 or not bool(faces[0].get("is_real")):
                raise HTTPException(422, "Visage non vivant ou plusieurs visages")
            result = DeepFace.represent(
                img_path=frame,
                model_name=MODEL,
                detector_backend="opencv",
                enforce_detection=True,
            )
            if len(result) != 1:
                raise HTTPException(422, "Un seul visage est requis")
            v = np.asarray(result[0]["embedding"], dtype=np.float64)
            norm = np.linalg.norm(v)
            if not np.isfinite(v).all() or norm < 1e-10:
                raise HTTPException(422, "Signature faciale invalide")
            vectors.append(v / norm)
        except HTTPException:
            raise
        except Exception:
            # Ne divulgue pas d'information diagnostique biométrique au client.
            raise HTTPException(422, "Analyse faciale impossible")
    mean = np.mean(vectors, axis=0)
    mean_norm = np.linalg.norm(mean)
    if mean_norm < 1e-10:
        raise HTTPException(422, "Signature faciale invalide")
    # 3 prélèvements distincts : cohérence de l'identité dans toute la séquence.
    for v in vectors:
        if float(np.dot(v, mean / mean_norm)) < 0.80:
            raise HTTPException(422, "Visage incohérent entre les images")
    return {"model": MODEL, "embedding": (mean / mean_norm).tolist()}
