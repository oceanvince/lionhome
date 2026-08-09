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
