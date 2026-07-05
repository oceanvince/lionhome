/**
 * Verdict — the one-line, three-tier decision badge (SPEC §4.1.2).
 *
 * MVP rule (SPEC §4.2): only profit + location feed the verdict; exit/rental
 * are greyed-out「即将上线」and excluded. Fit (适配度) is personalized and
 * overlaid by the page, not baked into the cached verdict.
 *
 * The sentence is TEMPLATE-ASSEMBLED from band buckets — never LLM (SPEC §5),
 * so it can never hallucinate a number.
 */

import { type ProjectScore, type Verdict, type Band } from "./types";

const PROFIT_PHRASE: Record<Band, string> = {
  excellent: "盈利记录突出",
  good: "盈利记录不错但算不上突出",
  fair: "盈利数据中等",
  poor: "盈利偏弱",
  insufficient: "盈利数据暂不足",
};

function locationPhrase(score: ProjectScore): string {
  const band = score.band;
  const walk = score.components?.nearestMrtWalkMin;
  const head =
    band === "excellent"
      ? "地段优秀"
      : band === "good"
        ? "地段不错"
        : band === "fair"
          ? "地段一般"
          : band === "poor"
            ? "地段偏弱"
            : "地段数据暂不足";
  if (typeof walk === "number") return `${head}，最近地铁约 ${walk} 分钟`;
  return head;
}

const TAIL = "退出与租赁两维数据仍在接入，本次结论暂不计入。";

function find(scores: ProjectScore[], dim: ProjectScore["dimension"]): ProjectScore | undefined {
  return scores.find((s) => s.dimension === dim);
}

/**
 * Build the verdict from the scored dimensions. Tier comes from the mean of
 * the available (profit, location) scores; insufficient dims are skipped.
 */
export function buildVerdict(scores: ProjectScore[]): Verdict {
  const profit = find(scores, "profit");
  const location = find(scores, "location");

  const present = [profit?.score, location?.score].filter(
    (s): s is number => typeof s === "number"
  );
  const mean = present.length ? present.reduce((a, b) => a + b, 0) / present.length : null;

  let tier: Verdict["tier"];
  let label: string;
  if (mean === null) {
    tier = "orange";
    label = "谨慎比较";
  } else if (mean >= 6.5) {
    tier = "green";
    label = "值得入候选";
  } else if (mean >= 4.5) {
    tier = "amber";
    label = "值得比较";
  } else {
    tier = "orange";
    label = "谨慎比较";
  }

  const parts: string[] = [];
  if (profit) parts.push(PROFIT_PHRASE[profit.band]);
  if (location) parts.push(locationPhrase(location));
  parts.push(TAIL);

  return { tier, label, sentence: parts.join("。").replace("。。", "。") };
}
