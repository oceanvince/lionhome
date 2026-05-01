import { describe, it, expect } from "vitest";
import { bandFromScore, computeScore } from "@/lib/scoring";

describe("bandFromScore", () => {
  it("maps to bands per PRD §7.4", () => {
    expect(bandFromScore(95)).toBe("hot");
    expect(bandFromScore(70)).toBe("warm");
    expect(bandFromScore(45)).toBe("cool");
    expect(bandFromScore(20)).toBe("cold");
  });
});

describe("computeScore", () => {
  it("clamps to [0, 100]", () => {
    const result = computeScore({
      timeline: 50,
      budget_clarity: 50,
      income_alignment: 50,
      confidence: 0,
      agent_history: 0,
      concern_specificity: 0,
      free_text_quality: 0,
    });
    expect(result.score).toBe(100);
    expect(result.band).toBe("hot");
  });
});
