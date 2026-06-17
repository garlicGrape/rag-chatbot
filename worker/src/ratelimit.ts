// Simple in-memory rate limiter — resets per isolate lifetime.
// For stricter limits use Cloudflare Rate Limiting (paid) or Durable Objects.
const windowMs = 60_000; // 1 minute
const maxRequests = 10;  // per IP per window

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(ip, bucket);
  }

  bucket.count += 1;

  if (bucket.count > maxRequests) {
    return { allowed: false, retryAfterMs: bucket.resetAt - now };
  }

  return { allowed: true, retryAfterMs: 0 };
}
