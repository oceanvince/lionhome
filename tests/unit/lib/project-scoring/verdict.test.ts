/**
 * V group — card verdict badge (test-set §6). buildVerdict is the upstream
 * contract the search card consumes: profit+location mean drives the tier
 * (>=6.5 green / >=4.5 amber / else orange); exit/rental are excluded; the
 * sentence is template-assembled (never LLM).
 */
import { describe, it, expect } from "vitest";
import { buildVerdict, scoreToBand, type ProjectScore } from "@/lib/project-scoring";

function mk(
  dimension: ProjectScore["dimension"],
  score: number | null,
  components: Record<string, number> = {}
): ProjectScore {
  return {
    dimension,
    score,
    band: scoreToBand(score),
    confidence: "high",
    components,
    basis: {},
    snapshotDate: "2026-06-01",
    scoreVersion: "v1.0.0",
  } as ProjectScore;
}

describe("buildVerdict — tier from profit+location mean", () => {
  it("V01 high mean → green / 值得入候选", () => {
    const v = buildVerdict([mk("profit", 7.0), mk("location", 7.0)]);
    expect(v.tier).toBe("green");
    expect(v.label).toBe("值得入候选");
  });

  it("V02 middle mean → amber / 值得比较", () => {
    const v = buildVerdict([mk("profit", 5.0), mk("location", 4.5)]); // mean 4.75
    expect(v.tier).toBe("amber");
    expect(v.label).toBe("值得比较");
  });

  it("V03 low mean → orange / 谨慎比较", () => {
    const v = buildVerdict([mk("profit", 3.0), mk("location", 4.0)]); // mean 3.5
    expect(v.tier).toBe("orange");
    expect(v.label).toBe("谨慎比较");
  });

  it("V04 boundary 6.5 is green (inclusive)", () => {
    expect(buildVerdict([mk("profit", 6.5), mk("location", 6.5)]).tier).toBe("green");
  });

  it("V05 boundary 4.5 is amber (inclusive)", () => {
    expect(buildVerdict([mk("profit", 4.5), mk("location", 4.5)]).tier).toBe("amber");
  });

  it("V06 only location scored → mean uses present dims", () => {
    const v = buildVerdict([mk("profit", null), mk("location", 6.0)]); // mean 6.0
    expect(v.tier).toBe("amber");
  });

  it("V07 both dims missing → orange / 谨慎比较", () => {
    const v = buildVerdict([mk("profit", null), mk("location", null)]);
    expect(v.tier).toBe("orange");
    expect(v.label).toBe("谨慎比较");
  });

  it("V07b empty scores → orange", () => {
    expect(buildVerdict([]).tier).toBe("orange");
  });
});

describe("buildVerdict — exit/rental excluded; template sentence", () => {
  it("V08 exit/rental do not move the tier and the tail is resident", () => {
    const withExit = buildVerdict([mk("profit", 7.0), mk("location", 7.0), mk("exit", 1.0)]);
    const withoutExit = buildVerdict([mk("profit", 7.0), mk("location", 7.0)]);
    expect(withExit.tier).toBe(withoutExit.tier); // exit=1.0 would drag the mean if counted
    expect(withExit.sentence).toContain("退出与租赁两维数据仍在接入，本次结论暂不计入");
  });

  it("V09 the only number in the sentence is the MRT walk minutes from components", () => {
    const v = buildVerdict([mk("profit", 6.0), mk("location", 6.0, { nearestMrtWalkMin: 6 })]);
    expect(v.sentence).toContain("最近地铁约 6 分钟");
    const digits = v.sentence.match(/\d+/g) ?? [];
    expect(digits).toEqual(["6"]); // no fabricated numbers
  });

  it("V09b omits the walk clause when components has no walk minutes", () => {
    const v = buildVerdict([mk("profit", 6.0), mk("location", 6.0)]);
    expect(v.sentence).not.toContain("最近地铁");
  });
});

// V10「相似盘估算」角标 → estimated:boolean、V11 主分 N/A 的卡片裁剪发生在搜索的
// 行映射层（ScoreView），不在 buildVerdict。V11 的 score=null→profitScore=null 已在
// tests/unit/lib/condo/search.test.ts 覆盖；V10 待出站 ACL 落地（测试集 §12-①）。
describe.todo("V10 estimated_similar → card estimated flag (needs out-bound ACL, §12-①)");
