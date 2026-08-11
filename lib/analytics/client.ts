"use client";

import type { AnalyticsEventName } from "./events";

const VISITOR_KEY = "lh_vid"; // localStorage — survives reloads and return visits
const SESSION_KEY = "lh_sid"; // sessionStorage — one tab, one browsing session

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * A v4 uuid, for ids that end up in a uuid database column — currently
 * `calculator_runs.session_id`.
 *
 * `crypto.randomUUID` exists only in secure contexts, so it is absent on any
 * plain-http preview as well as on older browsers. The timestamp fallback used
 * for the storage ids above is fine for a varchar column but would be rejected
 * by a uuid one, so build the uuid by hand instead: a weakly-seeded uuid still
 * satisfies the column, where `String(Date.now())` fails the whole request.
 */
export function randomUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // version 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variant 1 0 x x
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Read-or-mint an id in the given storage. Private-mode Safari and users who
 * block storage throw on access, so every path falls back to a throwaway id
 * rather than breaking the page.
 */
function stableId(storage: "local" | "session", key: string): string {
  if (typeof window === "undefined") return "";
  try {
    const store = storage === "local" ? window.localStorage : window.sessionStorage;
    const existing = store.getItem(key);
    if (existing) return existing;
    const fresh = randomId();
    store.setItem(key, fresh);
    return fresh;
  } catch {
    return randomId();
  }
}

export function getVisitorId(): string {
  return stableId("local", VISITOR_KEY);
}

export function getSessionId(): string {
  return stableId("session", SESSION_KEY);
}

/** Ids to attach to an instrumented fetch so the server can log the same session. */
export function trackingHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return { "x-lh-visitor": getVisitorId(), "x-lh-session": getSessionId() };
}

/**
 * Fire a funnel event. Uses sendBeacon so it survives the page being closed
 * mid-navigation, falling back to a keepalive fetch. Fully fire-and-forget:
 * a blocked request must never surface to the user.
 *
 * Client-side by design — crawlers do not run this, which is the cheapest
 * bot filter available. Server-side events (see the compute route) are the
 * ones that need the UA check.
 */
export function track(name: AnalyticsEventName, props: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      name,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      path: window.location.pathname,
      props,
    });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/v1/events", blob)) return;
    }

    void fetch("/api/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the page */
  }
}
