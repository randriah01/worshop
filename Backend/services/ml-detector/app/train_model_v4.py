"""Offline candidate training. V3 remains active; this script never publishes incidents."""
import argparse,csv,hashlib,json,math
from datetime import datetime,timezone
from pathlib import Path
import joblib,sklearn
from sklearn.ensemble import IsolationForest
from ml_features_v4 import FEATURES

def read_rows(path):
    with Path(path).open(newline='',encoding='utf-8-sig') as f:
        reader=csv.DictReader(f)
        if not set(FEATURES).issubset(reader.fieldnames or []): raise ValueError('Colonnes V4 manquantes')
        rows=[]
        for i,row in enumerate(reader,2):
            vals=[float(row[k]) for k in FEATURES]
            if not all(math.isfinite(v) and v>=0 for v in vals): raise ValueError(f'Non fini ou négatif, ligne {i}')
            rate,er,lat,pay,per,db=vals
            if er>1 or per>1 or db not in (0,1): raise ValueError(f'Ratio/DB invalide, ligne {i}')
            rows.append(vals)
    return rows

def train(csvpath,output):
    data=Path(csvpath).read_bytes();rows=read_rows(csvpath)
    if len(rows)<100: raise ValueError('100 fenêtres normales minimum')
    if any(r[5]!=1 or r[1]>0.05 or r[4]>0 for r in rows):
        raise ValueError('Baseline non saine: DB down, >5% de 5xx ou erreur métier')
    if len({round(r[0],2) for r in rows})<4: raise ValueError('Variété insuffisante de débit API')
    # No assumption that 2% contamination guarantees 2% false positives.
    model=IsolationForest(n_estimators=200,contamination=0.02,max_samples=min(256,len(rows)),random_state=42)
    model.fit(rows)
    digest=hashlib.sha256(data).hexdigest()
    p={'model':model,'features':FEATURES,'version':f'iforest-v4-{digest[:12]}',
       'baseline_sha256':digest,'baseline_rows':len(rows),'trained_utc':datetime.now(timezone.utc).isoformat(),
       'sklearn_version':sklearn.__version__,'contamination':.02,'candidate_only':True}
    out=Path(output);out.parent.mkdir(parents=True,exist_ok=True);joblib.dump(p,out)
    return {k:v for k,v in p.items() if k!='model'}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--output',default='/tmp/novapay_iforest_v4_candidate.joblib');a=p.parse_args()
    print(json.dumps(train(a.input,a.output),indent=2,ensure_ascii=False))
