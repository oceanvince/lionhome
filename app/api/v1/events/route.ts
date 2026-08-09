import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAnalyticsEventName, isBotUserAgent, trackEvent } from "@/lib/analytics/events";

export const runtime = "nodejs";

/**
 * Browser beacon sink for funnel events (lib/analytics/client.ts).
 *
 * Always answers 204 — a beacon has no one listening, and a visible error
 * would only teach an attacker what the validator rejects. Bad payloads are
 * dropped silently.
 */
const EventSchema = z.object({
  name: z.string().refine(isAnalyticsEventName),
  visitor_id: z.string().max(64).optional(),
  session_id: z.string().max(64).optional(),
  path: z.string().max(200).optional(),
  props: z.record(z.unknown()).optional(),
});

const noContent = () => new NextResponse(null, { status: 204 });

export async function POST(req: NextRequest) {
  // Crawlers do not normally run our JS, but a spoofed beacon is trivial to
  // send — flag rather than drop, so the daily report can show what was filtered.
  const isBot = isBotUserAgent(req.headers.get("user-agent"));

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return noContent();
  }

  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) return noContent();

  const { name, visitor_id, session_id, path, props } = parsed.data;

  // Cap the props blob so a hostile client cannot write large rows.
  let safeProps: Record<string, unknown> = {};
  if (props && JSON.stringify(props).length <= 1000) safeProps = props;

  await trackEvent({
    name,
    visitorId: visitor_id,
    sessionId: session_id,
    path,
    country: req.headers.get("x-vercel-ip-country"),
    isBot,
    props: safeProps,
  });

  return noContent();
}
