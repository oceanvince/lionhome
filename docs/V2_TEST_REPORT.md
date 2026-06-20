# V2 Calculator Persona Test Report

> 自动生成。源：[tests/personas/personas.ts](../tests/personas/personas.ts)
> 跑：`npx tsx scripts/run-personas.ts`

**总数：58** | **🔴 与预期不符：9** | **⚠️/❌ 有边界信号：31**

## 旗的含义

- 🔴 expected ... — persona 自带的期望与实际不符（需要修期望或修引擎）
- ⚠️ — 系统正常但值得人工眼检（degenerate、cash gap、g* 极端）
- ❌ — 不可行（TDSR_EXCEEDED / INSUFFICIENT_CASH / price=0）
- ℹ — 中性信号（三档同值不一定是 bug；clamped below 表示买稳赢）

## 列说明

- **舒适/平衡/压力区**: 房价区间，单位"万"SGD
- **月供占比**: 压力利率 4%/25 年下月供占月入比例
- **平衡中点 → 需现金**: 用区间中点的房价算出的"应有现金"（含 12 月应急金）
- **现金可行**: ✓ = 现金 ≥ 应有；"差 X" = 差额
- **g\* 平衡**: 平衡区 break-even 涨幅。clamped=below/above 表示二分搜索撞边界

