import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Shared guard for the Vercel Cron endpoints.
 *
 * Header only — the `?secret=` fallback these routes used to accept put the
 * cron secret straight into Vercel's `requestQueryString` log column, where it
 * sits for the whole log retention window and lands in any log export or drain.
 * A manual run passes the header instead:
 *
 *   curl -X POST "$SITE/api/cron/daily-report?dry=1" \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * The comparison is constant-time. Both sides are hashed first so that
 * timingSafeEqual never sees mismatched lengths (it throws on those, which
 * would leak the secret's length through the error path).
 */
export function isAuthorizedCron(headers: Headers): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  // The `Bearer ` prefix is required, not stripped-if-present. A plain
  // `.replace()` left a bare token untouched, so `Authorization: <secret>` was
  // silently a second accepted form; Vercel Cron always sends the prefix and
  // there is no reason to keep a spare door.
  const match = /^Bearer\s+(\S.*)$/i.exec(headers.get("authorization") ?? "");
  if (!match) return false;

  const a = createHash("sha256").update(match[1]!).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
