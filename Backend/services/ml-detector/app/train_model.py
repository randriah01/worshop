"""Entraînement OFFLINE Isolation Forest depuis une baseline CSV vérifiée.

Ne jamais lancer sur des mesures d'attaque ou des données non approuvées.
"""
import argparse
import csv
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import joblib
import sklearn
from sklearn.ensemble import IsolationForest
from ml_core import FEATURES


def train(csv_path: str, model_path: str, min_samples: int = 60):
    path = Path(csv_path)
    content = path.read_bytes()
    with path.open(newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if not set(FEATURES).issubset(reader.fieldnames or []):
            raise ValueError('CSV attendu : rate,err_ratio,db_up')
        rows = []
        for idx, row in enumerate(reader, 2):
            values = [float(row[key]) for key in FEATURES]
            rate, error, db_up = values
            if not all(map(math.isfinite, values)) or rate < 0 or not 0 <= error <= .05 or db_up != 1:
                raise ValueError(f'Baseline non saine à la ligne {idx} : arrêter et analyser')
            rows.append(values)
    if len(rows) < min_samples:
        raise ValueError(f'Baseline insuffisante : {len(rows)}/{min_samples} fenêtres')
    if len({round(row[0], 5) for row in rows}) < 4:
        raise ValueError('Trafic de référence trop uniforme : générer des opérations légitimes variées')
    model = IsolationForest(n_estimators=150, contamination=0.05,
                            max_samples=min(256, len(rows)), random_state=42)
    model.fit(rows)
    digest = hashlib.sha256(content).hexdigest()
    payload = {
        'model': model,
        'features': FEATURES,
        'version': f'iforest-{digest[:12]}',
        'baseline_sha256': digest,
        'baseline_rows': len(rows),
        'trained_utc': datetime.now(timezone.utc).isoformat(),
        'sklearn_version': sklearn.__version__,
        'contamination': 0.05,
    }
    output = Path(model_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(payload, output)
    return {k: value for k, value in payload.items() if k != 'model'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', default='/tmp/novapay_iforest.joblib')
    parser.add_argument('--min-samples', type=int, default=60)
    args = parser.parse_args()
    print(json.dumps(train(args.input, args.output, args.min_samples), ensure_ascii=False, indent=2))
