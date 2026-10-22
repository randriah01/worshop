"""Test en ligne de commande de l'assistant RAG (sans lancer l'API).

Usage :
    python ask.py "Comment NovaPay se rétablit-il après une attaque ?"
"""
import os
import sys
from pathlib import Path

from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings, ChatOllama

INDEX_DIR = Path(__file__).parent / "index"
LLM_MODEL = os.environ.get("LLM_MODEL", "qwen2.5:3b")
EMB_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")
OLLAMA_URL = os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434")

SYSTEM = (
    "Tu es l'assistant documentaire du projet NovaPay / RESILIENCE-ALPHA. "
    "Tu EXPLIQUES uniquement, en français, à partir du CONTEXTE fourni, sans "
    "aucun droit d'action. Si l'info n'y est pas, dis-le."
)


def main() -> None:
    question = " ".join(sys.argv[1:]).strip() or "De quoi parle ce projet ?"
    embeddings = OllamaEmbeddings(model=EMB_MODEL, base_url=OLLAMA_URL)
    store = FAISS.load_local(str(INDEX_DIR), embeddings, allow_dangerous_deserialization=True)
    hits = store.similarity_search(question, k=4)
    context = "\n\n".join(f"[{d.metadata.get('source')}]\n{d.page_content}" for d in hits)
    llm = ChatOllama(model=LLM_MODEL, temperature=0.1, base_url=OLLAMA_URL)
    answer = llm.invoke([
        ("system", SYSTEM),
        ("human", f"CONTEXTE :\n{context}\n\nQUESTION : {question}\n\nRéponds d'après le contexte."),
    ]).content
    print("\n=== RÉPONSE ===\n" + answer)
    print("\n=== SOURCES ===")
    for s in sorted({d.metadata.get("source") for d in hits}):
        print("  •", s)


if __name__ == "__main__":
    main()