---
## A · 典型画像（10）— 健康路径
> 目的：sanity check 主流场景算得对、UX 通顺。如有 🔴 旗，先停下来。
> 
> 
> 
> 
> 
| ID | 画像 | 舒适区 | 平衡区 (月供占比) | 压力区 | 平衡中点 → 需现金 | 现金可行 | g* 平衡 | 旗 |
|---|---|---|---|---|---|---|---|---|
A01 | SC · 月入 12K · 35岁 · 30万现金 · 20万CPF · 首套 | 98 万 – 122 万 | 122 万 – 134 万 (35.0%) | 134 万 – 176 万 | 128 万 → S$ 318,323 | ⚠️ 应急金差 S$ 18,323 | -0.0% | ℹ balanced emergency fund short: S$ 18,323 (交易可行，应急金不够)<br>🔴 balanced g* -0.0% outside expected 1.0% – 3.0%
A02 | SC · 月入 18K · 35岁 · 50万现金 · 25万CPF · 首套 | 146 万 – 182 万 | 182 万 – 199 万 (35.0%) | 199 万 – 260 万 | 191 万 → S$ 528,294 | ⚠️ 应急金差 S$ 28,294 | 0.4% | ℹ balanced emergency fund short: S$ 28,294 (交易可行，应急金不够)
A03 | SC · 月入 30K · 40岁 · 100万现金 · 40万CPF · 首套 | 229 万 – 286 万 | 286 万 – 286 万 (25.0%) | 286 万 – 286 万 | 286 万 → S$ 1,201,600 | ❌ 差 S$ 3,600 | 1.2% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,600<br>🔴 expected feasible but transaction not affordable
A04 | SC · 月入 50K · 45岁 · 200万现金 · 50万CPF · 首套 | 401 万 – 501 万 | 501 万 – 501 万 (26.3%) | 501 万 – 501 万 | 501 万 → S$ 2,328,700 | ⚠️ 应急金差 S$ 328,700 | 2.4% | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 328,700 (交易可行，应急金不够)
A05 | PR · 月入 12K · 32岁 · 30万现金 · 10万CPF · 首套 | 86 万 – 107 万 | 107 万 – 118 万 (33.7%) | 118 万 – 122 万 | 113 万 → S$ 350,760 | ⚠️ 应急金差 S$ 50,760 | 2.1% | ℹ balanced emergency fund short: S$ 50,760 (交易可行，应急金不够)
A06 | PR · 月入 17.5K · 35岁 · 35万现金 · 20万CPF · 首套（你的画像） | 122 万 – 152 万 | 152 万 – 165 万 (32.5%) | 165 万 – 165 万 | 159 万 → S$ 445,280 | ⚠️ 应急金差 S$ 95,280 | 1.3% | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够)<br>🔴 balanced g* 1.3% outside expected 1.5% – 2.5%
A07 | PR · 月入 25K · 38岁 · 60万现金 · 30万CPF · 首套 | 135 万 – 169 万 | 169 万 – 169 万 (17.8%) | 169 万 – 169 万 | 169 万 → S$ 767,980 | ❌ 差 S$ 2,980 | 1.0% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 2,980<br>🔴 expected feasible but transaction not affordable
A08 | SC · 月入 25K · 32岁 · 60万现金 · 35万CPF · 首套（spec §11 #2 验收） | 194 万 – 242 万 | 242 万 – 267 万 (35.0%) | 267 万 – 325 万 | 255 万 → S$ 633,314 | ⚠️ 应急金差 S$ 33,314 | 0.7% | ℹ balanced emergency fund short: S$ 33,314 (交易可行，应急金不够)<br>🔴 balanced g* 0.7% outside expected 1.8% – 2.8%
A09 | SC · 月入 15K · 28岁 · 25万现金 · 10万CPF · 首套 | 100 万 – 125 万 | 125 万 – 125 万 (29.8%) | 125 万 – 125 万 | 125 万 → S$ 349,100 | ❌ 差 S$ 100 | 1.3% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 100<br>🔴 expected feasible but transaction not affordable
A10 | PR 夫妻合并 · 月入 22K · 33岁 · 45万现金 · 25万CPF · 首套 | 153 万 – 191 万 | 191 万 – 208 万 (32.6%) | 208 万 – 208 万 | 200 万 → S$ 568,800 | ⚠️ 应急金差 S$ 118,800 | 1.3% | ℹ balanced emergency fund short: S$ 118,800 (交易可行，应急金不够)
## B · 身份边界（15）— ABSD 决策核心区
> 
> 目的：揭示身份差异威力。看 SC vs PR vs 外籍同收入下能买多少。
> 
> 
> 
> 
| ID | 画像 | 舒适区 | 平衡区 (月供占比) | 压力区 | 平衡中点 → 需现金 | 现金可行 | g* 平衡 | 旗 |
|---|---|---|---|---|---|---|---|---|
B01 | SC 二套 · 月入 25K · 60万现金 · 40万CPF | 102 万 – 128 万 | 128 万 – 128 万 (11.0%) | 128 万 – 128 万 | 128 万 → S$ 763,860 | ⚠️ 应急金差 S$ 163,860 | — | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 163,860 (交易可行，应急金不够)
B02 | SC 三套 · 月入 50K · 200万现金 · 50万CPF | 225 万 – 281 万 | 281 万 – 281 万 (12.1%) | 281 万 – 281 万 | 281 万 → S$ 2,332,600 | ❌ 差 S$ 2,600 | — | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 2,600
B03 | PR 二套 · 月入 25K · 60万现金 · 30万CPF | 82 万 – 102 万 | 102 万 – 102 万 (8.8%) | 102 万 – 102 万 | 102 万 → S$ 759,940 | ⚠️ 应急金差 S$ 159,940 | — | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 159,940 (交易可行，应急金不够)
B04 | PR 三套 · 月入 40K · 150万现金 · 40万CPF | 162 万 – 203 万 | 203 万 – 203 万 (10.9%) | 203 万 – 203 万 | 203 万 → S$ 1,766,100 | ❌ 差 S$ 2,100 | — | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 2,100
B05 | 外籍 WP · 月入 25K · 80万现金 · CPF=0 · 首套 | 59 万 – 74 万 | 74 万 – 74 万 (7.8%) | 74 万 – 74 万 | 74 万 → S$ 960,780 | ⚠️ 应急金差 S$ 160,780 | 11.2% | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 160,780 (交易可行，应急金不够)<br>⚠️ balanced g* > 5% (赌注极大)<br>🔴 expected infeasible but transaction is affordable
B06 | 外籍无身份 · 月入 50K · 200万现金 · 首套 | 147 万 – 184 万 | 184 万 – 184 万 (9.7%) | 184 万 – 184 万 | 184 万 → S$ 2,327,600 | ⚠️ 应急金差 S$ 327,600 | 11.3% | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 327,600 (交易可行，应急金不够)<br>⚠️ balanced g* > 5% (赌注极大)
B07 | 外籍 WP · 月入 15K · 50万现金 · 首套 | 50 万 – 57 万 | 57 万 – 57 万 (13.6%) | 57 万 – 57 万 | 57 万 → S$ 596,840 | ⚠️ 应急金差 S$ 96,840 | 11.0% | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 96,840 (交易可行，应急金不够)<br>⚠️ balanced g* > 5% (赌注极大)<br>🔴 expected infeasible but transaction is affordable
B08 | 外籍 WP 二套 · 月入 40K · 200万现金 | 135 万 – 169 万 | 169 万 – 169 万 (9.1%) | 169 万 – 169 万 | 169 万 → S$ 2,265,480 | ❌ 差 S$ 1,480 | — | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 1,480
B09 | SC 首套 · 同 A02 但 12K（最低端）· 比较 ABSD 0% | 90 万 – 112 万 | 112 万 – 124 万 (35.0%) | 124 万 – 143 万 | 118 万 → S$ 314,123 | ⚠️ 应急金差 S$ 14,123 | 1.2% | ℹ balanced emergency fund short: S$ 14,123 (交易可行，应急金不够)
B10 | PR 首套（高收入）· 月入 50K · 200万现金 · 50万CPF | 366 万 – 457 万 | 457 万 – 457 万 (24.0%) | 457 万 – 457 万 | 457 万 → S$ 2,332,800 | ❌ 差 S$ 2,800 | 2.7% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 2,800<br>🔴 expected feasible but transaction not affordable
B11 | SC 首套 vs B09 PR 首套同画像（重复对比组） | 90 万 – 112 万 | 112 万 – 124 万 (35.0%) | 124 万 – 143 万 | 118 万 → S$ 314,123 | ⚠️ 应急金差 S$ 14,123 | 1.2% | ℹ balanced emergency fund short: S$ 14,123 (交易可行，应急金不够)
B12 | SC 首套高收入 · 月入 30K · 80万现金 | 181 万 – 226 万 | 226 万 – 226 万 (19.8%) | 226 万 – 226 万 | 226 万 → S$ 1,001,600 | ❌ 差 S$ 3,600 | 1.4% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,600
B13 | PR 首套 · 月入 30K · 80万现金 · vs B12 | 164 万 – 205 万 | 205 万 – 205 万 (17.9%) | 205 万 – 205 万 | 205 万 → S$ 999,100 | ❌ 差 S$ 1,100 | 2.0% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 1,100
B14 | 外籍首套 · 月入 30K · 80万现金 · vs B12/B13 | 59 万 – 74 万 | 74 万 – 74 万 (6.5%) | 74 万 – 74 万 | 74 万 → S$ 993,780 | ⚠️ 应急金差 S$ 193,780 | 11.2% | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 193,780 (交易可行，应急金不够)<br>⚠️ balanced g* > 5% (赌注极大)
B15 | SC 三套（极端） · 月入 50K · 500万现金 | 498 万 – 622 万 | 622 万 – 622 万 (29.5%) | 622 万 – 622 万 | 622 万 → S$ 5,333,800 | ❌ 差 S$ 3,800 | — | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,800
## C · LTV 悬崖（8）— 年龄/年限切换点
> 
> 
> 目的：抓 LTV 75%→55% 切换瞬间的连续性。C01 vs C02 应明显跳水。
> 
> 
> 
| ID | 画像 | 舒适区 | 平衡区 (月供占比) | 压力区 | 平衡中点 → 需现金 | 现金可行 | g* 平衡 | 旗 |
|---|---|---|---|---|---|---|---|---|
C01 | 35岁 + 30年 = 65（临界，仍 75%） | 155 万 – 194 万 | 194 万 – 213 万 (35.0%) | 213 万 – 260 万 | 204 万 → S$ 531,371 | ⚠️ 应急金差 S$ 31,371 | 1.0% | ℹ balanced emergency fund short: S$ 31,371 (交易可行，应急金不够)
C02 | 36岁 + 30年 = 66（应掉到 55%） | 125 万 – 156 万 | 156 万 – 156 万 (20.5%) | 156 万 – 156 万 | 156 万 → S$ 635,220 | ❌ 差 S$ 3,220 | 0.4% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,220
C03 | 50岁 + 25年 = 75（55%） | 229 万 – 286 万 | 286 万 – 286 万 (27.7%) | 286 万 – 286 万 | 286 万 → S$ 1,201,600 | ❌ 差 S$ 3,600 | 1.3% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,600
C04 | 50岁 + 15年 = 65（仍 75%） | 202 万 – 252 万 | 252 万 – 271 万 (35.0%) | 271 万 – 348 万 | 262 万 → S$ 1,103,082 | ⚠️ 应急金差 S$ 103,082 | 1.2% | ℹ balanced emergency fund short: S$ 103,082 (交易可行，应急金不够)
C05 | 60岁 + 5年 = 65（极端短贷 75%） | 179 万 – 224 万 | 224 万 – 229 万 (35.0%) | 229 万 – 250 万 | 227 万 → S$ 1,609,007 | ⚠️ 应急金差 S$ 109,007 | 0.1% | ℹ balanced emergency fund short: S$ 109,007 (交易可行，应急金不够)
C06 | 21岁 + 30年 = 51（最年轻 + 长贷） | 66 万 – 83 万 | 83 万 – 84 万 (30.1%) | 84 万 – 84 万 | 84 万 → S$ 267,980 | ❌ 差 S$ 1,980 | 1.9% | ❌ balanced transaction cash short: S$ 1,980
C07 | 55岁 + 30年 = 85（55%，退休边缘） | 274 万 – 343 万 | 343 万 – 345 万 (30.1%) | 345 万 – 345 万 | 344 万 → S$ 1,396,000 | ⚠️ 应急金差 S$ 196,000 | 1.1% | ℹ balanced emergency fund short: S$ 196,000 (交易可行，应急金不够)
C08 | 70岁 + 20年 = 90（schema 上限 80 应当拒绝？） | 253 万 – 316 万 | 316 万 – 331 万 (35.0%) | 331 万 – 393 万 | 324 万 → S$ 1,554,847 | ⚠️ 应急金差 S$ 54,847 | -1.5% | ℹ balanced emergency fund short: S$ 54,847 (交易可行，应急金不够)
## D · 现金/收入失衡（12）— 病态画像
> 
> 
> 
> 目的：揭示三档区间在病态画像下行为。最容易暴露不 make sense 的输出。
> 
> 
| ID | 画像 | 舒适区 | 平衡区 (月供占比) | 压力区 | 平衡中点 → 需现金 | 现金可行 | g* 平衡 | 旗 |
|---|---|---|---|---|---|---|---|---|
D01 | 现金死锁 · 月入 30K · 现金 5万 | 55 万 – 69 万 | 69 万 – 69 万 (8.2%) | 69 万 – 69 万 | 69 万 → S$ 249,680 | ❌ 差 S$ 1,680 | -1.2% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 1,680
D02 | 收入死锁 · 月入 5K · 现金 500万 | 420 万 – 525 万 | 525 万 – 530 万 (35.0%) | 530 万 – 550 万 | 528 万 → S$ 5,006,843 | ⚠️ 应急金差 S$ 6,843 | 4.8% | ℹ balanced emergency fund short: S$ 6,843 (交易可行，应急金不够)
D03 | CPF 富现金薄 · 月入 15K · 现金 15万 · CPF 80万 | 144 万 – 180 万 | 180 万 – 180 万 (31.5%) | 180 万 – 180 万 | 180 万 → S$ 252,600 | ❌ 差 S$ 3,600 | -5.3% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,600<br>ℹ balanced g* < −2% (轻微下跌也划算)
D04 | 超高净值 · 月入 50K · 现金 1000万 | 1034 万 – 1292 万 | 1292 万 – 1342 万 (35.0%) | 1342 万 – 1539 万 | 1317 万 → S$ 10,068,228 | ⚠️ 应急金差 S$ 68,228 | 4.3% | ℹ balanced emergency fund short: S$ 68,228 (交易可行，应急金不够)
D05 | 0 现金 · 月入 25K | — – — | — – — (0.0%) | — – — | — → S$ 165,000 | ❌ INSUFFICIENT_CASH | 0.0% | ❌ balanced infeasible: INSUFFICIENT_CASH<br>❌ aggressive price = 0
D06 | 0 CPF + 高收入 SC · 月入 30K · 现金 50万 · CPF 0 | 84 万 – 105 万 | 105 万 – 105 万 (9.2%) | 105 万 – 105 万 | 105 万 → S$ 699,700 | ❌ 差 S$ 1,700 | 3.3% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 1,700
D07 | 极低收入 SC · 月入 5K · 现金 30万 | 55 万 – 69 万 | 69 万 – 74 万 (35.0%) | 74 万 – 95 万 | 72 万 → S$ 304,583 | ⚠️ 应急金差 S$ 4,583 | 0.8% | ℹ balanced emergency fund short: S$ 4,583 (交易可行，应急金不够)
D08 | 退休边缘 · 60岁 · 月入 10K · 现金 100万 · CPF 30万 | 138 万 – 173 万 | 173 万 – 181 万 (35.0%) | 181 万 – 213 万 | 177 万 → S$ 1,020,523 | ⚠️ 应急金差 S$ 20,523 | 0.2% | ℹ balanced emergency fund short: S$ 20,523 (交易可行，应急金不够)
D09 | PR 二套现金足 · 月入 30K · 200万现金 | 215 万 – 269 万 | 269 万 – 269 万 (19.3%) | 269 万 – 269 万 | 269 万 → S$ 2,192,600 | ⚠️ 应急金差 S$ 192,600 | — | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 192,600 (交易可行，应急金不够)
D10 | 高合并收入 · 月入 50K · 现金 80万 · 首套 | 325 万 – 406 万 | 406 万 – 406 万 (29.1%) | 406 万 – 406 万 | 406 万 → S$ 1,132,200 | ❌ 差 S$ 2,200 | 1.4% | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 2,200
D11 | 负债大户 · 月入 15K · 月供债务 8K · 首套 | — – — | — – — (0.0%) | — – 63 万 | — → S$ 99,000 | ❌ INSUFFICIENT_CASH | 0.0% | ❌ balanced infeasible: INSUFFICIENT_CASH
D12 | 极短持有 · 月入 25K · 现金 60万 · H=2 年 | 190 万 – 238 万 | 238 万 – 263 万 (35.0%) | 263 万 – 309 万 | 251 万 → S$ 641,314 | ⚠️ 应急金差 S$ 41,314 | -1.6% | ℹ balanced emergency fund short: S$ 41,314 (交易可行，应急金不够)
## E · 参数微调（8）— 结果页 4 参数边界
> 
> 
> 
> 
> 目的：4 参数（持有/利率/租金/年限）改动是否合理联动。
> 
| ID | 画像 | 舒适区 | 平衡区 (月供占比) | 压力区 | 平衡中点 → 需现金 | 现金可行 | g* 平衡 | 旗 |
|---|---|---|---|---|---|---|---|---|
E01 | 持有 1 年（A06 基线，仅改 holdingYears） | 122 万 – 152 万 | 152 万 – 165 万 (32.5%) | 165 万 – 165 万 | 159 万 → S$ 445,280 | ⚠️ 应急金差 S$ 95,280 | -1.0% | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够)
E02 | 持有 30 年（A06 基线） | 122 万 – 152 万 | 152 万 – 165 万 (32.5%) | 165 万 – 165 万 | 159 万 → S$ 445,280 | ⚠️ 应急金差 S$ 95,280 | 3.0% | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够)
E03 | 利率 1.5%（A06 基线，最低） | 122 万 – 152 万 | 152 万 – 165 万 (32.5%) | 165 万 – 165 万 | 159 万 → S$ 445,280 | ⚠️ 应急金差 S$ 95,280 | 1.2% | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够)
E04 | 利率 4.0%（A06 基线，最高） | 122 万 – 152 万 | 152 万 – 165 万 (32.5%) | 165 万 – 165 万 | 159 万 → S$ 445,280 | ⚠️ 应急金差 S$ 95,280 | 3.0% | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够)
E05 | 租金极低 S$ 1000（A06 基线） | 122 万 – 152 万 | 152 万 – 165 万 (32.5%) | 165 万 – 165 万 | 159 万 → S$ 445,280 | ⚠️ 应急金差 S$ 95,280 | 1.3% | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够)
E06 | 租金极高 S$ 15,000（A06 基线） | 122 万 – 152 万 | 152 万 – 165 万 (32.5%) | 165 万 – 165 万 | 159 万 → S$ 445,280 | ⚠️ 应急金差 S$ 95,280 | 1.3% | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够)
E07 | 贷款年限 20 年（A06 基线） | 105 万 – 131 万 | 131 万 – 144 万 (35.0%) | 144 万 – 165 万 | 138 万 → S$ 396,801 | ⚠️ 应急金差 S$ 46,801 | 1.2% | ℹ balanced emergency fund short: S$ 46,801 (交易可行，应急金不够)
E08 | 全部默认 + holdingYears=15（A06 中间路径） | 122 万 – 152 万 | 152 万 – 165 万 (32.5%) | 165 万 – 165 万 | 159 万 → S$ 445,280 | ⚠️ 应急金差 S$ 95,280 | 2.0% | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够)
## F · 健壮性（5）— 系统输入边界
> 
> 
> 
> 
> 
> 目的：极端输入下引擎不应崩。schema 拦截另在 API 层。
| ID | 画像 | 舒适区 | 平衡区 (月供占比) | 压力区 | 平衡中点 → 需现金 | 现金可行 | g* 平衡 | 旗 |
|---|---|---|---|---|---|---|---|---|
F01 | 年龄 18（schema min=21，应被拦截） | 68 万 – 85 万 | 85 万 – 91 万 (31.5%) | 91 万 – 91 万 | 88 万 → S$ 259,260 | ⚠️ 应急金差 S$ 59,260 | 1.5% | ℹ balanced emergency fund short: S$ 59,260 (交易可行，应急金不够)
F02 | 年龄 85（schema max=80，引擎层应不崩） | 150 万 – 188 万 | 188 万 – 195 万 (35.0%) | 195 万 – 223 万 | 192 万 → S$ 1,570,057 | ⚠️ 应急金差 S$ 70,057 | 5.1% | ℹ balanced emergency fund short: S$ 70,057 (交易可行，应急金不够)<br>⚠️ balanced g* > 5% (赌注极大)
F03 | 现金 1 亿（远超 30M 房价上限） | 2399 万 – 2999 万 | 2999 万 – 2999 万 (35.0%) | 2999 万 – 2999 万 | 2999 万 → S$ 24,561,857 | ✓ | 4.8% | ⚠️ tiers degenerate (三档收敛)
F04 | 收入 1 亿/年（超极端） | 2399 万 – 2999 万 | 2999 万 – 2999 万 (0.9%) | 2999 万 – 2999 万 | 2999 万 → S$ 69,238,500 | ⚠️ 应急金差 S$ 19,238,500 | 3.6% | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 19,238,500 (交易可行，应急金不够)
F05 | 月供债务 ≥ 月入 × TDSR（透支 TDSR） | — – — | — – — (0.0%) | — – — | — → S$ 66,000 | ❌ INSUFFICIENT_CASH | 0.0% | ❌ balanced infeasible: INSUFFICIENT_CASH<br>❌ aggressive price = 0### E 类：自定义租金的 break-even 对比

