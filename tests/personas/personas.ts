/**
 * V2 Calculator — persona test fixtures.
 *
 * 58 用例，分 6 类：
 *   A 典型画像（10）  — 健康路径
 *   B 身份边界（15）  — ABSD 决策核心区
 *   C LTV 悬崖（8）   — 年龄/年限切换点
 *   D 现金/收入失衡（12）— 病态画像
 *   E 参数微调（8）   — 结果页 4 参数边界
 *   F 健壮性（5）     — 系统输入边界
 *
 * 跑：  npx tsx scripts/run-personas.ts
 * 输出： docs/V2_TEST_REPORT.md
 */

import type { SolveParams } from "@/lib/tax";
import { SEED_TAX_RATES } from "@/lib/tax";

export type Residency = "citizen" | "pr" | "foreigner" | "company";

export interface PersonaInput {
  // identity
  residency: Residency;
  /** 0 = first property; 1 = second; 2+ = third+. */
  existingProperties: 0 | 1 | 2;
  age: number;
  // money (annualised income)
  annualIncome: number;
  availableCash: number;
  availableCpf: number;
  // loan
  tenureYears: number;
  existingMonthlyDebt: number;
  // break-even controls
  holdingYears: number;
  rate: number;
  /** Override for the displayed monthly rent. If undefined the engine's default estimate is used. */
  rentOverride?: number;
}

export interface Persona {
  id: string;
  label: string;
  category: "A" | "B" | "C" | "D" | "E" | "F";
  /** Free-form text shown in the report. Used to flag what to look at. */
  watch: string;
  input: PersonaInput;
  /** Optional rough expectations (sanity bands). Empty when the test is exploratory. */
  expect?: {
    balancedMidRange?: [number, number]; // SGD
    breakEvenBalanced?: [number, number]; // fractional, e.g. [0.015, 0.025]
    feasible?: boolean; // balanced.cash_gap should be ≤ 0
  };
}

export const TAX = SEED_TAX_RATES;

export function toSolveParams(p: PersonaInput): SolveParams {
  return {
    annualIncome: p.annualIncome,
    existingMonthlyDebt: p.existingMonthlyDebt,
    availableCash: p.availableCash,
    availableCpf: p.availableCpf,
    age: p.age,
    tenureYears: p.tenureYears,
    propertyCount: Math.min(p.existingProperties + 1, 3),
    residency: p.residency,
    bsdSlabs: TAX.bsd_slabs,
    absdMatrix: TAX.absd_matrix,
    ltvRules: TAX.ltv_rules,
    tdsr: TAX.tdsr,
    displayRate: p.rate,
  };
}

/* ============================================================
   A · 典型画像（10）— 健康路径
   ============================================================ */

