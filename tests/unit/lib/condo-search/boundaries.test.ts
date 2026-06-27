/**
 * K (decoupling) + X01 (compliance) groups — static source checks (test-set
 * §10/§11). These guard architectural invariants by reading the search-part
 * source, so they hold even before the dedicated lib/condo-search/ module exists.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

// The search read path as it exists today (test-set §2/§3).
const SEARCH_SOURCES = [
  "lib/condo/search.ts",
  "app/api/v1/condo/search/route.ts",
  "app/api/v1/condo/projects/route.ts",
];

describe("K — search stays decoupled from the calculator & detail page", () => {
  it("K03 search code does not import the calculator/tax engines", () => {
    for (const f of SEARCH_SOURCES) {
      const src = read(f);
      expect(src, f).not.toMatch(/from\s+["']@\/lib\/calculator/);
      expect(src, f).not.toMatch(/from\s+["']@\/lib\/tax/);
      expect(src, f).not.toMatch(/computeV2/);
    }
  });

  it("K05 search code does not import detail-page components", () => {
    for (const f of SEARCH_SOURCES) {
      const src = read(f);
      expect(src, f).not.toMatch(/condo\/\[slug\]/);
      expect(src, f).not.toMatch(/report-view/);
    }
  });
});

describe("X01 — no valuation/估值 wording anywhere in the search path", () => {
  it("PSF is only ever a transaction range, never an appraisal", () => {
    const files = [...SEARCH_SOURCES, "lib/condo/repo.ts", "lib/condo/types.ts"];
    const forbidden = /valuation|估值|这套值|apprais/i;
    for (const f of files) {
      expect(read(f), f).not.toMatch(forbidden);
    }
  });
});

// Done elsewhere: B fallback → search.test.ts (computeFallback) + projects-route.test.ts;
// X03 error handling → repo.test.ts + route tests; X04/S10 escaping → repo.test.ts (escapeLike).
//
// Still pending the dedicated lib/condo-search/ bounded context + two-sided ACL
// (test-set §7/§8/§12-①) — placeholders so the suite keeps tracking the gap.
describe("A — in-bound ACL as a standalone module (request.ts, §12-①)", () => {
  it.todo("A03 sort aliases via SORT_MAP (psf → psf_asc) — route is still strict z.enum");
  it.todo("A06 SearchService receives a SearchQuery domain model, never the raw DTO");
});

describe("R — out-bound ACL & contract snapshot (row-mapper.ts, §12-①)", () => {
  it.todo("R01 null score → ScoreView{value:null,band:insufficient,estimated:false}");
  it.todo("R03 tags assembled (永久地契 / 2023 TOP / 250 户 / MRT 8 分钟)");
  it.todo("R04 DTO leaks no components/basis/regime/snake_case columns");
  it.todo("R05 ProjectCardDTO snapshot stable when DB columns change");
  it.todo("R06 verdict serialized as green|amber|orange enum, not the object");
});
