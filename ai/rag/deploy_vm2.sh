#!/usr/bin/env bash
# Déploiement de l'assistant RAG NovaPay sur la VM2 (à côté d'Ollama).
# Lecture seule : l'assistant EXPLIQUE, il n'agit jamais.
# Pré-requis : Ollama déjà installé et lancé sur la VM2 (API locale 11434).
#
# Usage :  bash deploy_vm2.sh
set -euo pipefail

cd "$(dirname "$0")"                       # -> ai/rag/ du dépôt

echo "== 1/4  Vérif Ollama (API locale) =="
curl -sf http://localhost:11434/api/version \
  && echo "  Ollama OK" \
  || { echo "  !! Ollama injoignable sur localhost:11434 — démarre le service Ollama."; exit 1; }

echo "== 2/4  Modèles Ollama =="
ollama pull qwen2.5:3b
ollama pull nomic-embed-text

echo "== 3/4  Environnement Python =="
python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "== 4/4  Construction de l'index documentaire =="
python ingest.py

cat <<'EOF'

Déploiement terminé.

Lancer l'API (lecture seule) :
    source .venv/bin/activate
    uvicorn app:app --host 0.0.0.0 --port 8090

Tester en ligne de commande :
    python ask.py "Comment NovaPay se rétablit-il après une attaque ?"

Interroger l'API :
    curl -s localhost:8090/ask -H "Content-Type: application/json" \
         -d '{"question":"Quelles attaques sont simulées et comment sont-elles bloquées ?"}'
EOF
