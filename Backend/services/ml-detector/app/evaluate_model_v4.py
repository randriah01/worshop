"""Offline false-positive evaluation on held-out normal sessions. No automatic tuning or promotion."""
import argparse,csv,json
import joblib
from ml_features_v4 import FEATURES

def evaluate(model_path,validation_path):
    # Only load the local joblib just created by train_model_v4.py.
    p=joblib.load(model_path)
    if tuple(p.get('features',()))!=FEATURES or not p.get('candidate_only'):
        raise ValueError('Le modèle n’est pas un candidat V4 local')
    with open(validation_path,newline='',encoding='utf-8-sig') as f:
        rows=list(csv.DictReader(f))
    if not rows: raise ValueError('Validation vide')
    x=[[float(r[k]) for k in FEATURES] for r in rows]
    prediction=p['model'].predict(x);n=sum(int(y==-1) for y in prediction)
    return {'model_version':p['version'],'validation_windows':len(rows),
        'anomaly_windows_on_normal':n,'normal_false_positive_pct':round(100*n/len(rows),2),
        'note':'Les fenêtres peuvent être corrélées; valider sur plusieurs sessions et attaques contrôlées. Non qualifié pour action.'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--model',required=True);p.add_argument('--validation',required=True);a=p.parse_args()
    print(json.dumps(evaluate(a.model,a.validation),indent=2,ensure_ascii=False))
