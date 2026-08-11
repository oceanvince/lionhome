/**
 * The radar used to place a vertex at 1.6/10 for any dimension with no score,
 * so the filled shape asserted a reading that does not exist — and 1.6 reads as
 * "scored badly", not as "no data". These lock in the honest behaviour: unscored
 * axes contribute no vertex, and fewer than three readings draw no polygon.
 */
import { describe, expect, it } from "vitest";
// react-dom/server rather than @testing-library/react: the latter needs a
// @testing-library/dom peer this project does not carry, and a static render is
// all the radar needs — it has no interactive state.
import { renderToStaticMarkup } from "react-dom/server";
import { CondoReportView } from "@/app/(tools)/condo/[slug]/report-view";
import type { CondoReport } from "@/lib/condo/types";
import type { Dimension, ProjectScore } from "@/lib/project-scoring";

function score(dimension: Dimension, value: number | null): ProjectScore {
  return {
    dimension,
    score: value,
    band: value == null ? "unknown" : "good",
    confidence: value == null ? "low" : "high",
    components: {},
    basis: {},
    snapshotDate: "2026-06-01",
    scoreVersion: "v1",
  } as ProjectScore;
}

function report(scores: ProjectScore[]): CondoReport {
  return {
    project: {
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
    },
    scores,
    verdict: { tier: "green", label: "值得入候选", sentence: "测试结论。" },
    amenities: { mrt: [], schools: [], other: [] },
    transactions: [],
    snapshotDate: "2026-06-01",
    scoreVersion: "v1",
    disclaimers: ["测试免责声明"],
  };
}

/**
 * The radar's data polygon. The two grid polygons are drawn with stroke-width 1
 * on a stroke-less group, so stroke-width 2 identifies the data shape.
 */
function dataPolygonPoints(report: CondoReport): string[] | null {
  const html = renderToStaticMarkup(<CondoReportView report={report} />);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const polygon = Array.from(doc.querySelectorAll("polygon")).find(
    (p) => p.getAttribute("stroke-width") === "2"
  );
  if (!polygon) return null;
  return polygon.getAttribute("points")!.trim().split(/\s+/);
}

describe("report radar", () => {
  it("draws one vertex per scored dimension when all four have readings", () => {
    const points = dataPolygonPoints(
      report([score("profit", 7), score("location", 6), score("exit", 5), score("rental", 4)])
    );
    expect(points).toHaveLength(4);
  });

  it("leaves unscored dimensions out of the shape instead of inventing 1.6", () => {
    const points = dataPolygonPoints(
      report([score("profit", 7), score("location", 6), score("exit", 5), score("rental", null)])
    );
    expect(points).toHaveLength(3);

    // The rental axis runs left from the centre at x=110, so it is the only one
    // that can produce x < 110. A fabricated 1.6 reading used to put a vertex
    // at x ≈ 97; with the dimension unscored, nothing should sit left of centre.
    expect(points!.some((p) => Number(p.split(",")[0]) < 110)).toBe(false);
  });

  it("draws no polygon at all when fewer than three dimensions are scored", () => {
    const points = dataPolygonPoints(
      report([
        score("profit", 7),
        score("location", null),
        score("exit", null),
        score("rental", null),
      ])
    );
    expect(points).toBeNull();
  });
});
