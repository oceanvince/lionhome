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
import { sendTelegramMessage } from "@/lib/notify/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Events older than this are pruned on each run (see the migration's privacy note). */
const RETENTION_DAYS = 180;

/**
 * Daily ops digest (calculator funnel) pushed to the Telegram group.
 * Guarded by CRON_SECRET, same contract as /api/cron/condo-ingest.
 *
 * Vercel Cron invokes this via GET with `Authorization: Bearer $CRON_SECRET`;
 * a manual run can POST or pass `?secret=`.
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

  const pruned = await pruneOldEvents(db);

  return NextResponse.json({
    ok: true,
    data: { date: todaySummary.date, summary: todaySummary, sent, sendError, message, pruned },
  });
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
