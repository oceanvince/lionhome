/**
 * Run 58 persona fixtures through computeV2 and emit a markdown report.
 *
 *   npx tsx scripts/run-personas.ts
 *
 * Output: docs/V2_TEST_REPORT.md
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { ALL_PERSONAS, toSolveParams, type Persona } from "../tests/personas/personas";
import { computeV2, type V2ComputeParams } from "@/lib/calculator/v2-compute";
import type { V2ComputeResult } from "@/lib/calculator/v2-types";
import { computeBreakEven, estimateMedianRent } from "@/lib/finance";

// ─── helpers ──────────────────────────────────────────────────────────

function fmtSGD(n: number): string {
  return `S$ ${Math.round(n).toLocaleString("en-US")}`;
}
function fmtWan(n: number): string {
  if (!n || n <= 0) return "—";
  return `${Math.round(n / 10_000)} 万`;
}
function fmtPct(n: number, digits = 1): string {
  if (n === null || n === undefined) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}
function fmtRange(low: number, high: number): string {
  return `${fmtWan(low)} – ${fmtWan(high)}`;
}

// ─── compute per persona ──────────────────────────────────────────────

interface PersonaResult {
  persona: Persona;
  v2: V2ComputeResult;
  /** Re-computed break-even with rentOverride (when persona supplies it). */
  breakEvenOverride?: number | null;
  flags: string[];
}

function flagsFor(p: Persona, v2: V2ComputeResult): string[] {
  const flags: string[] = [];

  // tiers degenerate / collapsed
  if (v2.degenerate) flags.push("⚠️ tiers degenerate (三档收敛)");

  const b = v2.tiers.balanced.cash_breakdown;
  const a = v2.tiers.aggressive.cash_breakdown;
  const c = v2.tiers.comfortable.cash_breakdown;

  // infeasibility on the recommended tier
  //   - infeasible_reason: 真不可行（连首付都付不起）
  //   - cash_gap > 0 但无 reason: 交易能完成，只是应急金不够；分两档区分
  if (b.infeasible_reason) {
    flags.push(`❌ balanced infeasible: ${b.infeasible_reason}`);
  } else {
    const txnCash = b.transaction_cash_total;
    const availableCash = p.input.availableCash;
    if (availableCash < txnCash) {
      flags.push(`❌ balanced transaction cash short: ${fmtSGD(txnCash - availableCash)}`);
    } else if (b.cash_gap > 0) {
      flags.push(`ℹ balanced emergency fund short: ${fmtSGD(b.cash_gap)} (交易可行，应急金不够)`);
    }
  }

  // even the aggressive (max-stress) tier infeasible → "really can't buy"
  if (a.infeasible_reason === "TDSR_EXCEEDED") flags.push("❌ aggressive also TDSR-blocked");
  if (a.price <= 0) flags.push("❌ aggressive price = 0");

  // numerical surprises
  if (a.price === b.price && b.price === c.price && b.price > 0) {
    flags.push("ℹ tiers numerically identical");
  }

  // break-even sanity
  if (v2.break_even) {
    const bal = v2.break_even.tiers.balanced;
    if (bal.clamped === "above") flags.push(`⚠️ balanced break-even clamped above 15%`);
    if (bal.clamped === "below") flags.push(`ℹ balanced break-even clamped below −10% (买远稳赢)`);
    if (bal.g_star > 0.05) flags.push(`⚠️ balanced g* > 5% (赌注极大)`);
    if (bal.g_star < -0.02) flags.push(`ℹ balanced g* < −2% (轻微下跌也划算)`);
  }

  // expected band checks — "feasible" = transaction可行（首付/税付得起），不含应急金缓冲
  if (p.expect) {
    const txnAffordable = !b.infeasible_reason && p.input.availableCash >= b.transaction_cash_total;
    if (p.expect.feasible === true && !txnAffordable) {
      flags.push("🔴 expected feasible but transaction not affordable");
    }
    if (p.expect.feasible === false && txnAffordable) {
      flags.push("🔴 expected infeasible but transaction is affordable");
    }
    if (p.expect.balancedMidRange) {
      const [lo, hi] = p.expect.balancedMidRange;
      const mid = (v2.tiers.balanced.price_low + v2.tiers.balanced.price_high) / 2;
      if (mid < lo || mid > hi) {
        flags.push(`🔴 balanced midpoint ${fmtWan(mid)} outside expected ${fmtRange(lo, hi)}`);
      }
    }
    if (p.expect.breakEvenBalanced && v2.break_even) {
      const [lo, hi] = p.expect.breakEvenBalanced;
      const g = v2.break_even.tiers.balanced.g_star;
      if (g < lo || g > hi) {
        flags.push(`🔴 balanced g* ${fmtPct(g)} outside expected ${fmtPct(lo)} – ${fmtPct(hi)}`);
      }
    }
  }

  return flags;
}

