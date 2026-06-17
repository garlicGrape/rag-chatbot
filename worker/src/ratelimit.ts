// Simple in-memory rate limiter — resets per isolate lifetime.
// For stricter limits use Cloudflare Rate Limiting or Durable Objects.
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(ip: string): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, bucket);
  }

  bucket.count += 1;

  if (bucket.count > MAX_REQUESTS) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  return { allowed: true, retryAfterMs: 0 };
}