用户在结果页手动改租金时，break-even 涨幅会变。这里展示 rent override 与默认估算的差。

| ID | 默认 g* | 自定义租金 g* | 含义 |
|---|---|---|---|
| E05 | 1.3% | 3.5% | 租金更低 → g\* 更高（更难) |
| E06 | 1.3% | -10.0% | 租金更高 → g\* 更低（更容易） |

## 跨身份对比

同收入/现金，不同身份下能买多少差多少。这是 ABSD 决策力的直观表现。

### 12K, 30万 cash, 100K CPF, 32岁 首套

| ID | 身份 | 套数 | 平衡区 | g* 平衡 |
|---|---|---|---|---|
| B09 | citizen | 首套 | 112 万 – 124 万 | 1.2% |
| B11 | citizen | 首套 | 112 万 – 124 万 | 1.2% |
| A05 | pr | 首套 | 107 万 – 118 万 | 2.1% |

### 30K, 80万 cash, 300K CPF, 38岁 首套

| ID | 身份 | 套数 | 平衡区 | g* 平衡 |
|---|---|---|---|---|
| B12 | citizen | 首套 | 226 万 – 226 万 | 1.4% |
| B13 | pr | 首套 | 205 万 – 205 万 | 2.0% |
| B14 | foreigner | 首套 | 74 万 – 74 万 | 11.2% |

