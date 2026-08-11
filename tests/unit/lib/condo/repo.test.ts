/**
 * Repo read-path guards (test-set §12-⑤/⑥): LIKE-wildcard escaping and the
 * "a DB error is not zero results" rule. Uses a tiny thenable fake of the
 * supabase query builder so no real DB is needed.
 */
import { describe, it, expect } from "vitest";
import {
  escapeLike,
  sanitizeOrTerm,
  searchActiveProjects,
  getScoresForProjects,
  countActiveProjects,
  getActiveProjectBySlug,
  getLatestScores,
  getRecentTransactions,
  getAmenities,
} from "@/lib/condo/repo";

/**
 * Every terminal in the supabase builder is thenable, so the fake can return
 * itself from all of them. Missing an entry here makes the call fail with an
 * opaque "x is not a function" rather than the behaviour under test — keep it
 * in step with the methods the repo actually chains.
 */
const BUILDER_METHODS = [
  "from",
  "select",
  "eq",
  "or",
  "in",
  "is",
  "not",
  "gte",
  "lt",
  "order",
  "limit",
  "maybeSingle",
  "single",
];

// Every builder method returns the builder; awaiting it resolves `result`.
function fakeDb(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const m of BUILDER_METHODS) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return builder as never;
}

/**
 * Same fake, but it keeps the arguments. The filter string handed to `.or()` is
 * the thing worth asserting — a builder that discards it cannot catch a term
 * that rewrites the filter instead of searching it.
 */
