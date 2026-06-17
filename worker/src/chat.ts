import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "./index";
import { checkRateLimit } from "./ratelimit";
import { retrieveChunks } from "./retrieve";
import { buildSystemPrompt, buildUserMessage } from "./prompt";

const MAX_BODY_BYTES = 4_096;
const MAX_QUESTION_CHARS = 500;
const MODEL = "claude-haiku-4-5-20251001";

export async function handleChat(
  request: Request,
  env: Env,
  cors: Record<string, string>
): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)),
      },
    });
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: "Request too large" }), {
      status: 413,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>)["question"] !== "string"
  ) {
    return new Response(JSON.stringify({ error: "Missing question field" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const question = (
    (body as Record<string, unknown>)["question"] as string
  ).slice(0, MAX_QUESTION_CHARS);

  const chunks = await retrieveChunks(question, env);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: buildUserMessage(question, chunks) }],
  });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // First SSE event carries citations so the frontend can render them immediately
  const citations = chunks.map((c) => ({
    source_file: c.source_file,
    page_or_slide: c.page_or_slide,
    course: c.course,
  }));
  writer.write(encoder.encode(`data: ${JSON.stringify({ citations })}\n\n`));

  (async () => {
    try {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
            )
          );
        }
      }
      writer.write(encoder.encode("data: [DONE]\n\n"));
    } finally {
      writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      ...cors,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
