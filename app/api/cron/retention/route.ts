import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { isAuthorizedCron } from "@/lib/utils/cron-auth";

export const runtime = "nodejs";

/**
 * Retention windows enforced here, mirroring what /legal/privacy §5 promises.
 * Changing either number means changing that page too — a policy that overstates
 * what the cron actually deletes is worse than having no policy at all.
 */
const ANON_RETENTION_DAYS = 365; // anonymous runs are deleted outright
const LEAD_RETENTION_DAYS = 730; // 24 months, then the run is anonymised

/**
 * The single owner of `calculator_runs` retention. Anonymous runs (user_id null)
 * are deleted at 12 months; a run claimed by a lead is anonymised at 24 months
 * rather than deleted, which keeps the aggregate funnel intact while the row
 * stops being personal data — the anonymous sweep then collects it a year later.
 *
 * Analytics events have their own window and are pruned by the daily digest job;
 * one table, one owner.
 *
 * Guarded by CRON_SECRET, header only — see lib/utils/cron-auth.ts.
 */
export async function GET(req: NextRequest) {
  return runRetention(req);
}

export async function POST(req: NextRequest) {
  return runRetention(req);
}

async function runRetention(req: NextRequest) {
  if (!isAuthorizedCron(req.headers)) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "invalid cron secret" } },
      { status: 401 }
    );
  }

  const anonCutoff = new Date(Date.now() - ANON_RETENTION_DAYS * 86_400_000).toISOString();
  const leadCutoff = new Date(Date.now() - LEAD_RETENTION_DAYS * 86_400_000).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServiceRoleClient() as any;

  // Anonymise first, then delete: a run that crosses the 24-month line in this
  // same sweep becomes anonymous and waits out its own 12 months, rather than
  // being deleted a year early by the pass that follows.
  const { data: anonymised, error: anonymiseErr } = await db
    .from("calculator_runs")
    .update({ user_id: null })
    .not("user_id", "is", null)
    .lt("created_at", leadCutoff)
    .select("id");

  if (anonymiseErr) {
    console.error("[/api/cron/retention] Anonymise failed:", anonymiseErr);
    return NextResponse.json(
      { ok: false, error: { code: "DB_ERROR", message: "retention sweep failed" } },
      { status: 500 }
    );
  }

  const { data, error } = await db
    .from("calculator_runs")
    .delete()
    .is("user_id", null)
    .lt("created_at", anonCutoff)
    .select("id");

  if (error) {
    console.error("[/api/cron/retention] Delete failed:", error);
    return NextResponse.json(
      { ok: false, error: { code: "DB_ERROR", message: "retention sweep failed" } },
      { status: 500 }
    );
  }

  const deleted = (data as { id: string }[] | null)?.length ?? 0;
  return NextResponse.json({
    ok: true,
    data: {
      deleted,
      anonymised: (anonymised as { id: string }[] | null)?.length ?? 0,
      anonCutoff,
      leadCutoff,
    },
  });
}
