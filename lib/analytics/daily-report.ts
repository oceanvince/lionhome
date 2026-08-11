/**
 * Aggregation + formatting for the daily ops digest.
 *
 * Pure functions on purpose: the SGT day boundary and the funnel maths are the
 * parts worth unit-testing, and neither needs a database.
 */

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000; // Asia/Singapore, no DST — a fixed offset is exact
const DAY_MS = 86_400_000;

export interface DayWindow {
  /** Inclusive lower bound (UTC instant of 00:00 SGT). */
  start: Date;
  /** Exclusive upper bound. */
  end: Date;
  /** The SGT calendar date this window covers, YYYY-MM-DD. */
  date: string;
}

/** Format a UTC instant as the SGT calendar date it falls on. */
export function sgtDateString(instant: Date): string {
  return new Date(instant.getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The Singapore-day window ending `daysAgo` days before today.
 * `daysAgo = 1` is yesterday, which is what the cron reports.
 */
export function sgtDayWindow(now: Date, daysAgo = 1): DayWindow {
  const sgtMidnightToday =
    Math.floor((now.getTime() + SGT_OFFSET_MS) / DAY_MS) * DAY_MS - SGT_OFFSET_MS;
  const end = sgtMidnightToday - (daysAgo - 1) * DAY_MS;
  const start = end - DAY_MS;
  return { start: new Date(start), end: new Date(end), date: sgtDateString(new Date(start)) };
}

export interface EventRow {
  name: string;
  visitor_id: string | null;
  is_bot: boolean;
  created_at: string;
}

/**
 * Figures read from `calculator_runs` rather than from the event stream.
 *
 * Since /compute persists every non-bot run, `saved` tracks `submits` closely
 * and a gap between them means inserts are failing. `leads` counts the runs
 * carrying a `user_id`, which is the only place a contact detail can hang off —
 * it stays 0 until the calculator actually asks for one.
 */
export interface RunCounts {
  saved: number;
  leads: number;
}

export interface DailySummary {
  date: string;
  views: number;
  viewVisitors: number;
  submits: number;
  submitVisitors: number;
  submitFailed: number;
  whatsappClicks: number;
  /** Distinct people behind those clicks — the conversion rates divide people
   *  by people, so one visitor clicking twice cannot push a rate over 100%. */
  whatsappVisitors: number;
  savedReports: number;
  leads: number;
  botEvents: number;
}

function inWindow(row: EventRow, w: DayWindow): boolean {
  const t = new Date(row.created_at).getTime();
  return t >= w.start.getTime() && t < w.end.getTime();
}

function uniqueVisitors(rows: EventRow[]): number {
  return new Set(rows.map((r) => r.visitor_id).filter((v): v is string => !!v)).size;
}

export function summarizeWindow(
  events: EventRow[],
  window: DayWindow,
  runs: RunCounts
): DailySummary {
  const inDay = events.filter((e) => inWindow(e, window));
  const human = inDay.filter((e) => !e.is_bot);
  const named = (name: string) => human.filter((e) => e.name === name);

  const views = named("calculator_view");
  const submits = named("calculator_submit");
  const whatsapp = named("whatsapp_click");

  return {
    date: window.date,
    views: views.length,
    viewVisitors: uniqueVisitors(views),
    submits: submits.length,
    submitVisitors: uniqueVisitors(submits),
    submitFailed: named("calculator_submit_failed").length,
    whatsappClicks: whatsapp.length,
    whatsappVisitors: uniqueVisitors(whatsapp),
    savedReports: runs.saved,
    leads: runs.leads,
    botEvents: inDay.filter((e) => e.is_bot).length,
  };
}

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

/** ▲ +3 / ▼ -1 / — , comparing today's figure with the previous day's. */
function delta(today: number, previous: number | undefined): string {
  if (previous === undefined) return "";
  const d = today - previous;
  if (d === 0) return "  —";
  return d > 0 ? `  ▲ +${d}` : `  ▼ ${d}`;
}

/**
 * CJK characters occupy two columns in Telegram's monospace block, so padding
 * by `String.length` misaligns any row whose label is not the same character
 * count. Measure in display columns instead.
 */
const FULLWIDTH_RANGES =
  /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/;

function displayWidth(s: string): number {
  let width = 0;
  for (const ch of s) width += FULLWIDTH_RANGES.test(ch) ? 2 : 1;
  return width;
}

function pad(label: string, width: number): string {
  return label + " ".repeat(Math.max(0, width - displayWidth(label)));
}

/**
 * Telegram message, `parse_mode: HTML`. Only <b> and <code> are used; every
 * interpolated value is a number or a YYYY-MM-DD date, so no escaping is needed.
 */
export function formatTelegramReport(today: DailySummary, previous?: DailySummary): string {
  const lines: string[] = [];

  lines.push(`📊 <b>狮城家 · 数据日报</b>  ${today.date}`);
  lines.push("");
  lines.push("<b>计算器漏斗</b>");
  lines.push("<code>");
  // label | unique people | raw count | trend — a blank third column keeps the
  // single-metric rows aligned with the two-metric ones.
  const row = (label: string, primary: string, secondary: string, trend: string) =>
    `${pad(label, 10)}${pad(primary, 8)}${pad(secondary, 8)}${trend}`;
  lines.push(
    row(
      "访问页面",
      `${today.viewVisitors} 人`,
      `${today.views} 次`,
      delta(today.viewVisitors, previous?.viewVisitors)
    )
  );
  lines.push(
    row(
      "提交计算",
      `${today.submitVisitors} 人`,
      `${today.submits} 次`,
      delta(today.submitVisitors, previous?.submitVisitors)
    )
  );
  lines.push(
    row(
      "报告落库",
      `${today.savedReports} 份`,
      "",
      delta(today.savedReports, previous?.savedReports)
    )
  );
  lines.push(
    row(
      "找顾问",
      `${today.whatsappClicks} 次`,
      "",
      delta(today.whatsappClicks, previous?.whatsappClicks)
    )
  );
  lines.push(row("留资", `${today.leads} 份`, "", delta(today.leads, previous?.leads)));
  lines.push("</code>");
  lines.push("");
  lines.push("<b>转化率</b>");
  lines.push("<code>");
  // Every ratio divides distinct people by distinct people. Dividing raw clicks
  // by unique visitors used to let 提交 → 顾问 read over 100% whenever someone
  // pressed the CTA twice.
  lines.push(`${pad("访问 → 提交", 14)}${pct(today.submitVisitors, today.viewVisitors)}`);
  lines.push(`${pad("提交 → 顾问", 14)}${pct(today.whatsappVisitors, today.submitVisitors)}`);
  lines.push(`${pad("顾问 → 留资", 14)}${pct(today.leads, today.whatsappVisitors)}`);
  lines.push("</code>");

  const notes: string[] = [];
  if (today.submitFailed > 0) notes.push(`⚠️ 计算失败 ${today.submitFailed} 次`);
  // Every non-bot compute now writes a row, so submits without a matching row
  // mean the insert is failing — the one failure mode that silently loses
  // reports again.
  if (today.savedReports < today.submits) {
    notes.push(
      `⚠️ 提交 ${today.submits} 次但只落库 ${today.savedReports} 份 — 检查 calculator_runs 写入`
    );
  }
  // The structural gap: people ask for an advisor, and nothing on our side can
  // reach them back. Stays until the calculator collects a phone number.
  if (today.whatsappClicks > 0 && today.leads === 0) {
    notes.push(`📵 ${today.whatsappClicks} 次找顾问、0 条联系方式 — 计算器仍未采集手机号`);
  }
  if (today.botEvents > 0) notes.push(`🤖 已过滤爬虫事件 ${today.botEvents} 次`);
  if (today.views === 0 && today.submits === 0) {
    notes.push("⚠️ 全天零事件 — 若站点正常，请检查埋点是否失效");
  }
  if (notes.length > 0) {
    lines.push("");
    lines.push(notes.join("\n"));
  }

  return lines.join("\n");
}
