import posthog from "posthog-js";

/**
 * Funnel events. The database only sees completed calculations; these cover the
 * steps before that, so a drop-off between step 2 and step 3 is visible rather
 * than inferred.
 */
export type AnalyticsEvent =
  | "calc_started" // hero CTA tapped
  | "calc_step_completed" // a questionnaire step advanced
  | "calc_submitted" // compute request fired
  | "calc_result_viewed" // result screen rendered
  | "calc_failed" // compute errored out
  | "calc_tier_switched" // user explored a different price tier
  | "calc_restarted" // started over from the result screen
  | "advisor_cta_clicked" // WhatsApp button tapped (consent may be missing)
  | "advisor_consent_missing" // tapped without ticking PDPA consent
  | "advisor_shared"; // actually handed off to WhatsApp

/**
 * Fire-and-forget. Safe before init and when NEXT_PUBLIC_POSTHOG_KEY is unset,
 * so call sites never need to guard.
 *
 * Properties must stay non-identifying: buckets and labels, never raw income,
 * cash, or CPF figures — those live in the database under the privacy policy's
 * anonymous-storage terms, not in a third-party analytics tool.
 */
export function track(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  try {
    if (!posthog.__loaded) return;
    posthog.capture(event, properties);
  } catch {
    /* analytics must never break the page */
  }
}
