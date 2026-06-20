# Calculator V2 — 引擎/UX/合规修订计划

## Context

V2 上线（commit `cfcd280`）后做了两件事：

1. 跑了 58 个 persona 测试（[docs/V2_TEST_REPORT.md](V2_TEST_REPORT.md)），发现 9 个红旗、31 个边界信号。
2. 产品负责人做了一轮系统性 review，整理出 17 个潜在问题（套数计算、CPF 印花税、合规措辞、应急金口径、break-even 假设暴露等）。

经过对照代码 + 法规审视，结论是：

- **11 件该改**（5 件 P0 含法律/数据正确性风险；3 件 P1 产品自洽与信任；3 件 P2 体验优化）
- **6 件不改或暂不改**：persona 报告里"break-even 比直觉低"是引擎正确，外籍交易可行是"让数字说话"的正确表现，月供债务/应急金细化通过文案点出工具边界、不必扩展问卷

修订原则：**不是"做得更精细"，而是"做得更透明"**——把工具的假设、边界、未含项露出来，让懂的用户能自己验证和修正。

---

## P0 — 法律 / 数据正确性 / 误导风险（先做）

### P0.1 套数拆两问：分离 ABSD 与 LTV 输入

**问题：** [lib/tax/tdsr.ts:38-49](../lib/tax/tdsr.ts) 用单一 `propertyCount` 同时驱动 ABSD 和 LTV。但：

- IRAS：海外房产**不计** ABSD，新加坡名下房产数才算
- MAS：LTV 看的是**未偿还房贷数**，跟所有权数无关

**后果：** 中国 PR 在国内有 1 套已还清 → 当前工具按 ABSD 30% + LTV 45% 算，**严重低估购买力**，且会让用户付定金后才发现银行能批的金额翻倍。

**改动：**

- `SolveParams` 拆 `propertyCount` → `singaporePropertyCount` (ABSD) + `outstandingMortgageCount` (LTV)。
- 问卷 step 1 拆两题：
  - "您在**新加坡**名下有几套住宅？"（0 / 1 / 2+）→ ABSD
  - "您目前有几笔**未偿还的住房贷款**？"（0 / 1 / 2+）→ LTV
- 引擎 `getLtvCap` 改用 `outstandingMortgageCount`；ABSD 矩阵改用 `singaporePropertyCount`。

**关键文件：** [lib/tax/tdsr.ts](../lib/tax/tdsr.ts), [lib/tax/absd.ts](../lib/tax/absd.ts), [lib/calculator/form-types.ts](../lib/calculator/form-types.ts), [lib/calculator/bucket-maps.ts](../lib/calculator/bucket-maps.ts), [app/(tools)/calculator/page.tsx](<../app/(tools)/calculator/page.tsx>) 的 Step 1 区块。

**工作量：** 1.5 天（含 tdsr-v2 单测扩展、persona fixtures 增加字段）

### P0.2 最低现金首付按 LTV 档变化

**问题：** [lib/tax/tdsr.ts:104](../lib/tax/tdsr.ts) 的 `cashMinimum = price * 0.05` 是硬编码。MAS 规则是：

| LTV  | 最低现金首付 |
| ---- | ------------ |
| 75%  | 5%           |
| 55%  | 10%          |
| 45%  | 25%          |

后果：LTV 55% 场景**高估购买力 5% 房价**；45% 场景**高估 20% 房价**。

**改动：** `isFeasibleAtPrice` 和 `buildOutput` 里 `cashMinimum` 改成根据 `ltvCap` 查表：

```ts
const minCashPct = ltvCap === 0.75 ? 0.05 : ltvCap === 0.55 ? 0.10 : 0.25;
const cashMinimum = price * minCashPct;
```

**关键文件：** [lib/tax/tdsr.ts](../lib/tax/tdsr.ts) 两处。

**工作量：** 0.5 天（含 persona 重跑、tdsr-v2 测试新增 LTV/cash 矩阵）

### P0.3 文案与合规：私宅声明、CPF 文案、历史涨幅措辞、"已加密"措辞

四件文案改动，无代码逻辑变化：

1. **首屏加私宅声明**：当前算法不含 MSR (HDB/EC 30%) 也不含 HDB loan 逻辑。首屏 hero 加一行：

   > "适用于新加坡**私人住宅**的银行贷款初步测算。"

