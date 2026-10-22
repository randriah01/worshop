"""Indexation documentaire de l'assistant RAG NovaPay.

Lit la documentation Markdown du dépôt, la découpe en passages, calcule des
embeddings via Ollama (nomic-embed-text) et construit un index vectoriel FAISS
sauvegardé sur disque. L'assistant (app.py) s'en sert pour répondre en se
fondant UNIQUEMENT sur ces documents.

Usage :
    python ingest.py
"""
import os
from pathlib import Path

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings

REPO = Path(__file__).resolve().parents[2]          # racine du dépôt
INDEX_DIR = Path(__file__).parent / "index"
EMB_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")
# Ollama distant (VM2 ESXi) ou local ; surcharge via OLLAMA_BASE_URL.
OLLAMA_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")

# Documentation du projet à indexer (la connaissance de l'assistant).
DOC_GLOBS = [
    "README.md",
    "ai/**/*.md",
    "Backend/**/*.md",
    "Frontend/README.md",
]


def load_docs() -> list[Document]:
    docs, seen = [], set()
    for pattern in DOC_GLOBS:
        for path in REPO.glob(pattern):
            if path.is_file() and path.suffix == ".md" and path not in seen:
                seen.add(path)
                text = path.read_text(encoding="utf-8", errors="ignore").strip()
                if not text:
                    continue
                rel = path.relative_to(REPO).as_posix()
                docs.append(Document(page_content=text, metadata={"source": rel}))
    return docs


def main() -> None:
    docs = load_docs()
    if not docs:
        raise SystemExit("Aucun document Markdown trouvé à indexer.")
    splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=120)
    chunks = splitter.split_documents(docs)

    print(f"Embeddings via Ollama ({EMB_MODEL} @ {OLLAMA_URL}) sur {len(chunks)} passages…")
    embeddings = OllamaEmbeddings(model=EMB_MODEL, base_url=OLLAMA_URL)
    store = FAISS.from_documents(chunks, embeddings)

    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    store.save_local(str(INDEX_DIR))
    print(f"OK — {len(docs)} documents, {len(chunks)} passages indexés → {INDEX_DIR}")
    for d in docs:
        print("  •", d.metadata["source"])


if __name__ == "__main__":
    main()
