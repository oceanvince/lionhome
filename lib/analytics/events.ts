import { getSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * The full set of funnel events. Anything not listed here is rejected by
 * /api/v1/events, so a stray or spoofed name can never pollute the table.
 */
export const ANALYTICS_EVENTS = [
  "calculator_view", // opened /calculator
  "calculator_submit", // pressed 计算 and the engine returned a result
  "calculator_submit_failed", // pressed 计算 but validation/engine failed
  "whatsapp_click", // pressed 找顾问, after PDPA consent
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export function isAnalyticsEventName(v: unknown): v is AnalyticsEventName {
  return typeof v === "string" && (ANALYTICS_EVENTS as readonly string[]).includes(v);
}

/**
 * Crawlers seen in production plus the usual suspects. This is the difference
 * between "12 people used the calculator" and "12 hits, 9 of them Bingbot" —
 * the export from 2026-08-09 was roughly a third crawler traffic.
 *
 * Social-preview fetchers (facebookexternalhit, Twitterbot, the WhatsApp link
 * previewer) count as bots: they fire when someone *shares* a link, not when
 * someone reads the page.
 */
const BOT_UA_PATTERN = new RegExp(
  [
    "bot",
    "crawler",
    "spider",
    "crawling",
    "facebookexternalhit",
    "facebot",
    "twitterbot",
    "slackbot",
    "whatsapp",
    "telegrambot",
    "discordbot",
    "linkedinbot",
    "embedly",
    "quora link preview",
    "bingpreview",
    "headless",
    "phantomjs",
    "puppeteer",
    "playwright",
    "lighthouse",
    "undici",
    "axios",
    "node-fetch",
    "got/",
    "curl/",
    "wget",
    "python-requests",
    "httpx",
    "go-http-client",
    "java/",
    "okhttp",
    "vercel-cron",
    "vercel-screenshot",
    "gptbot",
    "oai-searchbot",
    "chatgpt-user",
    "claudebot",
    "claude-web",
    "anthropic-ai",
    "perplexitybot",
    "applebot",
    "yandex",
    "baiduspider",
    "sogou",
    "bytespider",
    "semrush",
    "ahrefs",
    "mj12",
    "dotbot",
    "petalbot",
    "dataforseo",
    "screaming frog",
  ].join("|"),
  "i"
);

/**
 * A request with no User-Agent at all is treated as a bot: every real browser
 * sends one.
 */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.trim() === "") return true;
  return BOT_UA_PATTERN.test(ua);
}

export interface TrackEventInput {
  name: AnalyticsEventName;
  visitorId?: string | null;
  sessionId?: string | null;
  path?: string | null;
  country?: string | null;
  isBot?: boolean;
  props?: Record<string, unknown>;
}

function trim(v: string | null | undefined, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s === "") return null;
  return s.slice(0, max);
}

/**
 * Insert one funnel event. Never throws and never rejects — analytics must not
 * be able to break a user-facing request. Call it from `after()` in a route
 * handler so the insert does not sit in the response path.
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    // DB types are stubs pending `npm run db:types:remote`. Cast via `any`,
    // matching /api/v1/calculator/save.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getSupabaseServiceRoleClient() as any;
    const { error } = await db.from("analytics_events").insert({
      name: input.name,
      visitor_id: trim(input.visitorId, 64),
      session_id: trim(input.sessionId, 64),
      path: trim(input.path, 200),
      country: trim(input.country, 8),
      is_bot: input.isBot ?? false,
      props: input.props ?? {},
    });
    if (error) console.error("[analytics] insert failed:", error.message);
  } catch (err) {
    console.error("[analytics] insert threw:", err);
  }
}

/** Read the ids the browser attaches to instrumented fetches. */
export function readTrackingHeaders(headers: Headers): {
  visitorId: string | null;
  sessionId: string | null;
  country: string | null;
  isBot: boolean;
} {
  return {
    visitorId: trim(headers.get("x-lh-visitor"), 64),
    sessionId: trim(headers.get("x-lh-session"), 64),
    country: trim(headers.get("x-vercel-ip-country"), 8),
    isBot: isBotUserAgent(headers.get("user-agent")),
  };
}