function capturingDb(result: unknown) {
  const captured: Record<string, unknown[]> = {};
  const builder: Record<string, unknown> = {};
  for (const m of BUILDER_METHODS) {
    builder[m] = (...args: unknown[]) => {
      (captured[m] ??= []).push(...args);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return { db: builder as never, captured };
}

const projectRow = {
  id: "p1",
  slug: "the-gazania",
  name: "The Gazania",
  district: "D19",
  tenure: "永久地契",
  top_year: 2023,
  total_units: 250,
  developer: "SingHaiyi",
  lat: null,
  lng: null,
  psf_min: 1780,
  psf_max: 1980,
  psf_period_end: null,
  status: "active",
};

describe("escapeLike — S10/X04 wildcard injection", () => {
  it("escapes %, _ and backslash so they match literally", () => {
    expect(escapeLike("%")).toBe("\\%");
    expect(escapeLike("_")).toBe("\\_");
    expect(escapeLike("a%b_c")).toBe("a\\%b\\_c");
    expect(escapeLike("100\\")).toBe("100\\\\");
  });
  it("leaves ordinary terms untouched", () => {
    expect(escapeLike("Gazania")).toBe("Gazania");
    expect(escapeLike("Upper Serangoon")).toBe("Upper Serangoon");
  });
});

describe("sanitizeOrTerm — PostgREST .or() filter injection", () => {
  it("drops the characters PostgREST reads as structure", () => {
    expect(sanitizeOrTerm("zzz,name.not.is.null")).toBe("zzz name.not.is.null");
    expect(sanitizeOrTerm("a(b)c")).toBe("a b c");
    expect(sanitizeOrTerm("Kovan, D19")).toBe("Kovan D19");
  });

  it("keeps dots — PostgREST splits a triple on the first two only", () => {
    expect(sanitizeOrTerm("St. Regis")).toBe("St. Regis");
  });

  it("leaves ordinary terms untouched and trims", () => {
    expect(sanitizeOrTerm("The Gazania")).toBe("The Gazania");
    expect(sanitizeOrTerm("  Upper   Serangoon  ")).toBe("Upper Serangoon");
    expect(sanitizeOrTerm("   ")).toBe("");
  });

  it("cannot inject a second condition into the built filter", async () => {
    const { db, captured } = capturingDb({ data: [], error: null });
    await searchActiveProjects(db, "zzz,name.not.is.null");

    const filter = String(captured.or?.[0] ?? "");
    // Exactly the two conditions the query is supposed to have, both of them
    // ilike. The words "not.is.null" survive inside the pattern, which is the
    // point: they are searched as text rather than parsed as a third condition.
    const conditions = filter.split(",");
    expect(conditions).toHaveLength(2);
    expect(conditions[0]).toMatch(/^name\.ilike\./);
    expect(conditions[1]).toMatch(/^district\.ilike\./);
  });

  it("does not let a comma in a real place name break the filter", async () => {
    const { db, captured } = capturingDb({ data: [], error: null });
    await searchActiveProjects(db, "Kovan, D19");

    const filter = String(captured.or?.[0] ?? "");
    expect(filter.split(",")).toHaveLength(2);
    expect(filter).toContain("Kovan D19");
  });
});

describe("read path surfaces DB errors instead of masking them (§12-⑤)", () => {
  it("searchActiveProjects throws on a DB error (not an empty list)", async () => {
    await expect(
      searchActiveProjects(fakeDb({ data: null, error: { message: "boom" } }), "Gaz")
    ).rejects.toThrow(/boom/);
  });

  it("searchActiveProjects maps rows on success", async () => {
    const rows = await searchActiveProjects(fakeDb({ data: [projectRow], error: null }), "Gaz");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.slug).toBe("the-gazania");
  });

  it("getScoresForProjects throws on a DB error", async () => {
    await expect(
      getScoresForProjects(fakeDb({ data: null, error: { message: "down" } }), ["p1"])
    ).rejects.toThrow(/down/);
  });

  it("the detail path throws on a DB error rather than reporting 'no such project'", async () => {
    // These four used to return null/[] on error, so an outage rendered as
    // "这个盘我们还没收录" — the same rule the search path already followed.
    await expect(
      getActiveProjectBySlug(fakeDb({ data: null, error: { message: "down" } }), "the-gazania")
    ).rejects.toThrow(/down/);
    await expect(
      getLatestScores(fakeDb({ data: null, error: { message: "down" } }), "p1")
    ).rejects.toThrow(/down/);
    await expect(
      getRecentTransactions(fakeDb({ data: null, error: { message: "down" } }), "p1")
    ).rejects.toThrow(/down/);
    await expect(
      getAmenities(fakeDb({ data: null, error: { message: "down" } }), "p1")
    ).rejects.toThrow(/down/);
  });

  it("still reports a genuinely absent project as null, not as an error", async () => {
    expect(await getActiveProjectBySlug(fakeDb({ data: null, error: null }), "nope")).toBeNull();
    expect(await getAmenities(fakeDb({ data: [], error: null }), "p1")).toEqual([]);
  });

  it("chunks a large id set so the .in() filter never overruns the URL limit", async () => {
    // The profit sort scans up to MAX_SCAN = 3000 projects; one .in() with that
    // many uuids is ~110 KB of query string and is rejected by the proxy long
    // before Postgres sees it.
    const { db, captured } = capturingDb({ data: [], error: null });
    const ids = Array.from({ length: 3000 }, (_, i) => `id-${i}`);

    await getScoresForProjects(db, ids);

    const batches = (captured.in ?? []).filter(Array.isArray) as string[][];
    expect(batches.length).toBe(15); // 3000 / 200
    expect(Math.max(...batches.map((b) => b.length))).toBeLessThanOrEqual(200);
    // Every id is asked for exactly once — chunking must not drop a project.
    expect(batches.flat()).toHaveLength(3000);
    expect(new Set(batches.flat()).size).toBe(3000);
  });

  it("issues a single request when the set is small", async () => {
    const { db, captured } = capturingDb({ data: [], error: null });
    await getScoresForProjects(db, ["p1", "p2"]);
    expect((captured.in ?? []).filter(Array.isArray)).toHaveLength(1);
  });

  it("countActiveProjects returns the count, throws on error", async () => {
    expect(await countActiveProjects(fakeDb({ count: 7, error: null }))).toBe(7);
    await expect(
      countActiveProjects(fakeDb({ count: null, error: { message: "x" } }))
    ).rejects.toThrow();
  });
});