function runOne(p: Persona): PersonaResult {
  const solveParams = toSolveParams(p.input);
  const v2Params: V2ComputeParams = {
    solveParams,
    isFirstProperty: p.input.existingProperties === 0,
    holdingYears: p.input.holdingYears,
    rate: p.input.rate,
    taxRatesVersion: "persona-test",
  };
  const v2 = computeV2(v2Params);

  // Recompute balanced break-even with rentOverride (if any)
  let breakEvenOverride: number | null | undefined = undefined;
  if (p.input.rentOverride !== undefined && v2.break_even && v2.tiers.balanced.midpoint > 0) {
    const balancedOutput = {
      // craft a minimal CalcOutputs-shaped subset; we already have all the numbers
      max_price: v2.tiers.balanced.midpoint,
      loan_amount: v2.tiers.balanced.cash_breakdown.loan_amount,
      ltv_cap: v2.tiers.balanced.cash_breakdown.ltv_cap,
      down_payment: {
        cash: v2.tiers.balanced.cash_breakdown.down_payment_cash,
        cpf: v2.tiers.balanced.cash_breakdown.down_payment_cpf,
      },
      bsd: v2.tiers.balanced.cash_breakdown.bsd,
      absd: v2.tiers.balanced.cash_breakdown.absd,
      absd_rate: v2.tiers.balanced.cash_breakdown.absd_rate,
      legal_fees_est: v2.tiers.balanced.cash_breakdown.legal_fees_est,
      total_upfront_cash: v2.tiers.balanced.cash_breakdown.transaction_cash_total,
      monthly_payment: v2.tiers.balanced.monthly,
      tdsr_utilization: v2.tiers.balanced.cash_breakdown.tdsr_utilization,
      absd_warning: false,
      infeasible_reason: v2.tiers.balanced.cash_breakdown.infeasible_reason,
      scenarios: [],
    };
    const upfrontCash =
      balancedOutput.down_payment.cash +
      balancedOutput.bsd +
      balancedOutput.absd +
      balancedOutput.legal_fees_est;
    const r = computeBreakEven({
      price: balancedOutput.max_price,
      loanAmount: balancedOutput.loan_amount,
      upfrontCash,
      monthlyRent: p.input.rentOverride,
      holdingYears: p.input.holdingYears,
      tenureYears: p.input.tenureYears,
      rate: p.input.rate,
    });
    breakEvenOverride = r.g_star;
  }

  const flags = flagsFor(p, v2);
  return { persona: p, v2, breakEvenOverride, flags };
}

const results: PersonaResult[] = ALL_PERSONAS.map(runOne);

// ─── render markdown ──────────────────────────────────────────────────

function rowFor(r: PersonaResult): string {
  const p = r.persona;
  const t = r.v2.tiers;
  const be = r.v2.break_even;
  const bgStar = be ? fmtPct(be.tiers.balanced.g_star) : "—";

  const balPrice = t.balanced.midpoint;
  const balPct = fmtPct(t.balanced.monthly_pct_of_income);
  const bal = t.balanced.cash_breakdown;
  const txnCash = bal.transaction_cash_total;
  const availCash = r.persona.input.availableCash;
  let feasibility: string;
  if (bal.infeasible_reason) {
    feasibility = `❌ ${bal.infeasible_reason}`;
  } else if (availCash < txnCash) {
    feasibility = `❌ 差 ${fmtSGD(txnCash - availCash)}`;
  } else if (bal.cash_gap > 0) {
    feasibility = `⚠️ 应急金差 ${fmtSGD(bal.cash_gap)}`;
  } else {
    feasibility = "✓";
  }

  return [
    p.id,
    p.label.replace(/\|/g, "\\|"),
    fmtRange(t.comfortable.price_low, t.comfortable.price_high),
    `${fmtRange(t.balanced.price_low, t.balanced.price_high)} (${balPct})`,
    fmtRange(t.aggressive.price_low, t.aggressive.price_high),
    `${fmtWan(balPrice)} → ${fmtSGD(t.balanced.cash_breakdown.total_cash_needed)}`,
    feasibility,
    bgStar,
    r.flags.length ? r.flags.join("<br>") : "",
  ].join(" | ");
}

