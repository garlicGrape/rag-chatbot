import { handleChat } from "./chat";

export interface Env {
  VECTORIZE: Vectorize;
  AI: Ai;
  ANTHROPIC_API_KEY: string;
}

const ALLOWED_ORIGINS = new Set([
  "https://sanchitk.dev",
  "https://www.sanchitk.dev",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : ALLOWED_ORIGINS.values().next().value!;
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/chat" && request.method === "POST") {
      return handleChat(request, env, cors);
    }

    return new Response("Not Found", { status: 404, headers: cors });
  },
};
