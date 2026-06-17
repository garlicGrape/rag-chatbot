export const CHUNK_SIZE_TOKENS = 800;
export const CHUNK_OVERLAP_TOKENS = 100;
export const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
export const TOP_K = 5;

// Vectorize REST API — set these via env vars or .env file (gitignored)
export const CF_ACCOUNT_ID = process.env["CF_ACCOUNT_ID"] ?? "";
export const CF_API_TOKEN = process.env["CF_API_TOKEN"] ?? "";
export const VECTORIZE_INDEX = "msbai-index";

// Workers AI REST base
export const WORKERS_AI_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run`;
