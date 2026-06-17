import fs from "fs";
import path from "path";
import { getLoader } from "./loaders/index.js";
import {
  CHUNK_SIZE_TOKENS,
  CHUNK_OVERLAP_TOKENS,
  CF_ACCOUNT_ID,
  CF_API_TOKEN,
  VECTORIZE_INDEX,
  WORKERS_AI_BASE,
  EMBEDDING_MODEL,
} from "./config.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function roughTokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function chunkText(text: string): string[] {
  const words = roughTokenize(text);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + CHUNK_SIZE_TOKENS, words.length);
    chunks.push(words.slice(start, end).join(" "));
    start += CHUNK_SIZE_TOKENS - CHUNK_OVERLAP_TOKENS;
  }

  return chunks;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const url = `${WORKERS_AI_BASE}/${encodeURIComponent(EMBEDDING_MODEL)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texts }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Workers AI embed failed: ${res.status} ${err}`);
  }

  const json = (await res.json()) as { result: { data: number[][] } };
  return json.result.data;
}

async function upsertVectors(
  vectors: Array<{
    id: string;
    values: number[];
    metadata: Record<string, string | number>;
  }>
): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/vectorize/v2/indexes/${VECTORIZE_INDEX}/upsert`;

  // Vectorize REST upsert uses NDJSON
  const ndjson = vectors.map((v) => JSON.stringify(v)).join("\n");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/x-ndjson",
    },
    body: ndjson,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vectorize upsert failed: ${res.status} ${err}`);
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const pathIdx = args.indexOf("--path");
  const courseIdx = args.indexOf("--course");

  if (pathIdx === -1 || !args[pathIdx + 1]) {
    console.error("Usage: npm run ingest -- --path <dir> [--course <name>]");
    process.exit(1);
  }

  const sourceDir = args[pathIdx + 1]!;
  const course = courseIdx !== -1 ? (args[courseIdx + 1] ?? path.basename(sourceDir)) : path.basename(sourceDir);

  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    console.error("Set CF_ACCOUNT_ID and CF_API_TOKEN env vars");
    process.exit(1);
  }

  const files = fs.readdirSync(sourceDir);
  let totalVectors = 0;

  for (const file of files) {
    const ext = path.extname(file);
    const loader = getLoader(ext);
    if (!loader) {
      console.log(`Skipping unsupported file: ${file}`);
      continue;
    }

    console.log(`Loading ${file}...`);
    const filePath = path.join(sourceDir, file);
    let rawChunks;
    try {
      rawChunks = await loader(filePath, course);
    } catch (e) {
      console.error(`  Failed to load ${file}:`, e);
      continue;
    }

    // Sub-chunk each loaded piece
    const allChunks: Array<{ text: string; page_or_slide: number | string; source_file: string; course: string; chunk_index: number }> = [];
    for (const rc of rawChunks) {
      const subChunks = chunkText(rc.text);
      subChunks.forEach((text, ci) => {
        allChunks.push({ ...rc, text, chunk_index: ci });
      });
    }

    // Embed in batches of 50 (Workers AI limit)
    const EMBED_BATCH = 50;
    const UPSERT_BATCH = 100;
    const vectors: Array<{ id: string; values: number[]; metadata: Record<string, string | number> }> = [];

    for (let i = 0; i < allChunks.length; i += EMBED_BATCH) {
      const batch = allChunks.slice(i, i + EMBED_BATCH);
      const embeddings = await embedTexts(batch.map((c) => c.text));
      batch.forEach((c, j) => {
        vectors.push({
          id: `${c.source_file}__p${c.page_or_slide}__c${c.chunk_index}`,
          values: embeddings[j]!,
          metadata: {
            source_file: c.source_file,
            page_or_slide: c.page_or_slide,
            course: c.course,
            chunk_index: c.chunk_index,
            text: c.text.slice(0, 1000), // Vectorize metadata cap
          },
        });
      });
      process.stdout.write(`  Embedded ${Math.min(i + EMBED_BATCH, allChunks.length)}/${allChunks.length}\r`);
    }

    // Upsert in batches
    for (let i = 0; i < vectors.length; i += UPSERT_BATCH) {
      await upsertVectors(vectors.slice(i, i + UPSERT_BATCH));
    }

    console.log(`  -> ${vectors.length} vectors upserted for ${file}`);
    totalVectors += vectors.length;
  }

  console.log(`\nDone. Total vectors upserted: ${totalVectors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