const A: Persona[] = [
  {
    id: "A01",
    label: "SC · 月入 12K · 35岁 · 30万现金 · 20万CPF · 首套",
    category: "A",
    watch: "新加坡公民中产基线。预期 balanced ~100-130万、break-even ~2%。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 35,
      annualIncome: 144_000,
      availableCash: 300_000,
      availableCpf: 200_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true, breakEvenBalanced: [0.01, 0.03] },
  },
  {
    id: "A02",
    label: "SC · 月入 18K · 35岁 · 50万现金 · 25万CPF · 首套",
    category: "A",
    watch: "上层中产，可买 150-200万。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 35,
      annualIncome: 216_000,
      availableCash: 500_000,
      availableCpf: 250_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true },
  },
  {
    id: "A03",
    label: "SC · 月入 30K · 40岁 · 100万现金 · 40万CPF · 首套",
    category: "A",
    watch: "高收入主流。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 40,
      annualIncome: 360_000,
      availableCash: 1_000_000,
      availableCpf: 400_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true },
  },
  {
    id: "A04",
    label: "SC · 月入 50K · 45岁 · 200万现金 · 50万CPF · 首套",
    category: "A",
    watch: "高净值人群，注意年龄+30=75 是否触发 LTV 55%。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 45,
      annualIncome: 600_000,
      availableCash: 2_000_000,
      availableCpf: 500_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true },
  },
  {
    id: "A05",
    label: "PR · 月入 12K · 32岁 · 30万现金 · 10万CPF · 首套",
    category: "A",
    watch: "PR 首套 ABSD 5%，相比 SC 多税 1 档。",
    input: {
      residency: "pr",
      existingProperties: 0,
      age: 32,
      annualIncome: 144_000,
      availableCash: 300_000,
      availableCpf: 100_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true },
  },
  {
    id: "A06",
    label: "PR · 月入 17.5K · 35岁 · 35万现金 · 20万CPF · 首套（你的画像）",
    category: "A",
    watch: "spec §11 验收 case：平衡区 130-150万、break-even ~2%。",
    input: {
      residency: "pr",
      existingProperties: 0,
      age: 35,
      annualIncome: 210_000,
      availableCash: 350_000,
      availableCpf: 200_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true, breakEvenBalanced: [0.015, 0.025] },
  },
  {
    id: "A07",
    label: "PR · 月入 25K · 38岁 · 60万现金 · 30万CPF · 首套",
    category: "A",
    watch: "PR 上层中产。",
    input: {
      residency: "pr",
      existingProperties: 0,
      age: 38,
      annualIncome: 300_000,
      availableCash: 600_000,
      availableCpf: 300_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true },
  },
  {
    id: "A08",
    label: "SC · 月入 25K · 32岁 · 60万现金 · 35万CPF · 首套（spec §11 #2 验收）",
    category: "A",
    watch: "spec §11 验收 case：平衡区 180-220万、break-even 2.0-2.5%。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 32,
      annualIncome: 300_000,
      availableCash: 600_000,
      availableCpf: 350_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true, breakEvenBalanced: [0.018, 0.028] },
  },
  {
    id: "A09",
    label: "SC · 月入 15K · 28岁 · 25万现金 · 10万CPF · 首套",
    category: "A",
    watch: "年轻 SC，CPF 少现金薄，但有 30 年贷长。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 28,
      annualIncome: 180_000,
      availableCash: 250_000,
      availableCpf: 100_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true },
  },
  {
    id: "A10",
    label: "PR 夫妻合并 · 月入 22K · 33岁 · 45万现金 · 25万CPF · 首套",
    category: "A",
    watch: "双 PR 联名买首套，画像在 spec 想覆盖的核心区。",
    input: {
      residency: "pr",
      existingProperties: 0,
      age: 33,
      annualIncome: 264_000,
      availableCash: 450_000,
      availableCpf: 250_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true },
  },
];

/* ============================================================
   B · 身份边界（15）— ABSD 决策核心区
   ============================================================ */