2. **CPF 文案修正**（Block 2 现金拆解注释）：当前写"BSD 与 ABSD 必须现金 / 支票支付，CPF 不可" 在 CPF 报销规则下不准确。**直接删除该行**（不再提支付细节，避免解释复杂）。算法不动——主数字仍是"垫付现金"（用户当天真要拿出的钱）。

3. **历史涨幅措辞**：当前在 2026 年显示"过去 10 年涨 2.8%/年" 容易让用户理解成 2016-2026 真实回报。改为：

   > "URA PPI 2014–2024 名义年化约 2.8%（全岛均值，不代表具体项目；含通胀）"

4. **"已加密"措辞**：[core_tables.sql](../db/migrations/20260430000002_core_tables.sql) 只有 PII COMMENT 标记，**没有实际应用层加密实现**。在加密落地前，把首屏"您的数据已被加密处理"改为：

   > "无需注册即可测算。"

**关键文件：** [app/(tools)/calculator/page.tsx](<../app/(tools)/calculator/page.tsx>) 的 Hero、Block 2 footer、隐私文案位置。

**工作量：** 半小时

### P0.4 合规文档前置上线

**问题：** spec §11 提到合规但 [app/(marketing)/legal/](<../app/(marketing)/legal/>) 当前只有 placeholder。

**最小集（上线必需）：**

| 文档                      | 触发时机             | 已有进展                            |
| ------------------------- | -------------------- | ----------------------------------- |
| **Privacy Policy**        | 任何页面 footer      | 占位                                |
| **Terms of Service**      | Footer，含工具免责   | 缺                                  |
| **Lead Sharing Consent**  | 用户点 WhatsApp 之前 | [consent_log](../db/migrations/20260430000002_core_tables.sql) 表已就绪，前端未接 |
| **CEA Disclaimer**        | Footer + 留资页面    | 缺                                  |

**改动：**

- 起草上述文档骨架（需要法务协助定终稿；本 plan 只保证工程层就位）
- 把 `consent_log` 写入接入 `/api/v1/calculator/save` 路径：用户点 CTA 前弹 modal 收集 lead sharing consent，确认后写一行 `consent_log`，再保存 calculator_runs 并打开 WhatsApp。

**关键文件：** [app/api/v1/calculator/save/route.ts](../app/api/v1/calculator/save/route.ts), [app/(tools)/calculator/page.tsx](<../app/(tools)/calculator/page.tsx>) CTA 流程, [app/(marketing)/legal/](<../app/(marketing)/legal/>) 文档骨架。

**工作量：** 文案骨架 0.5 天；consent 接入 0.5 天；终稿等法务（不阻塞工程）。

---

## P1 — 产品自洽与信任（两周内做）

### P1.1 三档区间纳入应急金约束

**问题：** persona 报告 A03/A07/A09/B10 的"推荐平衡区 + 现金不足 S$ 几千"自相矛盾。根因是 [v2-compute.ts:33-36](../lib/calculator/v2-compute.ts) 区间求解只用 `transaction_cash_total` 做约束，应急金独立叠加。

**改动：** [lib/tax/tdsr.ts](../lib/tax/tdsr.ts) `isFeasibleAtPrice` 的 `availableCash` 比较项里减去应急金阈值：

```ts
const emergencyReserve = params.annualIncome * EMERGENCY_FUND_RATIO;
const effectiveCash = Math.max(0, params.availableCash - emergencyReserve);
return totalCashNeeded <= effectiveCash;
```

**后果：** 三档区间会缩水 5-10%，但"推荐 = 真的推荐"的产品承诺保留。

**关键文件：** [lib/tax/tdsr.ts](../lib/tax/tdsr.ts), [lib/calculator/v2-compute.ts](../lib/calculator/v2-compute.ts) 的 `EMERGENCY_FUND_RATIO` 移到引擎共享位置。

**工作量：** 1 天

### P1.2 三档卡片显示月供金额（不只是占比）

**问题：** 引擎已返回 `monthly_payment.base/stress`，UI 只显示"月供占月入 35%"。用户最想看的是具体数字。

**改动：** [app/(tools)/calculator/page.tsx](<../app/(tools)/calculator/page.tsx>) Block 1 三档卡片改成：

```
平衡区  S$ 152万 – 165万  推荐
─────
当前月供（1.65%）  S$ 5,820
压力月供（4%）    S$ 7,510
扣月供后月入剩    S$ 11,680
```