### 25K, 60万 cash, 首套

| ID | 身份 | 套数 | 平衡区 | g* 平衡 |
|---|---|---|---|---|
| A08 | citizen | 首套 | 242 万 – 267 万 | 0.7% |
| B01 | citizen | 二套 | 128 万 – 128 万 | — |

## 异常清单（58 个 persona 有旗）

按严重程度倒序：🔴 红 > ❌ 不可行 > ⚠️ 警告 > ℹ 信息

| ID | 画像 | 旗 |
|---|---|---|
| A03 | SC · 月入 30K · 40岁 · 100万现金 · 40万CPF · 首套 | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,600<br>🔴 expected feasible but transaction not affordable |
| A07 | PR · 月入 25K · 38岁 · 60万现金 · 30万CPF · 首套 | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 2,980<br>🔴 expected feasible but transaction not affordable |
| A09 | SC · 月入 15K · 28岁 · 25万现金 · 10万CPF · 首套 | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 100<br>🔴 expected feasible but transaction not affordable |
| B10 | PR 首套（高收入）· 月入 50K · 200万现金 · 50万CPF | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 2,800<br>🔴 expected feasible but transaction not affordable |
| B05 | 外籍 WP · 月入 25K · 80万现金 · CPF=0 · 首套 | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 160,780 (交易可行，应急金不够)<br>⚠️ balanced g* > 5% (赌注极大)<br>🔴 expected infeasible but transaction is affordable |
| B07 | 外籍 WP · 月入 15K · 50万现金 · 首套 | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 96,840 (交易可行，应急金不够)<br>⚠️ balanced g* > 5% (赌注极大)<br>🔴 expected infeasible but transaction is affordable |
| A01 | SC · 月入 12K · 35岁 · 30万现金 · 20万CPF · 首套 | ℹ balanced emergency fund short: S$ 18,323 (交易可行，应急金不够)<br>🔴 balanced g* -0.0% outside expected 1.0% – 3.0% |
| A06 | PR · 月入 17.5K · 35岁 · 35万现金 · 20万CPF · 首套（你的画像） | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够)<br>🔴 balanced g* 1.3% outside expected 1.5% – 2.5% |
| A08 | SC · 月入 25K · 32岁 · 60万现金 · 35万CPF · 首套（spec §11 #2 验收） | ℹ balanced emergency fund short: S$ 33,314 (交易可行，应急金不够)<br>🔴 balanced g* 0.7% outside expected 1.8% – 2.8% |
| D05 | 0 现金 · 月入 25K | ❌ balanced infeasible: INSUFFICIENT_CASH<br>❌ aggressive price = 0 |
| F05 | 月供债务 ≥ 月入 × TDSR（透支 TDSR） | ❌ balanced infeasible: INSUFFICIENT_CASH<br>❌ aggressive price = 0 |
| D03 | CPF 富现金薄 · 月入 15K · 现金 15万 · CPF 80万 | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,600<br>ℹ balanced g* < −2% (轻微下跌也划算) |
| B02 | SC 三套 · 月入 50K · 200万现金 · 50万CPF | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 2,600 |
| B04 | PR 三套 · 月入 40K · 150万现金 · 40万CPF | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 2,100 |
| B08 | 外籍 WP 二套 · 月入 40K · 200万现金 | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 1,480 |
| B12 | SC 首套高收入 · 月入 30K · 80万现金 | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,600 |
| B13 | PR 首套 · 月入 30K · 80万现金 · vs B12 | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 1,100 |
| B15 | SC 三套（极端） · 月入 50K · 500万现金 | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,800 |
| C02 | 36岁 + 30年 = 66（应掉到 55%） | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,220 |
| C03 | 50岁 + 25年 = 75（55%） | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 3,600 |
| D01 | 现金死锁 · 月入 30K · 现金 5万 | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 1,680 |
| D06 | 0 CPF + 高收入 SC · 月入 30K · 现金 50万 · CPF 0 | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 1,700 |
| D10 | 高合并收入 · 月入 50K · 现金 80万 · 首套 | ⚠️ tiers degenerate (三档收敛)<br>❌ balanced transaction cash short: S$ 2,200 |
| C06 | 21岁 + 30年 = 51（最年轻 + 长贷） | ❌ balanced transaction cash short: S$ 1,980 |
| D11 | 负债大户 · 月入 15K · 月供债务 8K · 首套 | ❌ balanced infeasible: INSUFFICIENT_CASH |
| B06 | 外籍无身份 · 月入 50K · 200万现金 · 首套 | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 327,600 (交易可行，应急金不够)<br>⚠️ balanced g* > 5% (赌注极大) |
| B14 | 外籍首套 · 月入 30K · 80万现金 · vs B12/B13 | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 193,780 (交易可行，应急金不够)<br>⚠️ balanced g* > 5% (赌注极大) |
| A04 | SC · 月入 50K · 45岁 · 200万现金 · 50万CPF · 首套 | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 328,700 (交易可行，应急金不够) |
| B01 | SC 二套 · 月入 25K · 60万现金 · 40万CPF | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 163,860 (交易可行，应急金不够) |
| B03 | PR 二套 · 月入 25K · 60万现金 · 30万CPF | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 159,940 (交易可行，应急金不够) |
| D09 | PR 二套现金足 · 月入 30K · 200万现金 | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 192,600 (交易可行，应急金不够) |
| F02 | 年龄 85（schema max=80，引擎层应不崩） | ℹ balanced emergency fund short: S$ 70,057 (交易可行，应急金不够)<br>⚠️ balanced g* > 5% (赌注极大) |
| F04 | 收入 1 亿/年（超极端） | ⚠️ tiers degenerate (三档收敛)<br>ℹ balanced emergency fund short: S$ 19,238,500 (交易可行，应急金不够) |
| F03 | 现金 1 亿（远超 30M 房价上限） | ⚠️ tiers degenerate (三档收敛) |
| A02 | SC · 月入 18K · 35岁 · 50万现金 · 25万CPF · 首套 | ℹ balanced emergency fund short: S$ 28,294 (交易可行，应急金不够) |
| A05 | PR · 月入 12K · 32岁 · 30万现金 · 10万CPF · 首套 | ℹ balanced emergency fund short: S$ 50,760 (交易可行，应急金不够) |
| A10 | PR 夫妻合并 · 月入 22K · 33岁 · 45万现金 · 25万CPF · 首套 | ℹ balanced emergency fund short: S$ 118,800 (交易可行，应急金不够) |
| B09 | SC 首套 · 同 A02 但 12K（最低端）· 比较 ABSD 0% | ℹ balanced emergency fund short: S$ 14,123 (交易可行，应急金不够) |
| B11 | SC 首套 vs B09 PR 首套同画像（重复对比组） | ℹ balanced emergency fund short: S$ 14,123 (交易可行，应急金不够) |
| C01 | 35岁 + 30年 = 65（临界，仍 75%） | ℹ balanced emergency fund short: S$ 31,371 (交易可行，应急金不够) |
| C04 | 50岁 + 15年 = 65（仍 75%） | ℹ balanced emergency fund short: S$ 103,082 (交易可行，应急金不够) |
| C05 | 60岁 + 5年 = 65（极端短贷 75%） | ℹ balanced emergency fund short: S$ 109,007 (交易可行，应急金不够) |
| C07 | 55岁 + 30年 = 85（55%，退休边缘） | ℹ balanced emergency fund short: S$ 196,000 (交易可行，应急金不够) |
| C08 | 70岁 + 20年 = 90（schema 上限 80 应当拒绝？） | ℹ balanced emergency fund short: S$ 54,847 (交易可行，应急金不够) |
| D02 | 收入死锁 · 月入 5K · 现金 500万 | ℹ balanced emergency fund short: S$ 6,843 (交易可行，应急金不够) |
| D04 | 超高净值 · 月入 50K · 现金 1000万 | ℹ balanced emergency fund short: S$ 68,228 (交易可行，应急金不够) |
| D07 | 极低收入 SC · 月入 5K · 现金 30万 | ℹ balanced emergency fund short: S$ 4,583 (交易可行，应急金不够) |
| D08 | 退休边缘 · 60岁 · 月入 10K · 现金 100万 · CPF 30万 | ℹ balanced emergency fund short: S$ 20,523 (交易可行，应急金不够) |
| D12 | 极短持有 · 月入 25K · 现金 60万 · H=2 年 | ℹ balanced emergency fund short: S$ 41,314 (交易可行，应急金不够) |
| E01 | 持有 1 年（A06 基线，仅改 holdingYears） | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够) |
| E02 | 持有 30 年（A06 基线） | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够) |
| E03 | 利率 1.5%（A06 基线，最低） | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够) |
| E04 | 利率 4.0%（A06 基线，最高） | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够) |
| E05 | 租金极低 S$ 1000（A06 基线） | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够) |
| E06 | 租金极高 S$ 15,000（A06 基线） | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够) |
| E07 | 贷款年限 20 年（A06 基线） | ℹ balanced emergency fund short: S$ 46,801 (交易可行，应急金不够) |
| E08 | 全部默认 + holdingYears=15（A06 中间路径） | ℹ balanced emergency fund short: S$ 95,280 (交易可行，应急金不够) |
| F01 | 年龄 18（schema min=21，应被拦截） | ℹ balanced emergency fund short: S$ 59,260 (交易可行，应急金不够) |

---

*Generated 2026-06-20 by scripts/run-personas.ts*
