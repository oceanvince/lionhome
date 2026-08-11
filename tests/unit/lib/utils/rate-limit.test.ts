import { beforeEach, describe, expect, it } from "vitest";
import { __resetRateLimits, clientKey, rateLimit } from "@/lib/utils/rate-limit";

const WINDOW = { limit: 3, windowMs: 60_000 };

beforeEach(() => __resetRateLimits());

describe("rateLimit", () => {
  it("allows up to the limit and refuses the next call", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", WINDOW, now).ok, `call ${i + 1}`).toBe(true);
    }
    const refused = rateLimit("k", WINDOW, now);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfter).toBe(60);
  });

  it("keeps separate counters per key", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) rateLimit("a", WINDOW, now);
    expect(rateLimit("a", WINDOW, now).ok).toBe(false);
    expect(rateLimit("b", WINDOW, now).ok).toBe(true);
  });

  it("opens a fresh window once the old one expires", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) rateLimit("k", WINDOW, now);
    expect(rateLimit("k", WINDOW, now).ok).toBe(false);
    expect(rateLimit("k", WINDOW, now + 60_001).ok).toBe(true);
  });

  it("never reports a retryAfter of zero while refusing", () => {
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) rateLimit("k", WINDOW, now);
    // 1ms before the window closes, ceil() would still round to 1 — never 0,
    // which a client would read as "retry immediately".
    const refused = rateLimit("k", WINDOW, now + 59_999);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfter).toBeGreaterThanOrEqual(1);
  });
});

describe("clientKey", () => {
  it("prefers the edge-set header a client cannot forge", () => {
    const h = new Headers({
      "x-vercel-forwarded-for": "1.2.3.4",
      "x-forwarded-for": "9.9.9.9",
    });
    expect(clientKey(h, "compute")).toBe("compute:1.2.3.4");
  });

  it("takes the first hop of x-forwarded-for when running locally", () => {
    const h = new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" });
    expect(clientKey(h, "save")).toBe("save:5.6.7.8");
  });

  it("buckets unidentified callers together rather than exempting them", () => {
    expect(clientKey(new Headers(), "events")).toBe("events:unknown");
  });

  it("scopes the key so one endpoint cannot exhaust another's budget", () => {
    const h = new Headers({ "x-vercel-forwarded-for": "1.2.3.4" });
    expect(clientKey(h, "compute")).not.toBe(clientKey(h, "save"));
  });
});