function sectionFor(cat: string, results: PersonaResult[]): string {
  const cats: Record<string, string> = {
    A: "A · 典型画像（10）— 健康路径",
    B: "B · 身份边界（15）— ABSD 决策核心区",
    C: "C · LTV 悬崖（8）— 年龄/年限切换点",
    D: "D · 现金/收入失衡（12）— 病态画像",
    E: "E · 参数微调（8）— 结果页 4 参数边界",
    F: "F · 健壮性（5）— 系统输入边界",
  };
  const subset = results.filter((r) => r.persona.category === cat);
  const lines = [
    `## ${cats[cat]}`,
    "",
    `> ${cat === "A" ? "目的：sanity check 主流场景算得对、UX 通顺。如有 🔴 旗，先停下来。" : ""}`,
    `> ${cat === "B" ? "目的：揭示身份差异威力。看 SC vs PR vs 外籍同收入下能买多少。" : ""}`,
    `> ${cat === "C" ? "目的：抓 LTV 75%→55% 切换瞬间的连续性。C01 vs C02 应明显跳水。" : ""}`,
    `> ${cat === "D" ? "目的：揭示三档区间在病态画像下行为。最容易暴露不 make sense 的输出。" : ""}`,
    `> ${cat === "E" ? "目的：4 参数（持有/利率/租金/年限）改动是否合理联动。" : ""}`,
    `> ${cat === "F" ? "目的：极端输入下引擎不应崩。schema 拦截另在 API 层。" : ""}`,
    "",
    "| ID | 画像 | 舒适区 | 平衡区 (月供占比) | 压力区 | 平衡中点 → 需现金 | 现金可行 | g* 平衡 | 旗 |",
    "|---|---|---|---|---|---|---|---|---|",
    ...subset.map(rowFor),
    "",
  ].filter(Boolean);
  return lines.join("\n");
}

const totalFlagged = results.filter((r) => r.flags.some((f) => f.startsWith("🔴"))).length;
const totalWarnings = results.filter((r) =>
  r.flags.some((f) => f.startsWith("⚠️") || f.startsWith("❌"))
).length;

const summary = [
  `# V2 Calculator Persona Test Report`,
  ``,
  `> 自动生成。源：[tests/personas/personas.ts](../tests/personas/personas.ts)`,
  `> 跑：\`npx tsx scripts/run-personas.ts\``,
  ``,
  `**总数：${results.length}** | **🔴 与预期不符：${totalFlagged}** | **⚠️/❌ 有边界信号：${totalWarnings}**`,
  ``,
  `## 旗的含义`,
  ``,
  `- 🔴 expected ... — persona 自带的期望与实际不符（需要修期望或修引擎）`,
  `- ⚠️ — 系统正常但值得人工眼检（degenerate、cash gap、g* 极端）`,
  `- ❌ — 不可行（TDSR_EXCEEDED / INSUFFICIENT_CASH / price=0）`,
  `- ℹ — 中性信号（三档同值不一定是 bug；clamped below 表示买稳赢）`,
  ``,
  `## 列说明`,
  ``,
  `- **舒适/平衡/压力区**: 房价区间，单位"万"SGD`,
  `- **月供占比**: 压力利率 4%/25 年下月供占月入比例`,
  `- **平衡中点 → 需现金**: 用区间中点的房价算出的"应有现金"（含 12 月应急金）`,
  `- **现金可行**: ✓ = 现金 ≥ 应有；"差 X" = 差额`,
  `- **g\\* 平衡**: 平衡区 break-even 涨幅。clamped=below/above 表示二分搜索撞边界`,
  ``,
  `---`,
  ``,
];

const sections = ["A", "B", "C", "D", "E", "F"].map((c) => sectionFor(c, results));

