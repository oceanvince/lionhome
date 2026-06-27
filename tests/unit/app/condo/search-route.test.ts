/**
 * S group — autocomplete route GET /api/v1/condo/search (test-set §2).
 *
 * Unit-tests the ROUTE's own logic: empty-query short-circuit, response shape,
 * row→result mapping, and the repo call args. The actual name/district ilike
 * matching lives in SQL (searchActiveProjects) and needs a DB — those cases are
 * marked it.todo (integration, §14b).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const searchActiveProjects = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/condo/repo", () => ({
  searchActiveProjects: (...a: unknown[]) => searchActiveProjects(...a),
}));

const { GET } = await import("@/app/api/v1/condo/search/route");
const { NextRequest } = await import("next/server");

const gazania = {
  id: "p1",
  slug: "the-gazania",
  name: "The Gazania",
  district: "D19",
  tenure: "永久地契",
  topYear: 2023,
  totalUnits: 250,
  developer: "SingHaiyi",
  lat: null,
  lng: null,
  psfMin: 1780,
  psfMax: 1980,
  psfPeriodEnd: null,
  status: "active",
};

const call = (q?: string) =>
  GET(
    new NextRequest(
      `http://localhost/api/v1/condo/search${q == null ? "" : `?q=${encodeURIComponent(q)}`}`
    )
  );

beforeEach(() => searchActiveProjects.mockReset());

describe("autocomplete route — S group", () => {
  it("S01 maps repo rows to the result shape (no id/status leaked)", async () => {
    searchActiveProjects.mockResolvedValue([gazania]);
    const json = await (await call("Gaz")).json();
    expect(json.ok).toBe(true);
    expect(json.data.results).toEqual([
      {
        slug: "the-gazania",
        name: "The Gazania",
        district: "D19",
        tenure: "永久地契",
        psfMin: 1780,
        psfMax: 1980,
      },
    ]);
  });

  it("S04 empty query short-circuits without hitting the repo", async () => {
    const json = await (await call()).json();
    expect(json).toEqual({ ok: true, data: { query: "", results: [] } });
    expect(searchActiveProjects).not.toHaveBeenCalled();
  });

  it("S05 whitespace-only query is treated as empty (trim) and skips the repo", async () => {
    const json = await (await call("   ")).json();
    expect(json.data.results).toEqual([]);
    expect(searchActiveProjects).not.toHaveBeenCalled();
  });

  it("S06 zero result returns ok:true with empty results (not an error)", async () => {
    searchActiveProjects.mockResolvedValue([]);
    const json = await (await call("NotARealCondo")).json();
    expect(json.ok).toBe(true);
    expect(json.data.results).toEqual([]);
  });

  it("S09 calls the repo with the trimmed term and limit 8", async () => {
    searchActiveProjects.mockResolvedValue([]);
    await call("  Gaz  ");
    expect(searchActiveProjects).toHaveBeenCalledWith(expect.anything(), "Gaz", 8);
  });

  it("S07 query longer than 80 chars → INVALID_INPUT, repo not hit", async () => {
    const json = await (await call("a".repeat(81))).json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_INPUT");
    expect(searchActiveProjects).not.toHaveBeenCalled();
  });

  it("X03 repo failure → SEARCH_INTERNAL_ERROR (200 envelope), not masked as empty", async () => {
    searchActiveProjects.mockImplementationOnce(() => {
      throw new Error("db down"); // repo failure — route's try/catch must absorb it
    });
    const res = await call("Gaz");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      ok: false,
      error: { code: "SEARCH_INTERNAL_ERROR", message: expect.any(String) },
    });
  });
});

// SQL/RLS-level behaviour (needs a DB). Wildcard escaping (S10/X04) is covered
// at the helper level in tests/unit/lib/condo/repo.test.ts.
describe("autocomplete — needs DB (integration, §14b)", () => {
  it.todo("S02 matches by district code (district.ilike)");
  it.todo("S03 case/space-insensitive matching (ilike)");
  it.todo("S08 stub/hidden excluded (status='active' + RLS)");
  it.todo("S11 street / postal fuzzy match — not implemented (§12-⑥)");
});
