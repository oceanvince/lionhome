import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  type DayWindow,
  type EventRow,
  type RunCounts,
  formatTelegramReport,
  sgtDayWindow,
  summarizeWindow,
} from "@/lib/analytics/daily-report";
import { isTelegramConfigured, sendTelegramMessage } from "@/lib/notify/telegram";
import { isAuthorizedCron } from "@/lib/utils/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Retention windows enforced here, mirroring what /legal/privacy §5 promises.
 * Changing either number means changing that page too — a policy that overstates
 * what the cron actually deletes is worse than having no policy at all.
 */
const RETENTION_DAYS = 180; // analytics events + anonymous calculator runs
const LEAD_RETENTION_DAYS = 730; // 24 months, then the run is anonymised

/**
 * Daily ops digest (calculator funnel) pushed to the Telegram group.
 * Guarded by CRON_SECRET, same contract as /api/cron/condo-ingest.
 *
 * Vercel Cron invokes this via GET with `Authorization: Bearer $CRON_SECRET`;
 * a manual run POSTs with the same header. The secret is never accepted as a
 * query parameter — that would log it (see lib/utils/cron-auth.ts).
 *
 * Query params:
 *   ?daysAgo=N  report on N days ago instead of yesterday (backfill / testing)
 *   ?dry=1      build the message and return it without sending to Telegram
 */
export async function GET(req: NextRequest) {
  return runReport(req);
}

export async function POST(req: NextRequest) {
  return runReport(req);
}

async function runReport(req: NextRequest) {
  if (!isAuthorizedCron(req.headers)) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "invalid cron secret" } },
      { status: 401 }
    );
  }

  const daysAgo = Math.max(1, Number(req.nextUrl.searchParams.get("daysAgo") ?? 1) || 1);
  const dryRun = req.nextUrl.searchParams.get("dry") === "1";

  const now = new Date();
  const target = sgtDayWindow(now, daysAgo);
  const previous = sgtDayWindow(now, daysAgo + 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServiceRoleClient() as any;

  // One read covering both days; bucketing happens in summarizeWindow.
  const { data: events, error: eventsErr } = await db
    .from("analytics_events")
    .select("name, visitor_id, is_bot, created_at")
    .gte("created_at", previous.start.toISOString())
    .lt("created_at", target.end.toISOString());

  if (eventsErr) {
    console.error("[daily-report] event query failed:", eventsErr.message);
    // Say so in the group. A silent morning is indistinguishable from a quiet
    // day, so a broken digest has to announce itself.
    if (!dryRun) {
      await sendTelegramMessage(
        `⚠️ <b>狮城家 · 日报生成失败</b>  ${target.date}\n\n读取 analytics_events 出错：\n<code>${escapeHtml(eventsErr.message).slice(0, 300)}</code>`
      );
    }
    return NextResponse.json(
      { ok: false, error: { code: "QUERY_FAILED", message: eventsErr.message } },
      { status: 500 }
    );
  }

  const rows: EventRow[] = events ?? [];
  const [targetRuns, previousRuns] = await Promise.all([
    countRuns(db, target),
    countRuns(db, previous),
  ]);

  const todaySummary = summarizeWindow(rows, target, targetRuns);
  const prevSummary = summarizeWindow(rows, previous, previousRuns);
  const message = formatTelegramReport(todaySummary, prevSummary);

  let sent = false;
  let sendError: string | undefined;
  if (!dryRun) {
    const result = await sendTelegramMessage(message);
    sent = result.ok;
    sendError = result.error;
    if (!result.ok) console.error("[daily-report] telegram send failed:", result.error);
  }

  // `?dry=1` means "show me what would be sent". Deleting six months of events
  // is not part of that — it used to run on dry invocations too.
  const retention = dryRun
    ? { events: 0, anonymousRuns: 0, anonymised: 0 }
    : {
        events: await pruneOldEvents(db),
        anonymousRuns: await pruneAnonymousRuns(db),
        anonymised: await anonymiseOldLeadRuns(db),
      };

  const payload = {
    date: todaySummary.date,
    summary: todaySummary,
    sent,
    sendError,
    message,
    retention,
  };

  // A digest nobody received is a failed run. Returning 200 here made Vercel Cron
  // record a success, so the group could go quiet for days without any signal —
  // and the failure alert itself goes over Telegram, so it cannot be the only one.
  //
  // Only when Telegram is actually configured: leaving the token unset is a
  // documented setup state (.env.example), not a failure, and turning it into a
  // daily red cron run would train the team to ignore the alert that matters.
  if (!dryRun && !sent && isTelegramConfigured()) {
    return NextResponse.json(
      { ok: false, error: { code: "SEND_FAILED", message: sendError ?? "telegram send failed" } },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data: payload });
}

/**
 * A driver error can contain `<` or `&`, which would make Telegram reject the
 * whole message with `parse_mode: HTML` — the alert would fail exactly when it
 * is needed.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * `calculator_runs` is the source of truth for reports — it is the row the user
 * actually created, so it needs no separate event. Since /compute persists every
 * non-bot run, `saved` should track the day's submits; `leads` counts the runs
 * that carry a `user_id`, the only anchor a contact detail can hang off.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countRuns(db: any, window: DayWindow): Promise<RunCounts> {
  const inWindow = () =>
    db
      .from("calculator_runs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", window.start.toISOString())
      .lt("created_at", window.end.toISOString());

  const [saved, leads] = await Promise.all([inWindow(), inWindow().not("user_id", "is", null)]);

  if (saved.error) console.error("[daily-report] runs count failed:", saved.error.message);
  if (leads.error) console.error("[daily-report] leads count failed:", leads.error.message);

  return { saved: saved.count ?? 0, leads: leads.count ?? 0 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pruneOldEvents(db: any): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const { data, error } = await db
    .from("analytics_events")
    .delete()
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.error("[daily-report] prune failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Enforce the retention promised in /legal/privacy §5.
 *
 * /compute persists every non-bot run, so `calculator_runs` now grows with
 * traffic rather than with leads, and `inputs` holds a full financial profile
 * (income, cash, CPF, age). Anonymous runs — the overwhelming majority — are
 * deleted at 180 days, matching the analytics events beside them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pruneAnonymousRuns(db: any): Promise<number> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
  const { data, error } = await db
    .from("calculator_runs")
    .delete()
    .is("user_id", null)
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.error("[daily-report] anonymous run prune failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * A run tied to a lead is kept for 24 months and then anonymised rather than
 * deleted: detaching the user keeps the aggregate funnel intact while the row
 * stops being personal data. It is picked up by the anonymous prune 180 days
 * later. (/legal/privacy §5.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function anonymiseOldLeadRuns(db: any): Promise<number> {
  const cutoff = new Date(Date.now() - LEAD_RETENTION_DAYS * 86_400_000).toISOString();
  const { data, error } = await db
    .from("calculator_runs")
    .update({ user_id: null })
    .not("user_id", "is", null)
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.error("[daily-report] lead run anonymise failed:", error.message);
    return 0;
  }
  return data?.length ?? 0;
}
