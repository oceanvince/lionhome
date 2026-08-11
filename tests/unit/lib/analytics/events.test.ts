import { describe, expect, it } from "vitest";
import { isAnalyticsEventName, isBotUserAgent } from "@/lib/analytics/events";

describe("isBotUserAgent", () => {
  it("flags the crawlers that actually show up in the logs", () => {
    const bots = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
      "Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)",
      "Twitterbot/1.0",
      "facebookexternalhit/1.1",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "vercel-cron/1.0",
    ];
    for (const ua of bots) expect(isBotUserAgent(ua), ua).toBe(true);
  });

  it("treats a missing or blank User-Agent as a bot", () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent(undefined)).toBe(true);
    expect(isBotUserAgent("   ")).toBe(true);
  });

  it("does not mistake a device name containing 'bot' for a crawler", () => {
    // CUBOT ships Android phones. A bare "bot" substring matched these, and
    // since /compute skips persistence for bots that silently discarded a real
    // visitor's report — not just a miscounted event.
    const humans = [
      "Mozilla/5.0 (Linux; Android 10; CUBOT NOTE 20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Linux; Android 11; CUBOT KING KONG 5 Pro) AppleWebKit/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/150.0.7871.51 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ];
    for (const ua of humans) expect(isBotUserAgent(ua), ua).toBe(false);
  });
});

describe("isAnalyticsEventName", () => {
  it("accepts the allow-listed names and rejects everything else", () => {
    expect(isAnalyticsEventName("calculator_view")).toBe(true);
    expect(isAnalyticsEventName("whatsapp_click")).toBe(true);
    expect(isAnalyticsEventName("drop table")).toBe(false);
    expect(isAnalyticsEventName(42)).toBe(false);
    expect(isAnalyticsEventName(undefined)).toBe(false);
  });
});