**关键文件：** [app/(tools)/calculator/page.tsx](<../app/(tools)/calculator/page.tsx>) 三档卡片 component。

**工作量：** 0.5 天（纯 UI）

> **暂不做：** 原 P1.3（break-even 假设暴露 / 月供债务免责文案 / 应急金口径说明）经评估推迟到 V2.1 之后再考虑——避免文案密度过高、保持 MVP 的"先简洁后透明"路径。

---

## P2 — 体验优化（V2.1 顺手做）

### P2.1 WhatsApp 话术修正

[app/(tools)/calculator/page.tsx](<../app/(tools)/calculator/page.tsx>) WhatsApp CTA 后的 toast 当前是"顾问将在 24 小时内联系"。但用户可能根本没点 WhatsApp 的发送。改为：

> "已为您打开 WhatsApp。**发送消息后**，顾问会在 24 小时内回复您。"

**工作量：** 5 分钟

---

## 明确不改的事（讨论后保留现状）

1. **persona A01/A06/A08 break-even 比"直觉"低** — 引擎正确。低利率环境下 break-even 数学上确实可能 ≤ 1%。P1.3 把假设暴露后，懂的用户自己判断。**修 persona fixture 的 expect，不修引擎。**
2. **persona B05/B07 外籍"交易可行"但 g* > 5%** — "让数字说话"基调的正确表现。用户看到 g\* 11% 自己会判断"这是赌注"。**修 persona fixture 的 expect。**
3. **月供债务不进问卷** — 加必填会流失意向，加折叠没人点。本期保留现状（默认 0），文案不额外说明。
4. **应急金不开放精细输入** — 沿用 `年收入 × 0.55` 粗算，本期不展示口径细节。
5. **持有年数 / 替代投资回报率不收集为问卷字段** — 它们已经在 Block 3 是可调控件。
6. **HDB / EC 路径不本工具承担** — 用 P0.3 首屏私宅声明排除即可。

---

## PR 拆分建议

按依赖：

| PR  | 内容                              | 估算工作量      |
| --- | --------------------------------- | --------------- |
| 1   | P0.1 套数拆两问 (引擎 + UI + 测试) | 1.5 天          |
| 2   | P0.2 最低现金首付按 LTV 变         | 0.5 天          |
| 3   | P0.3 文案修订（私宅/CPF/历史/加密）| 半小时          |
| 4   | P0.4 合规文档骨架 + consent 接入   | 1 天 (法务终稿另算) |
| 5   | P1.1 应急金纳入约束                | 1 天            |
| 6   | P1.2 月供数字每档显示              | 0.5 天          |
| 7   | P2.1 WhatsApp 话术                | 5 分钟          |

PR 1-4 是 P0 必做（合计 ~3.5 天），PR 5-6 是 P1（合计 ~1.5 天）。**全 P0+P1 ≈ 5 天**。

---

## 验证方式

每个 PR 必须：

1. 跑 `npx vitest run`（保证现有单测全过）
2. 跑 `npx tsx scripts/run-personas.ts`（对比 [docs/V2_TEST_REPORT.md](V2_TEST_REPORT.md) 的 diff，确认数字变化符合改动预期）
3. P0.1 / P0.2 / P1.1 改完后 persona 报告里的"差几千" red flag 应清零
4. P0.1 改完后增加新 fixture：CN PR 在国内有 1 套已还清、SC 在新加坡有 1 套未还清 → 验证 ABSD 和 LTV 走不同分支
5. 浏览器手测：[app/(tools)/calculator/page.tsx](<../app/(tools)/calculator/page.tsx>) 跑一次完整问卷，确认 UI 显示新数字

最终验收画像（更新 spec §11）：

| 画像 | P0 后期望输出 |
|---|---|
| 中国 PR · 国内 1 套已还清 · 17.5K 月入 · 35 万现金 | balanced 130-160 万；现金可行 ✓（应急金可能 short）|
| SC · 新加坡 1 套未还清 · 25K 月入 · 60 万现金 | LTV 45% + ABSD 20%，balanced 显著低于无既有产权 case |
| 外籍 WP · 0 套 · 25K 月入 · 80 万现金 | 三档收敛 ~74 万；balanced 显示 ABSD 60%；g\* 11%+ 明示 |
