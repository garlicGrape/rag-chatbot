import type { Env } from "./index";

export interface Chunk {
  source_file: string;
  page_or_slide: number | string;
  course: string;
  chunk_index: number;
  text: string;
  score: number;
}

const TOP_K = 5;

export async function retrieveChunks(query: string, env: Env): Promise<Chunk[]> {
  // Embed the query using the same model as ingestion
  const embedResult = await env.AI.run("@cf/baai/bge-base-en-v1.5", {
    text: [query],
  });

  const queryVector = embedResult.data[0];
  if (!queryVector) return [];

  const results = await env.VECTORIZE.query(queryVector, {
    topK: TOP_K,
    returnMetadata: "all",
  });

  return results.matches
    .filter((m) => m.score > 0.35)
    .map((m) => ({
      source_file: String(m.metadata?.["source_file"] ?? "unknown"),
      page_or_slide: m.metadata?.["page_or_slide"] as number | string ?? 0,
      course: String(m.metadata?.["course"] ?? ""),
      chunk_index: Number(m.metadata?.["chunk_index"] ?? 0),
      text: String(m.metadata?.["text"] ?? ""),
      score: m.score,
    }));
}
