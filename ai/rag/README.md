# Assistant RAG NovaPay — Ollama + LangChain (lecture seule)

Pilier **IA** du projet RESILIENCE-ALPHA, côté *explication*. L'assistant répond
aux questions sur le projet en se fondant **uniquement** sur la documentation du
dépôt (READMEs, contrat IA-01, etc.). Il **n'a aucun droit d'action** : il
explique, il ne déclenche jamais de remédiation ni de commande. La décision
d'agir reste au détecteur ML + au contrôleur de reprise — **jamais au LLM**.

## Modèles (via Ollama)
- **LLM** : `qwen2.5:3b` (3 Mds de paramètres, bon en français, rapide sur le
  GPU 6 Go ; ≤ 8B comme l'exige le sujet). Repli : `llama3.2:3b`.
- **Embeddings** : `nomic-embed-text` (indexation documentaire).

Surcharge possible : `LLM_MODEL`, `EMBED_MODEL`, `OLLAMA_BASE_URL`
(variables d'environnement).

## Ollama : local ou distant (VM2 ESXi)
L'assistant parle à un serveur Ollama via son API HTTP (port `11434`). Deux cas :
- **Distant (recommandé ici)** — Ollama tourne sur la VM2. On pointe dessus :
  ```bash
  export OLLAMA_BASE_URL="http://<IP_VM2>:11434"   # PowerShell : $env:OLLAMA_BASE_URL="http://<IP_VM2>:11434"
  ```
  Côté VM2, Ollama doit écouter sur le réseau (et pas seulement `127.0.0.1`) :
  `OLLAMA_HOST=0.0.0.0:11434`, et le port 11434 ouvert vers le poste.
- **Local** — rien à configurer, défaut `http://127.0.0.1:11434`
  (on utilise `127.0.0.1` et non `localhost` pour éviter la résolution IPv6
  sous Windows, qui peut faire traîner/bloquer la connexion à Ollama).

## Prérequis Python
**`faiss-cpu` ne supporte pas encore Python ≥ 3.15.** Crée le venv avec
**Python 3.12** (`py -3.12 -m venv .venv`). Si besoin :
`winget install -e --id Python.Python.3.12`. Le script `deploy_vm2.ps1` le fait
automatiquement s'il détecte 3.12.

## Installation / déploiement sur la VM2
L'assistant est déployé **sur la VM2**, à côté d'Ollama (pas d'accès réseau à
sortir : il parle à Ollama en `127.0.0.1:11434`). Scripts clé en main :
- **VM2 Windows** : `.\deploy_vm2.ps1` (PowerShell)
- **Linux** : `bash deploy_vm2.sh`

Ils enchaînent : vérif Ollama → `ollama pull` des 2 modèles → venv + deps
Python → construction de l'index (`ingest.py`).

Étapes manuelles équivalentes :
```bash
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
pip install -r requirements.txt
python ingest.py
```

## Utilisation
```bash
# 1. Indexer la doc (crée ai/rag/index/)
python ingest.py

# 2a. Test rapide en ligne de commande
python ask.py "Comment NovaPay se rétablit-il après une attaque ?"

# 2b. ou lancer l'API
uvicorn app:app --host 0.0.0.0 --port 8090
curl -s localhost:8090/ask -H "Content-Type: application/json" \
     -d '{"question":"Quelles attaques sont simulées et comment sont-elles bloquées ?"}'
```

## Garde-fous (conformes au sujet)
- **Lecture seule** : aucune action, aucun accès à Docker/Ansible/ESXi.
- **Ancré (grounded)** : répond d'après le contexte récupéré ; dit « ce n'est pas
  dans la doc » plutôt que d'inventer.
- Modèle **local** (Ollama), ≤ 8B, aucune donnée envoyée à l'extérieur.
