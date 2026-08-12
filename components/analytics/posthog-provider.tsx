"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

/**
 * PostHog bootstrap. Covers the half of the funnel the database can't see:
 * who arrives, where they come from, and where they drop out before the
 * calculation that would have been persisted.
 *
 * DORMANT: NEXT_PUBLIC_POSTHOG_KEY is deliberately unset, so nothing is sent
 * and no third-party script loads. The wiring is kept so analytics can be
 * switched on later without rebuilding it.
 *
 * BEFORE SETTING THE KEY: the privacy policy (app/(marketing)/legal/privacy)
 * §4 and §8 currently state that no third-party tracking happens. Enabling
 * this makes that false — update the policy in the same deploy.
 */
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) return;
    // Manual capture: the SPA router changes URLs without a page load.
    const qs = searchParams?.toString();
    posthog.capture("$pageview", {
      $current_url: window.location.origin + pathname + (qs ? `?${qs}` : ""),
    });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || posthog.__loaded) return;

    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      // Pageviews are captured manually above; autocapture would double-count.
      capture_pageview: false,
      capture_pageleave: true,
      persistence: "localStorage+cookie",
      // Off by default: the calculator collects income, cash and CPF balances, and
      // session replay is enabled project-side in PostHog's dashboard, not here.
      // Turning it on is a deliberate decision that needs a privacy-policy update.
      disable_session_recording: true,
      // Belt and braces — if recording is ever switched on, values stay masked.
      session_recording: {
        maskAllInputs: true,
      },
    });
  }, []);

  return (
    <>
      {/* useSearchParams opts the subtree into CSR bailout; isolate it here so
          the rest of the app keeps prerendering. */}
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      {children}
    </>
  );
}
