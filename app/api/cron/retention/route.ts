import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Privacy policy §5: anonymous runs are kept 12 months. */
const ANON_RETENTION_DAYS = 365;

/**
 * Enforces the retention promise in the privacy policy. Deletes anonymous
 * calculator runs (user_id is null) older than 12 months. Runs that were claimed
 * by a lead are left alone — those fall under the separate 24-month rule.
 *
 * Guarded by CRON_SECRET, same as the condo ingest job.
 */
export async function GET(req: NextRequest) {
  return runRetention(req);
}

export async function POST(req: NextRequest) {
  return runRetention(req);
}

async function runRetention(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "invalid cron secret" } },
      { status: 401 }
    );
  }

  const cutoff = new Date(Date.now() - ANON_RETENTION_DAYS * 86_400_000).toISOString();
  const db = getSupabaseServiceRoleClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from("calculator_runs") as any)
    .delete()
    .is("user_id", null)
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    console.error("[/api/cron/retention] Delete failed:", error);
    return NextResponse.json(
      { ok: false, error: { code: "DB_ERROR", message: "retention sweep failed" } },
      { status: 500 }
    );
  }

  const deleted = (data as { id: string }[] | null)?.length ?? 0;
  return NextResponse.json({ ok: true, data: { deleted, cutoff } });
}
