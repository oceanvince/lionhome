/**
 * L / O04 / P / B groups — results-list route GET /api/v1/condo/projects
 * (test-set §3/§4/§5/§9). Unit-tests the ROUTE: zod validation, district
 * normalization, the fallback semantics it derives, and the error envelope.
 * listCards is mocked; computeFallback is the real pure helper.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const listCards = vi.fn();
const countActiveProjects = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/condo/repo", () => ({
  countActiveProjects: (...a: unknown[]) => countActiveProjects(...a),
}));
vi.mock("@/lib/condo/search", async (orig) => ({
  ...(await orig<typeof import("@/lib/condo/search")>()),
  listCards: (...a: unknown[]) => listCards(...a),
}));

const { GET } = await import("@/app/api/v1/condo/projects/route");
const { NextRequest } = await import("next/server");

const card = { slug: "the-gazania", name: "The Gazania", district: "D19" };
const call = (qs = "") => GET(new NextRequest(`http://localhost/api/v1/condo/projects${qs}`));

beforeEach(() => {
  listCards.mockReset();
  countActiveProjects.mockReset();
  listCards.mockResolvedValue([card]);
  countActiveProjects.mockResolvedValue(50); // populated catalogue by default
});

describe("projects route — L group", () => {
  it("L01 no params → ok:true, {cards,count,fallback}, defaults passed to listCards", async () => {
    const json = await (await call()).json();
    expect(json).toEqual({ ok: true, data: { cards: [card], count: 1, fallback: "none" } });
    expect(listCards).toHaveBeenCalledWith(expect.anything(), {
      district: undefined,
      sort: "profit",
      limit: 30,
    });
  });

  it("L03 district is forwarded to listCards", async () => {
    await call("?district=D19");
    expect(listCards).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ district: "D19" })
    );
  });

  it("L04 empty result (populated catalogue, no filter) → count 0, fallback none", async () => {
    listCards.mockResolvedValue([]);
    const json = await (await call()).json();
    expect(json.data).toEqual({ cards: [], count: 0, fallback: "none" });
  });

  it("L05 limit=60 passes; limit=0 and limit=61 are INVALID_INPUT", async () => {
    expect((await (await call("?limit=60")).json()).ok).toBe(true);
    listCards.mockClear(); // ignore the valid call above; bad inputs must not reach the repo
    for (const bad of ["?limit=0", "?limit=61", "?limit=abc"]) {
      const json = await (await call(bad)).json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe("INVALID_INPUT");
      expect(json.error.fields[0].field).toBe("limit");
    }
    expect(listCards).not.toHaveBeenCalled();
  });
});

describe("projects route — O04 sort validation", () => {
  it("valid sorts pass through", async () => {
    for (const s of ["profit", "psf_asc", "top_desc"]) {
      expect((await (await call(`?sort=${s}`)).json()).ok).toBe(true);
    }
  });

  it("O04 unknown sort → INVALID_INPUT (current strict behaviour; TD §4.2 wants fallback, §12-②)", async () => {
    const json = await (await call("?sort=foobar")).json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_INPUT");
  });
});

describe("projects route — P group (district ACL)", () => {
  it("P01 district normalized: d19 → D19 forwarded to listCards", async () => {
    await call("?district=d19");
    expect(listCards).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ district: "D19" })
    );
  });

  it("P02 malformed district rejected by ^D\\d{1,2}$ regex", async () => {
    for (const bad of ["?district=XYZ", "?district=D999", "?district=ABCDEFGHIJK"]) {
      const json = await (await call(bad)).json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe("INVALID_INPUT");
    }
    expect(listCards).not.toHaveBeenCalled();
  });

  // Pagination still pending — test-set §12-③.
  it.todo("P03 page=2&pageSize=12 returns rows 13–24");
  it.todo("P04 pageSize cap 24");
  it.todo("P05 page cap 200");
  it.todo("P06 response carries total");
});

describe("projects route — B group fallback (§12-④)", () => {
  it("B01 few active projects → fallback cold_start", async () => {
    countActiveProjects.mockResolvedValue(5);
    const json = await (await call()).json();
    expect(json.data.fallback).toBe("cold_start");
  });

  it("B02 populated catalogue + filtered query with no hits → zero_result", async () => {
    listCards.mockResolvedValue([]);
    const json = await (await call("?district=D28")).json();
    expect(json.data.fallback).toBe("zero_result");
  });
});

describe("projects route — X03 error handling (§12-⑤)", () => {
  it("a repo failure → SEARCH_INTERNAL_ERROR (200 envelope), not an empty list", async () => {
    listCards.mockImplementationOnce(() => {
      throw new Error("db down"); // repo failure — route's try/catch must absorb it
    });
    const res = await call();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("SEARCH_INTERNAL_ERROR");
  });
});
