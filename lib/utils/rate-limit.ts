/**
 * Fixed-window rate limiter for the unauthenticated write endpoints.
 *
 * SCOPE — read this before relying on it. The counters live in the module
 * instance's memory, so the limit applies per warm Vercel instance, not
 * globally: an attacker spread across enough concurrent instances gets a
 * multiple of `limit`. That is a real gap, and the fix is a shared store
 * (Vercel KV / Upstash) once one is provisioned.
 *
 * It is still worth having. `/api/v1/calculator/compute` writes a row holding a
 * full financial profile on every call, and `/api/v1/events` feeds the numbers
 * the team reads each morning — before this, a single client with a loop could
 * fill either table and forge the daily digest unopposed. A per-instance cap
 * turns that from trivial into deliberate.
 */

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the current window closes. */
  retryAfter: number;
}

interface Bucket {
  count: number;
  /** Epoch ms at which this window expires. */
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Entries are only removed when touched, so a stream of unique keys (one per
 * attacker IP) would otherwise grow the map without bound. Sweep whenever it
 * gets large — the cost is amortised and bounded by the map size itself.
 */
const SWEEP_THRESHOLD = 10_000;

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Count one hit against `key`. Returns `ok: false` once `limit` is exceeded
 * within `windowMs`.
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now()
): RateLimitResult {
  if (buckets.size > SWEEP_THRESHOLD) sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > opts.limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * Best-effort client identity. Vercel sets `x-vercel-forwarded-for` at the edge
 * and it cannot be spoofed by the client; the other headers are fallbacks for
 * local development. "unknown" buckets every unidentified caller together,
 * which is the safe direction — it throttles rather than exempts them.
 */
export function clientKey(headers: Headers, scope: string): string {
  const ip =
    headers.get("x-vercel-forwarded-for") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown";
  return `${scope}:${ip}`;
}

/** Exposed for tests — the module-level map otherwise leaks between cases. */
export function __resetRateLimits(): void {
  buckets.clear();
}