const B: Persona[] = [
  {
    id: "B01",
    label: "SC 二套 · 月入 25K · 60万现金 · 40万CPF",
    category: "B",
    watch: "SC 第二套 ABSD 20% + LTV 45%。break-even 应隐藏（非首套）。",
    input: {
      residency: "citizen",
      existingProperties: 1,
      age: 40,
      annualIncome: 300_000,
      availableCash: 600_000,
      availableCpf: 400_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "B02",
    label: "SC 三套 · 月入 50K · 200万现金 · 50万CPF",
    category: "B",
    watch: "SC 第三套 ABSD 30% + LTV 45%。",
    input: {
      residency: "citizen",
      existingProperties: 2,
      age: 45,
      annualIncome: 600_000,
      availableCash: 2_000_000,
      availableCpf: 500_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "B03",
    label: "PR 二套 · 月入 25K · 60万现金 · 30万CPF",
    category: "B",
    watch: "PR 第二套 ABSD 30%！PR/SC 差异最显眼的对比 vs B01。",
    input: {
      residency: "pr",
      existingProperties: 1,
      age: 40,
      annualIncome: 300_000,
      availableCash: 600_000,
      availableCpf: 300_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "B04",
    label: "PR 三套 · 月入 40K · 150万现金 · 40万CPF",
    category: "B",
    watch: "PR 第三套 ABSD 35%。",
    input: {
      residency: "pr",
      existingProperties: 2,
      age: 45,
      annualIncome: 480_000,
      availableCash: 1_500_000,
      availableCpf: 400_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "B05",
    label: "外籍 WP · 月入 25K · 80万现金 · CPF=0 · 首套",
    category: "B",
    watch: "spec §11 验收 #3：ABSD 60% + LTV 75%（首套），三档应收敛 / 缺现金 100万+。",
    input: {
      residency: "foreigner",
      existingProperties: 0,
      age: 38,
      annualIncome: 300_000,
      availableCash: 800_000,
      availableCpf: 0,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: false },
  },
  {
    id: "B06",
    label: "外籍无身份 · 月入 50K · 200万现金 · 首套",
    category: "B",
    watch: "高净值外籍，ABSD 60% 吞 120 万。剩 80 万够付首付吗？",
    input: {
      residency: "foreigner",
      existingProperties: 0,
      age: 42,
      annualIncome: 600_000,
      availableCash: 2_000_000,
      availableCpf: 0,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "B07",
    label: "外籍 WP · 月入 15K · 50万现金 · 首套",
    category: "B",
    watch: "中等收入外籍，工具应该说什么？让数字说话基调验证。",
    input: {
      residency: "foreigner",
      existingProperties: 0,
      age: 35,
      annualIncome: 180_000,
      availableCash: 500_000,
      availableCpf: 0,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: false },
  },
  {
    id: "B08",
    label: "外籍 WP 二套 · 月入 40K · 200万现金",
    category: "B",
    watch: "ABSD 60% 第二套（同首套）。",
    input: {
      residency: "foreigner",
      existingProperties: 1,
      age: 42,
      annualIncome: 480_000,
      availableCash: 2_000_000,
      availableCpf: 0,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "B09",
    label: "SC 首套 · 同 A02 但 12K（最低端）· 比较 ABSD 0%",
    category: "B",
    watch: "SC 0% ABSD 在 12K 收入档下能买多少？跟 A05 (PR 5%) 对比。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 32,
      annualIncome: 144_000,
      availableCash: 300_000,
      availableCpf: 100_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true },
  },
  {
    id: "B10",
    label: "PR 首套（高收入）· 月入 50K · 200万现金 · 50万CPF",
    category: "B",
    watch: "PR 首套 ABSD 5% 是否在高收入下也吃紧？",
    input: {
      residency: "pr",
      existingProperties: 0,
      age: 42,
      annualIncome: 600_000,
      availableCash: 2_000_000,
      availableCpf: 500_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: true },
  },
  {
    id: "B11",
    label: "SC 首套 vs B09 PR 首套同画像（重复对比组）",
    category: "B",
    watch: "对比 B09，看 SC 0% 比 PR 5% 多能买多少。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 32,
      annualIncome: 144_000,
      availableCash: 300_000,
      availableCpf: 100_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "B12",
    label: "SC 首套高收入 · 月入 30K · 80万现金",
    category: "B",
    watch: "SC 0% ABSD 高收入，看是否被 TDSR 主导。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 38,
      annualIncome: 360_000,
      availableCash: 800_000,
      availableCpf: 300_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "B13",
    label: "PR 首套 · 月入 30K · 80万现金 · vs B12",
    category: "B",
    watch: "同 B12 但 PR，看 5% ABSD 削掉多少。",
    input: {
      residency: "pr",
      existingProperties: 0,
      age: 38,
      annualIncome: 360_000,
      availableCash: 800_000,
      availableCpf: 300_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "B14",
    label: "外籍首套 · 月入 30K · 80万现金 · vs B12/B13",
    category: "B",
    watch: "同收入现金，60% ABSD vs 5% vs 0% 三档全对比。",
    input: {
      residency: "foreigner",
      existingProperties: 0,
      age: 38,
      annualIncome: 360_000,
      availableCash: 800_000,
      availableCpf: 0,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "B15",
    label: "SC 三套（极端） · 月入 50K · 500万现金",
    category: "B",
    watch: "ABSD 30% × LTV 45% 双重压制，500 万现金应该够付。",
    input: {
      residency: "citizen",
      existingProperties: 2,
      age: 50,
      annualIncome: 600_000,
      availableCash: 5_000_000,
      availableCpf: 600_000,
      tenureYears: 25,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
];

/* ============================================================
   C · LTV 悬崖（8）— 年龄/年限切换点
   ============================================================ */

const C: Persona[] = [
  {
    id: "C01",
    label: "35岁 + 30年 = 65（临界，仍 75%）",
    category: "C",
    watch: "等号边界，LTV 应为 75%。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 35,
      annualIncome: 240_000,
      availableCash: 500_000,
      availableCpf: 250_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "C02",
    label: "36岁 + 30年 = 66（应掉到 55%）",
    category: "C",
    watch: "差 1 岁触发 LTV 悬崖，最大房价应明显跳水。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 36,
      annualIncome: 240_000,
      availableCash: 500_000,
      availableCpf: 250_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "C03",
    label: "50岁 + 25年 = 75（55%）",
    category: "C",
    watch: "中年画像，LTV 55%。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 50,
      annualIncome: 360_000,
      availableCash: 1_000_000,
      availableCpf: 400_000,
      tenureYears: 25,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "C04",
    label: "50岁 + 15年 = 65（仍 75%）",
    category: "C",
    watch: "缩短贷款年限恢复 LTV 75%，但月供吃紧。看工具会不会推荐。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 50,
      annualIncome: 360_000,
      availableCash: 1_000_000,
      availableCpf: 400_000,
      tenureYears: 15,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "C05",
    label: "60岁 + 5年 = 65（极端短贷 75%）",
    category: "C",
    watch: "极端：短贷 + 高 LTV，月供必然超 TDSR。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 60,
      annualIncome: 240_000,
      availableCash: 1_500_000,
      availableCpf: 500_000,
      tenureYears: 5,
      existingMonthlyDebt: 0,
      holdingYears: 5,
      rate: 0.0165,
    },
  },
  {
    id: "C06",
    label: "21岁 + 30年 = 51（最年轻 + 长贷）",
    category: "C",
    watch: "最年轻边界，应享 75%，TDSR 反推贷款很大。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 21,
      annualIncome: 120_000,
      availableCash: 200_000,
      availableCpf: 30_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "C07",
    label: "55岁 + 30年 = 85（55%，退休边缘）",
    category: "C",
    watch: "55岁还想贷 30 年。LTV 55%，月供占比可能不友好。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 55,
      annualIncome: 360_000,
      availableCash: 1_200_000,
      availableCpf: 500_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "C08",
    label: "70岁 + 20年 = 90（schema 上限 80 应当拒绝？）",
    category: "C",
    watch: "schema age max=80，这里 70 应该通过；看 LTV 55% 下能买多少。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 70,
      annualIncome: 240_000,
      availableCash: 1_500_000,
      availableCpf: 800_000,
      tenureYears: 20,
      existingMonthlyDebt: 0,
      holdingYears: 5,
      rate: 0.0165,
    },
  },
];

/* ============================================================
   D · 现金/收入失衡（12）— 病态画像
   ============================================================ */

const D: Persona[] = [
  {
    id: "D01",
    label: "现金死锁 · 月入 30K · 现金 5万",
    category: "D",
    watch: "高收入但极薄现金，三档应该全收敛（degenerate=true）。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 35,
      annualIncome: 360_000,
      availableCash: 50_000,
      availableCpf: 200_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "D02",
    label: "收入死锁 · 月入 5K · 现金 500万",
    category: "D",
    watch: "现金堆山但 TDSR 完全养不起。三档应该全跌到很低。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 40,
      annualIncome: 60_000,
      availableCash: 5_000_000,
      availableCpf: 200_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "D03",
    label: "CPF 富现金薄 · 月入 15K · 现金 15万 · CPF 80万",
    category: "D",
    watch: "CPF 能补首付的 20%，但 5% 必现金可能还差。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 45,
      annualIncome: 180_000,
      availableCash: 150_000,
      availableCpf: 800_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "D04",
    label: "超高净值 · 月入 50K · 现金 1000万",
    category: "D",
    watch: "应该买 5M+。工具的 30M 二分搜索上限够吗？",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 45,
      annualIncome: 600_000,
      availableCash: 10_000_000,
      availableCpf: 500_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "D05",
    label: "0 现金 · 月入 25K",
    category: "D",
    watch: "现金 0 应立即触发 INSUFFICIENT_CASH。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 35,
      annualIncome: 300_000,
      availableCash: 0,
      availableCpf: 200_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: false },
  },
  {
    id: "D06",
    label: "0 CPF + 高收入 SC · 月入 30K · 现金 50万 · CPF 0",
    category: "D",
    watch: "SC 居然 CPF=0 不太可能（除非全提走）。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 38,
      annualIncome: 360_000,
      availableCash: 500_000,
      availableCpf: 0,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "D07",
    label: "极低收入 SC · 月入 5K · 现金 30万",
    category: "D",
    watch: "月入 5K 在新加坡 condo 市场基本买不起。工具说什么？",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 30,
      annualIncome: 60_000,
      availableCash: 300_000,
      availableCpf: 100_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "D08",
    label: "退休边缘 · 60岁 · 月入 10K · 现金 100万 · CPF 30万",
    category: "D",
    watch: "高净值退休前。LTV 55% + 收入不高。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 60,
      annualIncome: 120_000,
      availableCash: 1_000_000,
      availableCpf: 300_000,
      tenureYears: 20,
      existingMonthlyDebt: 0,
      holdingYears: 5,
      rate: 0.0165,
    },
  },
  {
    id: "D09",
    label: "PR 二套现金足 · 月入 30K · 200万现金",
    category: "D",
    watch: "PR 二套 ABSD 30% 通常很狠。看现金足够下能买多少。",
    input: {
      residency: "pr",
      existingProperties: 1,
      age: 42,
      annualIncome: 360_000,
      availableCash: 2_000_000,
      availableCpf: 400_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "D10",
    label: "高合并收入 · 月入 50K · 现金 80万 · 首套",
    category: "D",
    watch: "暗指双申请人，工具不区分单/双申请。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 35,
      annualIncome: 600_000,
      availableCash: 800_000,
      availableCpf: 400_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "D11",
    label: "负债大户 · 月入 15K · 月供债务 8K · 首套",
    category: "D",
    watch: "8K 月供债吃掉 53% TDSR 配额，留 1250 给房贷。极端低房价。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 35,
      annualIncome: 180_000,
      availableCash: 400_000,
      availableCpf: 200_000,
      tenureYears: 30,
      existingMonthlyDebt: 8_000,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "D12",
    label: "极短持有 · 月入 25K · 现金 60万 · H=2 年",
    category: "D",
    watch: "持有 2 年触发 SSD（本 MVP 未含）+ 一次性税摊销不开，g* 应该极高。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 35,
      annualIncome: 300_000,
      availableCash: 600_000,
      availableCpf: 300_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 2,
      rate: 0.0165,
    },
  },
];

/* ============================================================
   E · 参数微调（8）— 结果页 4 参数边界
   ============================================================ */

// 基线画像（E01-E08 共用，只改一个参数）
const E_BASE = {
  residency: "pr" as const,
  existingProperties: 0 as const,
  age: 35,
  annualIncome: 210_000, // 月 17.5K
  availableCash: 350_000,
  availableCpf: 200_000,
  tenureYears: 30,
  existingMonthlyDebt: 0,
  holdingYears: 7,
  rate: 0.0165,
};

const E: Persona[] = [
  {
    id: "E01",
    label: "持有 1 年（A06 基线，仅改 holdingYears）",
    category: "E",
    watch: "极短持有，g* 应极高（一次性税摩擦未摊销）。",
    input: { ...E_BASE, holdingYears: 1 },
  },
  {
    id: "E02",
    label: "持有 30 年（A06 基线）",
    category: "E",
    watch: "超长持有，g* 应趋近 0 甚至负数。",
    input: { ...E_BASE, holdingYears: 30 },
  },
  {
    id: "E03",
    label: "利率 1.5%（A06 基线，最低）",
    category: "E",
    watch: "低利率买得起更多房，但 TDSR 用 stress 4% 不会动。",
    input: { ...E_BASE, rate: 0.015 },
  },
  {
    id: "E04",
    label: "利率 4.0%（A06 基线，最高）",
    category: "E",
    watch: "利率拉满到压力线，月供翻倍但 TDSR 仍用 stress 4% 算。",
    input: { ...E_BASE, rate: 0.04 },
  },
  {
    id: "E05",
    label: "租金极低 S$ 1000（A06 基线）",
    category: "E",
    watch: "租房稳赢，g* 应极高 → clamped=above。",
    input: { ...E_BASE, rentOverride: 1_000 },
  },
  {
    id: "E06",
    label: "租金极高 S$ 15,000（A06 基线）",
    category: "E",
    watch: "租房稳输，g* 应极低甚至负数 → 可能 clamped=below。",
    input: { ...E_BASE, rentOverride: 15_000 },
  },
  {
    id: "E07",
    label: "贷款年限 20 年（A06 基线）",
    category: "E",
    watch: "短期贷月供更高 → TDSR 反推贷款少 → 房价低。",
    input: { ...E_BASE, tenureYears: 20 },
  },
  {
    id: "E08",
    label: "全部默认 + holdingYears=15（A06 中间路径）",
    category: "E",
    watch: "中长期持有，g* 应在 0.5-1.5% 之间。",
    input: { ...E_BASE, holdingYears: 15 },
  },
];

/* ============================================================
   F · 健壮性（5）— 系统输入边界
   ============================================================ */

const F: Persona[] = [
  {
    id: "F01",
    label: "年龄 18（schema min=21，应被拦截）",
    category: "F",
    watch: "schema 在 API 层拦，引擎层接到不该崩。这里不测拦截，测引擎容忍度。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 18,
      annualIncome: 120_000,
      availableCash: 200_000,
      availableCpf: 50_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "F02",
    label: "年龄 85（schema max=80，引擎层应不崩）",
    category: "F",
    watch: "超高龄 + LTV 55%。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 85,
      annualIncome: 180_000,
      availableCash: 1_500_000,
      availableCpf: 0,
      tenureYears: 10,
      existingMonthlyDebt: 0,
      holdingYears: 3,
      rate: 0.0165,
    },
  },
  {
    id: "F03",
    label: "现金 1 亿（远超 30M 房价上限）",
    category: "F",
    watch: "现金 1 亿，二分搜索上限 30M。房价应该被 LTV/TDSR 限制而不是现金。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 35,
      annualIncome: 1_200_000,
      availableCash: 100_000_000,
      availableCpf: 500_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "F04",
    label: "收入 1 亿/年（超极端）",
    category: "F",
    watch: "TDSR 上限远超 30M 房价。二分搜索应 hit hi 边界。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 40,
      annualIncome: 100_000_000,
      availableCash: 50_000_000,
      availableCpf: 1_000_000,
      tenureYears: 30,
      existingMonthlyDebt: 0,
      holdingYears: 7,
      rate: 0.0165,
    },
  },
  {
    id: "F05",
    label: "月供债务 ≥ 月入 × TDSR（透支 TDSR）",
    category: "F",
    watch: "月入 10K × 55% = 5500，已欠 6000 → 房贷可贷 = 0。应触发 TDSR_EXCEEDED。",
    input: {
      residency: "citizen",
      existingProperties: 0,
      age: 35,
      annualIncome: 120_000,
      availableCash: 500_000,
      availableCpf: 200_000,
      tenureYears: 30,
      existingMonthlyDebt: 6_000,
      holdingYears: 7,
      rate: 0.0165,
    },
    expect: { feasible: false },
  },
];

/* ============================================================ */

export const ALL_PERSONAS: Persona[] = [...A, ...B, ...C, ...D, ...E, ...F];

if (ALL_PERSONAS.length !== 58) {
  throw new Error(`Expected 58 personas, got ${ALL_PERSONAS.length}`);
}
