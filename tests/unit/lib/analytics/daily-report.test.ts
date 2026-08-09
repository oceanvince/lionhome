import { describe, expect, it } from "vitest";
import {
  type EventRow,
  type RunCounts,
  formatTelegramReport,
  sgtDateString,
  sgtDayWindow,
  summarizeWindow,
} from "@/lib/analytics/daily-report";

/** Runs persisted by /compute, and how many of them carry a user_id. */
const runs = (saved: number, leads = 0): RunCounts => ({ saved, leads });

/** The cron fires at 00:30 UTC = 08:30 SGT, so "yesterday" is 2026-08-08 SGT. */
const CRON_FIRE = new Date("2026-08-09T00:30:00.000Z");

describe("sgtDayWindow", () => {
  it("reports the previous Singapore day, not the previous UTC day", () => {
    const w = sgtDayWindow(CRON_FIRE, 1);
    expect(w.date).toBe("2026-08-08");
    expect(w.start.toISOString()).toBe("2026-08-07T16:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-08-08T16:00:00.000Z");
  });

  it("steps back a whole day at a time", () => {
    expect(sgtDayWindow(CRON_FIRE, 2).date).toBe("2026-08-07");
    expect(sgtDayWindow(CRON_FIRE, 2).end.toISOString()).toBe("2026-08-07T16:00:00.000Z");
  });

  it("keeps late-evening SGT activity in that same SGT day", () => {
    // 2026-08-08 23:59 SGT is 15:59 UTC — still 2026-08-08 in Singapore,
    // even though UTC already reads 2026-08-08 too. The 17:00 SGT case is the
    // one that breaks naive UTC bucketing: 09:00 UTC same day.
    const w = sgtDayWindow(CRON_FIRE, 1);
    const lateEvening = new Date("2026-08-08T15:59:00.000Z").getTime();
    expect(lateEvening).toBeGreaterThanOrEqual(w.start.getTime());
    expect(lateEvening).toBeLessThan(w.end.getTime());
  });

  it("formats an instant as its Singapore calendar date", () => {
    // 16:00 UTC is already the next day in Singapore.
    expect(sgtDateString(new Date("2026-08-07T16:00:00.000Z"))).toBe("2026-08-08");
    expect(sgtDateString(new Date("2026-08-07T15:59:00.000Z"))).toBe("2026-08-07");
  });
});

function ev(name: string, visitor: string | null, iso: string, isBot = false): EventRow {
  return { name, visitor_id: visitor, is_bot: isBot, created_at: iso };
}

describe("summarizeWindow", () => {
  const window = sgtDayWindow(CRON_FIRE, 1);

  it("counts visits and unique visitors, excluding bots and other days", () => {
    const events: EventRow[] = [
      ev("calculator_view", "v1", "2026-08-07T17:00:00.000Z"),
      ev("calculator_view", "v1", "2026-08-08T02:00:00.000Z"), // same person, second visit
      ev("calculator_view", "v2", "2026-08-08T03:00:00.000Z"),
      ev("calculator_view", "bot", "2026-08-08T04:00:00.000Z", true), // filtered
      ev("calculator_view", "v9", "2026-08-06T10:00:00.000Z"), // previous day, out of window
      ev("calculator_submit", "v1", "2026-08-08T02:05:00.000Z"),
      ev("calculator_submit_failed", "v2", "2026-08-08T03:10:00.000Z"),
      ev("whatsapp_click", "v1", "2026-08-08T02:20:00.000Z"),
    ];

    const s = summarizeWindow(events, window, runs(1));
    expect(s.date).toBe("2026-08-08");
    expect(s.views).toBe(3);
    expect(s.viewVisitors).toBe(2);
    expect(s.submits).toBe(1);
    expect(s.submitVisitors).toBe(1);
    expect(s.submitFailed).toBe(1);
    expect(s.whatsappClicks).toBe(1);
    expect(s.savedReports).toBe(1);
    expect(s.leads).toBe(0);
    expect(s.botEvents).toBe(1);
  });

  it("carries run and lead counts straight through from the database", () => {
    const s = summarizeWindow([], window, runs(9, 2));
    expect(s.savedReports).toBe(9);
    expect(s.leads).toBe(2);
  });

  it("returns zeroes rather than throwing on an empty day", () => {
    const s = summarizeWindow([], window, runs(0));
    expect(s.views).toBe(0);
    expect(s.viewVisitors).toBe(0);
    expect(s.savedReports).toBe(0);
    expect(s.leads).toBe(0);
  });
});

describe("formatTelegramReport", () => {
  const window = sgtDayWindow(CRON_FIRE, 1);
  const events: EventRow[] = [
    ev("calculator_view", "v1", "2026-08-08T02:00:00.000Z"),
    ev("calculator_view", "v2", "2026-08-08T03:00:00.000Z"),
    ev("calculator_submit", "v1", "2026-08-08T02:05:00.000Z"),
  ];

  it("includes the date, the funnel numbers and a conversion rate", () => {
    const msg = formatTelegramReport(summarizeWindow(events, window, runs(1)));
    expect(msg).toContain("2026-08-08");
    expect(msg).toContain("2 人");
    expect(msg).toContain("50.0%"); // 1 of 2 visitors submitted
  });

  it("shows a delta against the previous day when one is supplied", () => {
    const today = summarizeWindow(events, window, runs(1));
    const previous = { ...today, viewVisitors: 1 };
    expect(formatTelegramReport(today, previous)).toContain("▲ +1");
  });

  it("flags a zero-traffic day as a possible instrumentation failure", () => {
    expect(formatTelegramReport(summarizeWindow([], window, runs(0)))).toContain("零事件");
  });

  it("renders — instead of dividing by zero", () => {
    expect(formatTelegramReport(summarizeWindow([], window, runs(0)))).toContain("—");
  });

  it("flags submits that never reached calculator_runs", () => {
    // Two submits, one row: an insert failed, which is the one regression that
    // would silently lose reports again.
    const msg = formatTelegramReport(
      summarizeWindow(
        [
          ev("calculator_submit", "v1", "2026-08-08T02:05:00.000Z"),
          ev("calculator_submit", "v2", "2026-08-08T03:05:00.000Z"),
        ],
        window,
        runs(1)
      )
    );
    expect(msg).toContain("只落库");
  });

  it("stays quiet when every submit produced a row", () => {
    const msg = formatTelegramReport(
      summarizeWindow([ev("calculator_submit", "v1", "2026-08-08T02:05:00.000Z")], window, runs(1))
    );
    expect(msg).not.toContain("只落库");
  });

  it("flags advisor requests that produced no contact detail", () => {
    const msg = formatTelegramReport(
      summarizeWindow([ev("whatsapp_click", "v1", "2026-08-08T02:20:00.000Z")], window, runs(1, 0))
    );
    expect(msg).toContain("未采集手机号");
  });

  it("drops the contact warning once a run carries a user", () => {
    const msg = formatTelegramReport(
      summarizeWindow([ev("whatsapp_click", "v1", "2026-08-08T02:20:00.000Z")], window, runs(1, 1))
    );
    expect(msg).not.toContain("未采集手机号");
  });
});
