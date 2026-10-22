# Deploiement de l'assistant RAG NovaPay sur la VM2 Windows (a cote d'Ollama).
# Lecture seule : l'assistant EXPLIQUE, il n'agit jamais.
# Pre-requis : Ollama installe et lance (API locale 11434), Python installe.
#
# Note : faiss-cpu ne supporte pas Python >= 3.15 ; le script cree donc le venv
# avec Python 3.12 si disponible (py -3.12), sinon le "python" par defaut.
#
# Usage (PowerShell, depuis ai\rag) :
#   powershell -ExecutionPolicy Bypass -File .\deploy_vm2.ps1
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "== 1/4  Verif Ollama (API locale 127.0.0.1:11434) =="
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/version" -TimeoutSec 5 | Out-Null
    Write-Host "  Ollama OK"
} catch {
    Write-Host "  !! Ollama injoignable sur 127.0.0.1:11434 - demarre le service Ollama." -ForegroundColor Red
    exit 1
}

Write-Host "== 2/4  Modeles Ollama =="
ollama pull qwen2.5:3b
ollama pull nomic-embed-text

Write-Host "== 3/4  Environnement Python (venv) =="
$usePy312 = $false
if (Get-Command py -ErrorAction SilentlyContinue) {
    if ((& py --list) -match '3\.12') { $usePy312 = $true }
}
if ($usePy312) {
    Write-Host "  Python 3.12 detecte -> creation du venv avec py -3.12"
    py -3.12 -m venv .venv
} else {
    Write-Host "  Python 3.12 non detecte -> utilisation du python par defaut"
    Write-Host "  (si faiss-cpu echoue, installe Python 3.12 : winget install -e --id Python.Python.3.12)"
    python -m venv .venv
}
$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
& $py -m pip install --upgrade pip
& $py -m pip install -r requirements.txt

Write-Host "== 4/4  Construction de l'index documentaire =="
& $py ingest.py

Write-Host ""
Write-Host "Deploiement termine." -ForegroundColor Green
Write-Host ""
Write-Host "Tester en ligne de commande :"
Write-Host '    .\.venv\Scripts\python.exe ask.py "Comment NovaPay se retablit-il apres une attaque ?"'
Write-Host ""
Write-Host "Lancer l'API (lecture seule) :"
Write-Host '    .\.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8090'