// E 类需要额外展示 break-even override 对比
const eExtras = (() => {
  const eWithOverride = results.filter(
    (r) => r.persona.category === "E" && r.breakEvenOverride !== undefined
  );
  if (eWithOverride.length === 0) return "";
  const lines = [
    `### E 类：自定义租金的 break-even 对比`,
    ``,
    `用户在结果页手动改租金时，break-even 涨幅会变。这里展示 rent override 与默认估算的差。`,
    ``,
    `| ID | 默认 g* | 自定义租金 g* | 含义 |`,
    `|---|---|---|---|`,
    ...eWithOverride.map((r) => {
      const def = r.v2.break_even!.tiers.balanced.g_star;
      const ovr = r.breakEvenOverride!;
      const delta = ovr - def;
      const meaning =
        delta > 0.01
          ? "租金更低 → g\\* 更高（更难)"
          : delta < -0.01
            ? "租金更高 → g\\* 更低（更容易）"
            : "差异不大";
      return `| ${r.persona.id} | ${fmtPct(def)} | ${fmtPct(ovr)} | ${meaning} |`;
    }),
    ``,
  ];
  return lines.join("\n");
})();

// 异常清单 section
const allFlagged = results.filter((r) => r.flags.length > 0);
const flagsSection = (() => {
  if (allFlagged.length === 0) return "";
  const lines = [
    `## 异常清单（${allFlagged.length} 个 persona 有旗）`,
    ``,
    `按严重程度倒序：🔴 红 > ❌ 不可行 > ⚠️ 警告 > ℹ 信息`,
    ``,
    `| ID | 画像 | 旗 |`,
    `|---|---|---|`,
    ...allFlagged
      .sort((a, b) => {
        const score = (r: PersonaResult) =>
          r.flags.reduce(
            (s, f) =>
              s +
              (f.startsWith("🔴") ? 1000 : f.startsWith("❌") ? 100 : f.startsWith("⚠️") ? 10 : 1),
            0
          );
        return score(b) - score(a);
      })
      .map(
        (r) =>
          `| ${r.persona.id} | ${r.persona.label.replace(/\|/g, "\\|")} | ${r.flags.join("<br>")} |`
      ),
    ``,
  ];
  return lines.join("\n");
})();

// 跨类对比 — 同收入不同身份的 ABSD 影响对比
const compareTable = (() => {
  const buckets = [
    { label: "12K, 30万 cash, 100K CPF, 32岁 首套", ids: ["B09", "B11", "A05"] }, // SC/SC/PR
    { label: "30K, 80万 cash, 300K CPF, 38岁 首套", ids: ["B12", "B13", "B14"] }, // SC/PR/外籍
    { label: "25K, 60万 cash, 首套", ids: ["A08", "B01"] }, // SC 1st vs SC 2nd
  ];
  const lines = [
    `## 跨身份对比`,
    ``,
    `同收入/现金，不同身份下能买多少差多少。这是 ABSD 决策力的直观表现。`,
    ``,
  ];
  for (const b of buckets) {
    lines.push(
      `### ${b.label}`,
      ``,
      `| ID | 身份 | 套数 | 平衡区 | g* 平衡 |`,
      `|---|---|---|---|---|`
    );
    for (const id of b.ids) {
      const r = results.find((x) => x.persona.id === id);
      if (!r) continue;
      const t = r.v2.tiers.balanced;
      const g = r.v2.break_even ? fmtPct(r.v2.break_even.tiers.balanced.g_star) : "—";
      const props = r.persona.input.existingProperties;
      lines.push(
        `| ${id} | ${r.persona.input.residency} | ${props === 0 ? "首套" : props === 1 ? "二套" : "三套+"} | ${fmtRange(t.price_low, t.price_high)} | ${g} |`
      );
    }
    lines.push(``);
  }
  return lines.join("\n");
})();

const md =
  summary.join("\n") +
  sections.join("\n") +
  eExtras +
  "\n" +
  compareTable +
  "\n" +
  flagsSection +
  `\n---\n\n*Generated ${new Date().toISOString().split("T")[0]} by scripts/run-personas.ts*\n`;

const outPath = path.resolve(__dirname, "../docs/V2_TEST_REPORT.md");
fs.writeFileSync(outPath, md, "utf8");

console.log(`✓ Wrote ${outPath}`);
console.log(`  ${results.length} personas, ${totalFlagged} red flags, ${totalWarnings} warnings`);
