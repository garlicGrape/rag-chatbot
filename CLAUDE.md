Project context for Claude Code. Read this before making changes.
What this is
A retrieval-augmented chatbot over my NYU Stern MSBAi coursework, deployed online and embedded into my portfolio site (sanchitk.dev). Visitors (and I) can ask questions about the material and get answers with citations back to the source file and page/slide.
Two distinct phases — keep them separate:

* Ingestion (offline, run by me): parse coursework files, chunk, embed, and upsert into the vector store. Runs on my machine or in CI, not at request time.
* Serving (runtime, public): a Cloudflare Worker answers queries from the React frontend. This is internet-facing — treat it accordingly.
Stack
Cloudflare-native backend so it sits alongside the existing site, with Claude for answer quality:

* Frontend: existing Vite + React site (`garlicGrape/cloudflareSite`), deployed on Cloudflare Pages. Adds a chat widget that calls the Worker API.
* API: Cloudflare Worker (`/worker`), TypeScript, managed with Wrangler. Routes: `POST /chat`, `GET /health`.
* Vector store: Cloudflare Vectorize.
* Embeddings: Workers AI `@cf/baai/bge-base-en-v1.5` (768-dim). The ingestion script and the query path MUST use the same model — dimensions have to match.
* Generation: Anthropic API (Claude) called from the Worker, streamed back to the frontend.
* Raw files / metadata: Cloudflare R2 for source files if needed for citation links (private bucket, not public).
If a change would swap any of these (different vector DB, embedding model, or generation provider), ask first. Don't silently introduce a new vendor.
Alternative I considered: doing generation with Workers AI too, for a fully on-Cloudflare stack with no external API key. Defaulting to Claude for answer quality. Flag the tradeoff if relevant, don't just switch.
Repo layout

```
.
├── worker/
│   ├── src/
│   │   ├── index.ts        # Worker entry, routing, CORS
│   │   ├── chat.ts         # query embed -> Vectorize query -> prompt -> Claude
│   │   ├── retrieve.ts     # Vectorize top-k + metadata assembly
│   │   ├── prompt.ts       # system prompt + context formatting (single source)
│   │   └── ratelimit.ts    # abuse / cost protection
│   ├── wrangler.toml       # bindings: VECTORIZE, AI, R2, secrets
│   └── package.json
├── ingest/
│   ├── ingest.ts           # CLI: load -> chunk -> embed -> upsert
│   ├── loaders/            # per-filetype extractors (pdf, pptx, docx, md)
│   └── config.ts           # chunk size, overlap, model names, top_k
├── frontend/               # chat widget components (or in the main site repo)
└── data/source/            # raw MSBAi files (gitignored, NEVER committed)

```

Note: the frontend may live in the existing site repo rather than here — wire the widget into that codebase and point it at the deployed Worker URL.
Common commands

```bash
# Worker
cd worker
npm install
npx wrangler dev                      # local dev against remote bindings
npx wrangler deploy                   # ship to Cloudflare
npx wrangler secret put ANTHROPIC_API_KEY

# Vectorize (one-time setup)
npx wrangler vectorize create msbai-index --dimensions=768 --metric=cosine

# Ingestion (run after adding/changing source files)
cd ingest
npm install
npm run ingest -- --path ../data/source

```

Security & cost — this endpoint is public
This is the part that matters most now that it's online.

* Secrets: `ANTHROPIC_API_KEY` and any other keys are Wrangler secrets, never in the repo, `wrangler.toml`, or client code. The frontend never holds a key — it only talks to the Worker.
* CORS: lock the Worker to `https://sanchitk.dev` (and `www`). No wildcard origins.
* Rate limiting: required. A public `/chat` that calls a paid API is a cost and abuse risk. Per-IP limits via `ratelimit.ts`; cap request body size and reject oversized or malformed payloads early.
* Cost awareness: every query now costs money (embedding + generation). Keep `top_k` and context size tight; don't stuff the whole retrieval set into the prompt. Flag changes that materially raise per-query cost.
* No prompt injection footguns: retrieved chunks are data, not instructions. The system prompt must treat context as reference material only.
RAG conventions

* Chunking: ~800-token chunks, ~100-token overlap. Slides chunk per slide; PDFs/notes by token window. Chunk params live in `ingest/config.ts` only.
* Metadata: every vector stores `source_file`, `page_or_slide`, `course`, and `chunk_index`. Citations and any R2 deep-links depend on these.
* Citations required: answers point to source file + page/slide. If retrieval returns nothing relevant, the model says it isn't in the materials rather than guessing.
* Prompt lives in one place (`worker/src/prompt.ts`). Don't scatter fragments.
* top_k defaults to 5 — a config value, not a magic number.
* Re-ingest on change: changing the embedding model or chunking invalidates the index. The Vectorize index must be rebuilt from scratch — old vectors won't match new query embeddings. Call this out whenever it applies.
Data handling

* Course files in `data/source/` are gitignored and must stay that way. Never commit coursework or embeddings.
* R2 buckets holding source files are private. Don't expose direct public URLs; serve citation content (if at all) through the Worker with access control.
* Treat MSBAi content as private — no excerpts in commit messages, logs, or issues beyond what's needed to debug.
Code style

* TypeScript throughout the Worker and ingestion; type the Vectorize and Workers AI bindings.
* Config over constants — new tunables go in `config.ts` / `wrangler.toml`.
* Adding a new source filetype = one loader in `ingest/loaders/`, not edits to the pipeline.
* Prefer readable, plain code over clever abstractions; this is a personal project I'll revisit between classes.
When working here

* Responses to the frontend should stream (Claude streaming -> Worker -> client).
* Hit `/health` and confirm Vectorize/AI bindings resolve before debugging deeper.
* Deploys go through `wrangler deploy`; keep `wrangler.toml` bindings in sync with what the code expects.
* No telemetry or third-party analytics in the Worker. Logging stays minimal and free of coursework content.
