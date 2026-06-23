/**
 * Similar-project clustering — the PURE criteria for "is B a comp for A".
 *
 * The repo layer uses this to pick candidate similar projects (district +
 * price-band + TOP-age), then feeds their transactions into profit scoring as
 * a fallback when a project's own resale history is thin (SPEC §5.2).
 */

export interface ProjectClusterKey {
  district: string | null;
  psfMid: number | null; // (psf_min + psf_max) / 2
  topYear: number | null;
}

const PSF_BAND_RATIO = 0.15; // ±15% PSF
const TOP_AGE_TOLERANCE = 5; // within 5 years of TOP

/** Whether `cand` is a reasonable comp for `target`. Symmetric, deterministic. */
export function isSimilarProject(target: ProjectClusterKey, cand: ProjectClusterKey): boolean {
  if (target.district && cand.district && target.district !== cand.district) return false;

  if (target.psfMid !== null && cand.psfMid !== null) {
    const lo = target.psfMid * (1 - PSF_BAND_RATIO);
    const hi = target.psfMid * (1 + PSF_BAND_RATIO);
    if (cand.psfMid < lo || cand.psfMid > hi) return false;
  }

  if (target.topYear !== null && cand.topYear !== null) {
    if (Math.abs(target.topYear - cand.topYear) > TOP_AGE_TOLERANCE) return false;
  }

  return true;
}
