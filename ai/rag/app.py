"""Assistant RAG NovaPay — API FastAPI (lecture seule).

Rôle (pilier IA du sujet) : EXPLIQUER. L'assistant répond aux questions sur le
projet en se fondant uniquement sur la documentation indexée (ingest.py). Il
n'a AUCUN droit d'action : il ne déclenche jamais de remédiation ni de commande.
La décision d'agir reste au détecteur ML + au contrôleur, jamais au LLM.

Lancer :
    uvicorn app:app --host 0.0.0.0 --port 8090
Puis :
    curl -s localhost:8090/ask -H "Content-Type: application/json" \
         -d '{"question":"Comment se fait la reprise automatique ?"}'
"""
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings, ChatOllama

INDEX_DIR = Path(__file__).parent / "index"
LLM_MODEL = os.environ.get("LLM_MODEL", "qwen2.5:3b")
EMB_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")
# Ollama distant (VM2 ESXi) ou local ; surcharge via OLLAMA_BASE_URL.
# 127.0.0.1 (et non localhost) pour éviter la résolution IPv6 sous Windows.
OLLAMA_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

SYSTEM = (
    "Tu es l'assistant documentaire du projet NovaPay / RESILIENCE-ALPHA. "
    "Tu EXPLIQUES uniquement, en français, clairement et brièvement, à partir du "
    "CONTEXTE fourni. Tu n'as AUCUN droit d'action : tu ne proposes jamais "
    "d'exécuter de commande ni de déclencher une remédiation. "
    "Si l'information n'est pas dans le contexte, dis-le honnêtement au lieu d'inventer."
)

app = FastAPI(title="NovaPay — Assistant RAG (lecture seule)")

_embeddings = OllamaEmbeddings(model=EMB_MODEL, base_url=OLLAMA_URL)
_llm = ChatOllama(model=LLM_MODEL, temperature=0.1, base_url=OLLAMA_URL)
_store = None


def _get_store() -> FAISS:
    global _store
    if _store is None:
        if not (INDEX_DIR / "index.faiss").exists():
            raise HTTPException(503, "Index absent. Lance d'abord : python ingest.py")
        _store = FAISS.load_local(
            str(INDEX_DIR), _embeddings, allow_dangerous_deserialization=True
        )
    return _store


class Question(BaseModel):
    question: str = Field(..., min_length=3)
    k: int = Field(4, ge=1, le=8)


@app.get("/health")
def health():
    return {"status": "ok", "llm": LLM_MODEL, "embed": EMB_MODEL,
            "ollama": OLLAMA_URL, "index": (INDEX_DIR / "index.faiss").exists()}


@app.post("/ask")
def ask(q: Question):
    hits = _get_store().similarity_search(q.question, k=q.k)
    context = "\n\n".join(
        f"[source: {d.metadata.get('source', '?')}]\n{d.page_content}" for d in hits
    )
    prompt = (
        f"CONTEXTE (documentation du projet) :\n{context}\n\n"
        f"QUESTION : {q.question}\n\n"
        "Réponds en français, uniquement d'après le contexte ci-dessus."
    )
    answer = _llm.invoke([("system", SYSTEM), ("human", prompt)]).content
    sources = sorted({d.metadata.get("source", "?") for d in hits})
    return {"answer": answer, "sources": sources}
