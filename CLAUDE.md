Project context for Claude Code. Read this before making changes.
What this is
A retrieval-augmented chatbot over my NYU Stern MSBAi coursework. It ingests lecture slides, notes, problem sets, and readings, embeds them locally, and answers questions with citations back to the source file and page/slide.
Goal: a study/reference assistant that runs entirely on my machine. No course material leaves the laptop.
Stack

* Python 3.11+, deps managed with `uv` (fall back to `pip` only if asked).
* FastAPI backend exposing `/chat`, `/ingest`, `/health`.
* Ollama for both generation and embeddings, running locally.
   * Generation: `qwen2.5:7b` (default) — fits in 8 GB VRAM.
   * Embeddings: `nomic-embed-text`.
* ChromaDB as the vector store, persisted to `./data/chroma/`.
* Optional frontend: Vite + React (`/frontend`), talks to the API over HTTP.
* Docker Compose wires Ollama + the API together for reproducible runs.
If a change would swap any of these, ask first — don't silently introduce a new vector store, embedding model, or framework.
Hardware constraints
This runs on an RTX 5060 laptop: 8 GB VRAM, 32 GB system RAM. This is a hard limit, not a suggestion.

* Don't propose models above ~7B at q4 for generation, or anything that won't fit alongside the embedding model.
* Keep batch sizes for embedding modest; prefer streaming ingestion over loading every document into memory at once.
* If a feature needs a bigger model, flag the VRAM cost rather than assuming a cloud fallback.
Repo layout

```
.
├── app/
│   ├── main.py            # FastAPI app + routes
│   ├── ingest.py          # loaders, chunking, embedding, upsert
│   ├── retrieve.py        # query -> top-k chunks
│   ├── chat.py            # prompt assembly, Ollama call, citation formatting
│   ├── loaders/           # per-filetype extractors (pdf, pptx, docx, md)
│   └── config.py          # all tunables (model names, chunk size, top_k)
├── data/
│   ├── source/            # raw MSBAi files (gitignored)
│   └── chroma/            # persisted vector store (gitignored)
├── frontend/              # Vite + React chat UI (optional)
├── docker-compose.yml
└── pyproject.toml

```

Common commands

```bash
# Install deps
uv sync

# Pull required models (one-time)
ollama pull qwen2.5:7b
ollama pull nomic-embed-text

# Ingest everything in data/source/
uv run python -m app.ingest --path data/source

# Run the API (dev)
uv run uvicorn app.main:app --reload --port 8000

# Full stack via Docker
docker compose up --build

# Frontend dev server
cd frontend && npm run dev

```

RAG conventions

* Chunking: ~800-token chunks with ~100-token overlap. Slides chunk per slide; PDFs/notes chunk by token window with overlap. Keep chunk size in `config.py`, never hardcode it across files.
* Metadata: every chunk stores `source_file`, `page_or_slide`, `course`, and `chunk_index`. Retrieval and citations depend on these — don't drop them.
* Citations are required: answers must point to the source file and page/slide. If retrieval returns nothing relevant, the model should say it doesn't have that in the materials rather than guessing.
* Prompt: keep the system prompt in one place (`chat.py`). It instructs the model to answer only from retrieved context and to cite. Don't scatter prompt fragments.
* top_k defaults to 5; it's a config value, not a magic number.
Data handling

* Course files in `data/source/` and the `data/chroma/` store are gitignored and must stay that way. Never commit course material or embeddings.
* Don't upload, fetch, or transmit any file under `data/` to an external service. Embeddings and generation are local via Ollama by design.
* Treat the MSBAi content as private — no copying excerpts into commit messages, issues, or logs beyond what's needed to debug.
Code style

* Type hints on public functions; keep modules small and single-purpose.
* Config over constants — new tunables go in `config.py`.
* Prefer readable, plain code over clever abstractions; this is a personal project I'll come back to between classes.
* Write functions so ingestion of a new filetype means adding one loader in `app/loaders/`, not editing the pipeline.
When working here

* Run the API locally and hit `/health` before assuming Ollama is reachable.
* After changing chunking or the embedding model, the store must be re-ingested from scratch — old vectors won't match new ones. Call this out when relevant.
* Don't add telemetry, analytics, or any outbound network calls.
* Keep dependencies lean; justify any new package.
