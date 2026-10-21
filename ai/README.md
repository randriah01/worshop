# IA NovaPay - Detection Isolation Forest

Dossier à copier directement à la racine du dépôt `worshop/`, à côté de `Backend/`, `Frontend/`, `cyber/`.

**Ce qui est inclus**
- `src/anomaly_detector/` : API FastAPI `/ready`, `/v1/detect` et modèle Isolation Forest.
- `scripts/prometheus_bridge.py` : requêtes Prometheus NovaPay et appel au détecteur.
- `scripts/train_novapay_real.py` : entraînement sur le CSV NovaPay fourni, **sans données synthétiques**.
- `scripts/collect_baseline.py` : collecte de fenêtres normales dans un CSV.
- `data/novapay_normal_train_combined.csv` : 129 fenêtres mesurées sur NovaPay (baseline préliminaire).
- `tests/` et `examples/` : tests et exemples, dont tests synthétiques unitaires.

**Attention** : le ZIP ne contient volontairement pas le modèle `.joblib`. Il est régénéré à partir des données versionnées. Ne jamais charger de modèle joblib/pickle provenant d'une source non fiable.

## 1. Sur le Mac : push dans le dépôt Git de l'équipe

Copier le dossier `ai/` **au niveau de `Backend/` dans le même dépôt Git** (pas à l'intérieur de `Backend/`).

Depuis la racine du dépôt local :

```bash
git status --short
git add ai/
git commit -m "feat(ai): add NovaPay anomaly detector"
git push
```

Vérifier les changements avant de les committer. Ne pousser aucun `.env`, mot de passe, token, `.venv` ou fichier `.joblib`.

## 2. Sur la VM Ubuntu ESXi : recuperer et entrainer

```bash
cd ~/worshop
git pull --ff-only
cd ai
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/train_novapay_real.py
```

Le fichier `models/isolation_forest_novapay_poc.joblib` est créé localement sur la VM.
Le modèle retourne la version `iforest-novapay-normal-v0`.

## 3. Verifier les tests de code (optionnel)

```bash
PYTHONPATH=src python -m pytest -q
```

Les tests unitaires génèrent des données synthétiques uniquement pour leurs scénarios de test.
Cela ne change pas le modèle réel créé précédemment.

## 4. Service IA et connexion a Prometheus

Terminal A (depuis `~/worshop/ai`, venv activé) :

```bash
MODEL_PATH=models/isolation_forest_novapay_poc.joblib PYTHONPATH=src python -m uvicorn anomaly_detector.api:app --host 127.0.0.1 --port 8008
```

Terminal B (depuis `~/worshop/ai`, venv activé) :

```bash
curl -s http://127.0.0.1:8008/ready
python scripts/prometheus_bridge.py --cpu-cores 1 --features-only
python scripts/prometheus_bridge.py --cpu-cores 1
```

Attendu : `/ready` répond `iforest-novapay-normal-v0`, et le bridge affiche `FEATURES` puis `DETECTION` **si des transactions `/transactions` récentes ont été observées**.

Pour la première intégration, `--cpu-cores 1` reproduit le paramétrage initial ; à confirmer avec l'infra avant une validation. Les fenêtres sont actuellement de 60 s : à trafic nul la P95 peut être NaN et le bridge refuse correctement de prédire. Ne pas considérer l'absence de mesure comme une preuve d'attaque.

Le détecteur n'effectue **aucune remédiation**. Il ne reçoit aucun privilège de gestion Docker ou SSH. Lors de tests d'attaque, limiter le trafic à votre environnement autorisé.

## Étape suivante

Garder le modèle comme référence, puis mesurer ses alertes sur un **jeu normal indépendant** et sur une attaque de labo contrôlée avec horaires debut/fin. La collecte et le score ne constituent pas encore une chaîne de reprise automatique.
