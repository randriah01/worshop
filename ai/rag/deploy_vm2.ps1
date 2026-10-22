# Déploiement de l'assistant RAG NovaPay sur la VM2 Windows (à côté d'Ollama).
# Lecture seule : l'assistant EXPLIQUE, il n'agit jamais.
# Pré-requis : Ollama déjà installé et lancé sur la VM2 (API locale 11434),
#              Python 3 et Git installés.
#
# Usage (PowerShell, depuis ai\rag) :  .\deploy_vm2.ps1
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot          # -> ai\rag\ du dépôt

Write-Host "== 1/4  Verif Ollama (API locale) =="
try {
    Invoke-RestMethod -Uri "http://localhost:11434/api/version" -TimeoutSec 5 | Out-Null
    Write-Host "  Ollama OK"
} catch {
    Write-Host "  !! Ollama injoignable sur localhost:11434 — demarre le service Ollama." -ForegroundColor Red
    exit 1
}

Write-Host "== 2/4  Modeles Ollama =="
ollama pull qwen2.5:3b
ollama pull nomic-embed-text

Write-Host "== 3/4  Environnement Python =="
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt

Write-Host "== 4/4  Construction de l'index documentaire =="
& .\.venv\Scripts\python.exe ingest.py

Write-Host ""
Write-Host "Deploiement termine." -ForegroundColor Green
Write-Host ""
Write-Host "Lancer l'API (lecture seule) :"
Write-Host '    .\.venv\Scripts\uvicorn.exe app:app --host 0.0.0.0 --port 8090'
Write-Host ""
Write-Host "Tester en ligne de commande :"
Write-Host '    .\.venv\Scripts\python.exe ask.py "Comment NovaPay se retablit-il apres une attaque ?"'
Write-Host ""
Write-Host "Interroger l'API :"
Write-Host '    curl.exe -s localhost:8090/ask -H "Content-Type: application/json" -d "{\"question\":\"Quelles attaques sont simulees ?\"}"'
