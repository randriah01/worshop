#!/usr/bin/env python3
"""Entraînement POC sur mesures réelles NovaPay. Aucune métrique synthétique.
À placer dans scripts/train_novapay_real.py du projet AIOps.
"""
from pathlib import Path
import sys
import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT / "src"))
from anomaly_detector.model import train, FEATURES

input_file = ROOT / "data/novapay_normal_train_combined.csv"
output_file = ROOT / "models/isolation_forest_novapay_poc.joblib"
if not input_file.exists():
    raise SystemExit(f"Données absentes : {input_file}")
df = pd.read_csv(input_file)
if len(df) < 100:
    raise SystemExit(f"Il faut au moins 100 fenêtres pour ce prototype; reçu : {len(df)}")
if df[list(FEATURES)].isna().any().any():
    raise SystemExit("Valeurs manquantes : nettoyer le dataset")
train(df, output_file)
artifact = joblib.load(output_file)
artifact["version"] = "iforest-novapay-normal-v0"
joblib.dump(artifact, output_file)
training_anomaly_rate = float((artifact["pipeline"].predict(df[list(FEATURES)]) == -1).mean())
print(f"Modèle POC : {output_file}")
print(f"Entraînement sur {len(df)} observations NovaPay, 0 synthétiques")
print(f"Anomalies sur données D'ENTRAÎNEMENT : {training_anomaly_rate:.1%}")
print("ATTENTION : ce taux n'est pas un taux de faux positifs évalué hors entraînement.")
print("Il faut une session normale indépendante + des perturbations autorisées pour évaluer le modèle.")
print("Pour tester le modèle POC, redémarrer l'API en définissant MODEL_PATH.")
