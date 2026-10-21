"""Apprentissage sur trafic normal uniquement, inférence sur fenêtres de métriques."""
import os
from pathlib import Path
import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

FEATURES = (
    "requests_per_second",
    "error_rate",
    "latency_p95_ms",
    "cpu_usage_percent",
)
DEFAULT_MODEL_FILE = Path(os.environ.get("MODEL_PATH", "models/isolation_forest.joblib"))
MODEL_VERSION = "iforest-ia01-v1"


def select_features(frame: pd.DataFrame) -> pd.DataFrame:
    missing = [col for col in FEATURES if col not in frame.columns]
    if missing:
        raise ValueError(f"Features absentes : {missing}")
    chosen = frame.loc[:, list(FEATURES)].astype(float)
    if chosen.isna().any().any():
        raise ValueError("Les métriques doivent être renseignées")
    if (chosen["error_rate"] < 0).any() or (chosen["error_rate"] > 1).any():
        raise ValueError("error_rate doit être entre 0 et 1")
    if (chosen["cpu_usage_percent"] < 0).any() or (chosen["cpu_usage_percent"] > 100).any():
        raise ValueError("cpu_usage_percent doit être entre 0 et 100")
    for name in ("requests_per_second", "latency_p95_ms"):
        if (chosen[name] < 0).any():
            raise ValueError(f"{name} ne peut être négatif")
    return chosen


def train(frame: pd.DataFrame, output: Path = DEFAULT_MODEL_FILE):
    features = select_features(frame)
    if len(features) < 100:
        raise ValueError("Au moins 100 fenêtres normales sont nécessaires pour ce prototype")
    pipeline = Pipeline([
        ("scale", StandardScaler()),
        ("iforest", IsolationForest(n_estimators=200, contamination=0.03, random_state=42)),
    ])
    pipeline.fit(features)
    output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": pipeline, "version": MODEL_VERSION, "features": FEATURES}, output)
    return pipeline


def load_model(path: Path = DEFAULT_MODEL_FILE):
    # Ne charger que des artefacts produits par notre projet : joblib repose sur pickle.
    artifact = joblib.load(path)
    if tuple(artifact.get("features", ())) != FEATURES:
        raise ValueError("Incompatibilité de schéma entre modèle et données")
    return artifact


def detect(artifact: dict, window: dict) -> tuple[bool, float]:
    frame = select_features(pd.DataFrame([window]))
    # decision_function < 0 signifie anomalie, ce n'est PAS une probabilité.
    score = float(artifact["pipeline"].decision_function(frame)[0])
    return score < 0, score
