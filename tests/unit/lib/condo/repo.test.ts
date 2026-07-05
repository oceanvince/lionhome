/**
 * Repo read-path guards (test-set §12-⑤/⑥): LIKE-wildcard escaping and the
 * "a DB error is not zero results" rule. Uses a tiny thenable fake of the
 * supabase query builder so no real DB is needed.
 */
import { describe, it, expect } from "vitest";
import {
  escapeLike,
  searchActiveProjects,
  getScoresForProjects,
  countActiveProjects,
} from "@/lib/condo/repo";

// Every builder method returns the builder; awaiting it resolves `result`.
function fakeDb(result: unknown) {
  const builder: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "or", "in", "order", "limit"]) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return builder as never;
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

  it("countActiveProjects returns the count, throws on error", async () => {
    expect(await countActiveProjects(fakeDb({ count: 7, error: null }))).toBe(7);
    await expect(
      countActiveProjects(fakeDb({ count: null, error: { message: "x" } }))
    ).rejects.toThrow();
  });
});
