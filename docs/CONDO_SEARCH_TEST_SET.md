# Condo Search — 搜索部分测试集（Test Set）

> 源文档：[CONDO_SEARCH_SPEC.md](./CONDO_SEARCH_SPEC.md) §3（搜索入口与结果）· [CONDO_SEARCH_SEARCH_TD.md](./CONDO_SEARCH_SEARCH_TD.md)（搜索后端 TD：域模型 / 两侧 ACL / 端口 / 兜底）
>
> 本文是「搜索部分」的**测试用例清单 + 验收追溯**，把设计文档的验收项（SPEC §13 搜索子集、TD §11）拆成**单一、可断言**的用例。风格对齐 [V2_TEST_REPORT.md](./V2_TEST_REPORT.md)。
>
> **本次修订（v2）相对初稿的改动**：① 现状拆成「行为/契约」两轴（修复 ✅/🟡 标准漂移）；② 修正事实错误（tags 字段不存在、补全 limit 硬编码、fitHint 属前端）；③ 新增默认排序 bug 用例 `O06`（真 bug）与邮编/街道缺口 `S11`；④ 黄金数据改用真实 seed（`scripts/condo-seed.ts`）的确切值；⑤ 加 P0/P1/P2 优先级、api 用例 seed 策略（§14）、合规 grep 与契约快照样例。

| 字段 | 值                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------ |
| 范围 | 自动补全 + 结果列表 + 排序/筛选/分页 + 卡片裁决 + 两侧 ACL + 兜底（冷启动/零结果）+ 解耦 + 安全                    |
| 源   | SPEC §3 / §6.3 / §8 / §13；TD §2–§11（下文 `TD §x` 一律指 CONDO_SEARCH_SEARCH_TD，`SPEC §x` 指 CONDO_SEARCH_SPEC） |
| 状态 | Draft — 落地见 §15（横跨 `tests/unit/lib/condo*`、`tests/unit/lib/project-scoring`、`tests/e2e`）                  |

---

## 0. 图例（务必先读）

**两轴现状**（每个用例分别标，避免「能跑」与「合架构」混为一谈）：

| 列   | 含义                     | 取值                                                          |
| ---- | ------------------------ | ------------------------------------------------------------- |
| 行为 | 运行时行为是否**正确**   | ✅ 正确 · 🟡 部分/有缺陷 · 🐞 已知 bug · 🔜 未实现 · — 不适用 |
| 契约 | 是否符合 **TD 目标架构** | ✅ 符合 · 🟡 形状不符 · 🔜 模块未建 · — 不涉及                |

**其他列**：

- **优**：P0 上线必过（gating）· P1 重要 · P2 可延后。
- **类型**：每组在标题注明**默认类型**；个别行偏离时在「场景」里用 `[unit]`/`[api]`/`[e2e]`/`[lint]` 标注。
- **依据**：`SPEC §x` 或 `TD §x`。
- 黄金数据见 §13，与 seed 一致以保证确定性可复现（SPEC §13）。

> 现状一栏的判定依据集中在 §12「设计↔实现差异」，§14「api 用例 seed 策略」。

---

## 1. 覆盖矩阵（验收项 → 测试组）

| 验收项（SPEC §13 / TD §11）                                    | 测试组     |
| -------------------------------------------------------------- | ---------- |
| 搜索 API 全程只读、请求时零外部调用                            | L, X       |
| 入站 ACL：脏/缺/超界入参被收敛，下游只见干净 `SearchQuery`     | A          |
| 出站 ACL：前端契约不含 DB 列名/评分内部字段；改 DB 列只动映射  | R          |
| `domain`/`ports` 零外部 import；`SearchService` 内存 repo 可测 | K, R       |
| 查无结果 `ok:true`+`fallback`；冷启动不出空列表；零结果留资    | B          |
| 全链路无 `valuation/估值`（PSF 仅「成交区间」）                | X (lint)   |
| 自动补全（名称/区/**街道/邮编**模糊）+ 结果卡片预览            | S, L, V    |
| 排序（盈利降序 / PSF 低→高 / TOP 新→旧）+ 按区筛选 + 分页      | O, P       |
| 卡片裁决徽章 + 「相似盘估算」角标 + 适配度软提示               | V, K       |
| 搜索埋点（started / zero_result / compare_added）              | B, K (e2e) |

---

## 2. S · 自动补全（`GET /api/v1/condo/search?q=`）— 默认类型 `api`

> SPEC §3.1 · TD §5.3。实现：[search/route.ts](../app/api/v1/condo/search/route.ts) + `searchActiveProjects`（[repo.ts:166](../lib/condo/repo.ts)）。当前 `or(name.ilike, district.ilike)`，硬编码 limit 8。

| ID  | 场景                 | 输入                        | 预期（可断言）                                                                             | 依据      | 优  | 行为 | 契约 |
| --- | -------------------- | --------------------------- | ------------------------------------------------------------------------------------------ | --------- | --- | ---- | ---- |
| S01 | 命中楼盘名（子串）   | `q=Gaz`                     | `ok:true`；`results[0].slug='the-gazania'`；每条仅 slug/name/district/tenure/psfMin/psfMax | SPEC §3.1 | P0  | ✅   | 🟡   |
| S02 | 命中区代码           | `q=D19`                     | `results` 含 `the-gazania`（走 `district.ilike`）                                          | SPEC §3.1 | P1  | ✅   | 🟡   |
| S03 | 大小写 + 空格不敏感  | `q='  gaZANia '`            | trim+ilike → 与 `Gazania` 同结果                                                           | SPEC §3.1 | P1  | ✅   | 🟡   |
| S04 | 空 query             | `q=` 缺省                   | `ok:true` + `results:[]`，不查库（route 内 `length<1` 短路）                               | SPEC §3.1 | P1  | ✅   | 🟡   |
| S05 | 仅空白 query         | `q='   '`                   | trim 后视为空 → `results:[]`                                                               | SPEC §3.1 | P1  | ✅   | 🟡   |
| S06 | 零结果（无此盘）     | `q=NotARealCondo`           | `ok:true` + `results:[]`（**非 error**），供前端埋 zero_result                             | SPEC §3.1 | P0  | ✅   | 🟡   |
| S07 | 超长 query           | `q=`（81 字符）             | ✅ 被 zod 拒绝（max 80）→ `INVALID_INPUT`，不进 SQL                                        | TD §4.2   | P1  | ✅   | 🟡   |
| S08 | 只返回 active        | 库含同名 `stub` 盘          | 结果**不含** stub/hidden                                                                   | SPEC §6.3 | P0  | ✅   | ✅   |
| S09 | limit 上限           | 命中 >8 条                  | 当前**硬编码 8**、不读 `limit` 参数；TD 要求默认 8/上限 20 且参数化                        | TD §4.2   | P2  | 🟡   | 🔜   |
| S10 | ilike 通配符当字面量 | `q=%`                       | ✅ `%`/`_`/`\` 经 `escapeLike` 转义为字面量（repo.test.ts）                                | SPEC §6.3 | P1  | ✅   | 🟡   |
| S11 | 街道 / 邮编模糊      | `q=Upper Serangoon` / `534` | 应命中（SPEC 要求「街道/邮编模糊」）；当前**仅** name+district 不支持                      | SPEC §3.1 | P1  | 🔜   | 🔜   |

> **说明**：S01–S06「契约 🟡」因 autocomplete 响应当前是 `{query, results}`，TD §5.3 的稳定契约是 `{suggestions:[{slug,name,district,kind}]}`（含 `kind`）——形状不符。S07/S10 已修复（route 加 `q` max 80；repo `escapeLike` 转义），「契约 🟡」指仍内联在 route，尚未收口到独立 `acl/request.ts`（见 §12-⑥c）。

---

## 3. L · 结果列表（`GET /api/v1/condo/projects`）— 默认类型 `api`

> SPEC §3.2 · TD §5.2。实现：[projects/route.ts](../app/api/v1/condo/projects/route.ts) + `listCards`（[search.ts](../lib/condo/search.ts)）。当前响应 `{cards, count}`；`CondoCard` 字段见 [types.ts](../lib/condo/types.ts)（**无 tags 字段**）。

| ID  | 场景                   | 输入                          | 预期（可断言）                                                                                                          | 依据      | 优  | 行为 | 契约 |
| --- | ---------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------- | --- | ---- | ---- |
| L01 | 默认列表 [api]         | （无参）                      | `ok:true`；每张 card 含 slug/name/district/tenure/topYear/totalUnits/psfMin/psfMax/profitScore/profitConfidence/verdict | SPEC §3.2 | P0  | ✅   | 🟡   |
| L02 | 卡片四要素 [unit]      | listCards(G1)                 | 含 盈利分(`profitScore`) + 结论徽章(`verdict.tier`) + PSF(`psfMin/psfMax`) + 关键字段(tenure/topYear)                   | SPEC §3.2 | P0  | ✅   | 🟡   |
| L03 | 按区筛选 [api]         | `district=D19`                | 仅返回 D19 active 盘（`the-gazania`）                                                                                   | SPEC §3.2 | P0  | ✅   | ✅   |
| L04 | 空区（无盘）[api]      | `district=D28`                | `ok:true` + `cards:[]` + `count:0`（不报错）                                                                            | SPEC §5.4 | P1  | ✅   | 🟡   |
| L05 | limit 边界 [api]       | `limit=60` / `0` / `61`       | 60 通过；0/61 → `INVALID_INPUT`（zod min1 max60）                                                                       | TD §4.2   | P1  | ✅   | 🟡   |
| L06 | 只读 active [api]      | 库含 stub/hidden              | 列表不含 stub/hidden                                                                                                    | SPEC §6.3 | P0  | ✅   | ✅   |
| L07 | 请求时零外部调用 [api] | mock URA/OneMap 客户端        | 任一请求**未调用**外部 source（断言 mock 调用次数 0）                                                                   | SPEC §13  | P0  | ✅   | ✅   |
| L08 | N+1 防护 [unit]        | N 个盘                        | 仅 2 次 DB 读：`listActiveProjects` + `getScoresForProjects`（批量 `in`）                                               | TD §6.1   | P1  | ✅   | ✅   |
| L09 | 无评分盘 [unit]        | 盘有档案、无 `project_scores` | `profitScore:null`；`verdict.tier='orange'`（mean=null）；不抛                                                          | SPEC §4.3 | P1  | ✅   | ✅   |

> **L01/L02/L04「契约 🟡」**：`CondoCard` 与 TD §4.4 的 `ProjectCardDTO` 形状不符——TD 要 `psfRange{min,max,periodEnd}`（非分离的 psfMin/psfMax）、`verdict ∈ {green,amber,orange}`（非含中文 label 的对象）、`estimatedFromSimilar`、`tags[]`、`fitHint`、`fallback`。见 §12-①。

---

## 4. O · 排序（SortSpec）— 默认类型 `api`，纯逻辑标 `[unit]`

> SPEC §3.2 · TD §8。三档 `profit`(默认降序)/`psf_asc`/`top_desc`，null 排末尾。实现：`psf_asc`/`top_desc` 在 SQL（`listActiveProjects`），`profit` 在 JS（`listCards`）。

| ID  | 场景                             | 输入                           | 预期（可断言）                                                                            | 依据     | 优  | 行为 | 契约 |
| --- | -------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- | -------- | --- | ---- | ---- |
| O01 | profit 降序（组内）[unit]        | `sort=profit`                  | 返回数组按 `profitScore` 降序；`null` 分排末尾（`?? -1`）                                 | TD §8    | P0  | ✅   | 🟡   |
| O02 | PSF 低→高 [api]                  | `sort=psf_asc`                 | `psfMin` 升序，缺 PSF 末尾（SQL `nullsFirst:false`）                                      | TD §8    | P1  | ✅   | ✅   |
| O03 | TOP 新→旧 [api]                  | `sort=top_desc`                | `topYear` 降序，缺 TOP 末尾                                                               | TD §8    | P1  | ✅   | ✅   |
| O04 | 未知 sort 值 [api]               | `sort=foobar`                  | **单一口径（待 §12-② 决议）**：当前 `z.enum` → `INVALID_INPUT`；TD §4.2 期望回退 `profit` | TD §4.2  | P2  | 🟡   | 🟡   |
| O05 | 同分稳定性 [unit]                | 两盘同 profit                  | 次序确定、可复现（项目名序为稳定基线）                                                    | SPEC §13 | P2  | ✅   | 🟡   |
| O06 | ❗默认排序的 Top-N 正确性 [unit] | 5 盘、`limit=3`、`sort=profit` | 返回**全库 profit 最高的 3 盘**（先 sort 后 slice）                                       | TD §8    | P0  | ✅   | 🟡   |

> **O06 已修复（P0）**：`listCards` 现对 profit 排序**先取全集（≤`MAX_SCAN`=3000，SPEC §6.5）再 sort-then-slice**，返回真·盈利 Top-N；`psf_asc`/`top_desc` 仍走 SQL `ORDER BY + LIMIT`。回归测试 [tests/unit/lib/condo/search.test.ts](../tests/unit/lib/condo/search.test.ts) 锁定（用「name 序≠profit 序」的 fixture 区分两种行为）。**契约仍 🟡**：长期应预冷 `projects.profit_score` 冗余列 + SQL `ORDER BY ... NULLS LAST`，删掉内存扫描（TD §6.1/§8）。见 §12-⑦。
> **O05 顺带修复**：profit 子集来自 SQL 的 name 排序，等分项保持确定次序。
> **O04「行为 🟡」**：不是错，是口径未决——一个用例只能有一个预期，必须先在 §12-② 选定「严格拒绝」或「宽松回退」。

---

## 5. P · 筛选 / 分页 — 默认类型 `api`

> TD §8（offset 分页）。**整组当前未实现**：`/projects` 仅 `limit`，无 `page/pageSize/total`；`district` 仅 `max(10)`、不规范化、无 `D` 格式校验。

| ID  | 场景          | 输入                        | 预期（可断言）                                     | 依据      | 优  | 行为 | 契约 |
| --- | ------------- | --------------------------- | -------------------------------------------------- | --------- | --- | ---- | ---- |
| P01 | 区代码规范化  | `district=d19`              | ✅ zod `toUpperCase` → `D19` 再查                  | TD §4.2   | P1  | ✅   | 🟡   |
| P02 | 非法区格式    | `district=XYZ` / `D999`     | ✅ `INVALID_INPUT`（regex `^D\d{1,2}$`），不进 SQL | TD §4.2   | P1  | ✅   | 🟡   |
| P03 | 分页第二页    | `page=2&pageSize=12`        | 返回第 13–24 条；`total` 为总数                    | TD §8     | P1  | 🔜   | 🔜   |
| P04 | pageSize 上限 | `pageSize=24` / `99`        | 24 通过；>24 收敛/拒绝                             | TD §6.3   | P1  | 🔜   | 🔜   |
| P05 | page 上限     | `page=200` / `999`          | 200 通过；>200 收敛/拒绝（防扫库）                 | TD §6.3   | P1  | 🔜   | 🔜   |
| P06 | total 返回    | 任一列表                    | 响应含 `total`，前端可渲染页码                     | TD §8     | P1  | 🔜   | 🔜   |
| P07 | 筛选+排序组合 | `district=D19&sort=psf_asc` | D19 内按 psfMin 升序                               | SPEC §3.2 | P1  | ✅   | 🟡   |

> 见 §12-③。

---

## 6. V · 卡片裁决与评分视图 — 默认类型 `unit`（**上游契约**，逻辑属 `lib/project-scoring`）

> SPEC §4.1.2 / §4.3 · TD §3。逻辑：[verdict.ts](../lib/project-scoring/verdict.ts)（profit+location 均值：`>=6.5` green / `>=4.5` amber / else orange；均值 null → orange）。本组**测试目标在评分引擎**，搜索侧只消费其结果；落地见 §15（放 `verdict.test.ts`）。

| ID  | 场景                 | 输入（profit, location）                | 预期（可断言）                                                                                   | 依据        | 优  | 行为 | 契约 |
| --- | -------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------- | --- | ---- | ---- |
| V01 | 高分 → 值得入候选    | (7.0, 7.0) mean 7.0                     | `tier='green'`, `label='值得入候选'`                                                             | SPEC §4.1.2 | P0  | ✅   | ✅   |
| V02 | 中分 → 值得比较      | (5.0, 4.5) mean 4.75                    | `tier='amber'`, `label='值得比较'`                                                               | SPEC §4.1.2 | P0  | ✅   | ✅   |
| V03 | 低分 → 谨慎比较      | (3.0, 4.0) mean 3.5                     | `tier='orange'`, `label='谨慎比较'`                                                              | SPEC §4.1.2 | P0  | ✅   | ✅   |
| V04 | 边界 6.5             | mean 恰 6.5                             | `green`（含等号）                                                                                | SPEC §4.1.2 | P0  | ✅   | ✅   |
| V05 | 边界 4.5             | mean 恰 4.5                             | `amber`（含等号）                                                                                | SPEC §4.1.2 | P0  | ✅   | ✅   |
| V06 | 仅 location 有分     | (null, 6.0)                             | mean=6.0 → `amber`（只算到位维度）                                                               | SPEC §4.2   | P1  | ✅   | ✅   |
| V07 | 两维皆缺             | (null, null)                            | mean=null → `tier='orange'`, `label='谨慎比较'`                                                  | SPEC §4.3   | P1  | ✅   | ✅   |
| V08 | 退出/租赁不计入      | 任意 exit/rental 分                     | 句尾常驻「退出与租赁两维数据仍在接入，本次结论暂不计入」；不改 tier                              | SPEC §4.2   | P1  | ✅   | ✅   |
| V09 | 一句话结论无幻觉数字 | 任一裁决                                | sentence 全模板拼装；数字仅来自 `components.nearestMrtWalkMin`                                   | SPEC §5     | P0  | ✅   | ✅   |
| V10 | 「相似盘估算」→ 角标 | profit `confidence='estimated_similar'` | 搜索层应映射 `estimated=true`（→ DTO `estimatedFromSimilar`）；当前仅透传原始 `profitConfidence` | SPEC §4.3   | P1  | 🟡   | 🔜   |
| V11 | 数据不足 → 主分 N/A  | profit `score=null`                     | `profitScore=null`、band 显「数据不足」，不硬凑 0                                                | SPEC §4.3   | P1  | ✅   | ✅   |

---

## 7. A · 入站 ACL（请求防腐层，约束 B）— 默认类型 `unit`

> TD §4.2。目标：脏/缺/超界入参在 `request.ts` 收敛，下游只见干净 `SearchQuery`。**当前 `lib/condo-search/acl/request.ts` 未建**，校验内联在 route，无 `SORT_MAP` 别名、无 keyword 域字段。

| ID  | 场景              | 输入                       | 预期（可断言）                                        | 依据    | 优  | 行为 | 契约 |
| --- | ----------------- | -------------------------- | ----------------------------------------------------- | ------- | --- | ---- | ---- |
| A01 | 字符串数字 coerce | `page="2"`,`pageSize="12"` | `z.coerce.number` → number                            | TD §4.2 | P1  | 🔜   | 🔜   |
| A02 | 缺省值填充        | 全缺                       | `sort='profit_desc'`,`page=1`,`pageSize=12`           | TD §4.2 | P1  | 🔜   | 🔜   |
| A03 | 排序别名映射      | `sort=psf`                 | `SORT_MAP` → `psf_asc`                                | TD §4.2 | P1  | 🔜   | 🔜   |
| A04 | keyword 收敛      | `q='  abc  '`              | trim → `keyword='abc'`；空串 → `undefined`            | TD §4.2 | P1  | 🔜   | 🔜   |
| A05 | 非法值不下传      | `district='xx'`            | schema 拒绝；service/SQL 永不收到脏 district          | TD §4.2 | P1  | 🔜   | 🔜   |
| A06 | 下游只见域模型    | 任一请求                   | service 入参是 `SearchQuery`，**非** query string/DTO | TD §4.2 | P0  | 🔜   | 🔜   |

> 见 §12-⑥。

---

## 8. R · 出站 ACL（响应防腐层 + 契约稳定，约束 B）— 默认类型 `unit`

> TD §4.4 / §11。目标：前端契约不含任何 DB 列名/评分内部字段；改 DB 列只动 `row-mapper`。**当前映射散在 `search.ts`，无独立 `row-mapper.ts`、无契约快照。**

| ID  | 场景               | 输入                       | 预期（可断言）                                                       | 依据    | 优  | 行为 | 契约 |
| --- | ------------------ | -------------------------- | -------------------------------------------------------------------- | ------- | --- | ---- | ---- |
| R01 | 行映射吸收 null 分 | `profit_score=null`        | `ScoreView{value:null,band:'insufficient',estimated:false}`          | TD §4.4 | P1  | 🟡   | 🔜   |
| R02 | 行映射吸收缺 PSF   | `psf_min=null`             | `psfRange=null`（不抛、不显 0）                                      | TD §4.4 | P1  | ✅   | 🔜   |
| R03 | tags 组装          | tenure/top_year/units/walk | `tags=['永久地契','2023 TOP','250 户','MRT 8 分钟']`，null 项过滤    | TD §4.4 | P1  | 🔜   | 🔜   |
| R04 | DTO 不泄漏内部字段 | 任一 card DTO              | **不含** `components`/`basis`/`regime`/snake_case 列名               | TD §4.1 | P0  | 🟡   | 🔜   |
| R05 | 契约快照稳定       | G1 → DTO（见 §13.1 样例）  | 序列化与 `__snapshots__/gazania-card.json` 一致；改 DB 列只动 mapper | TD §11  | P0  | 🔜   | 🔜   |
| R06 | verdict 三值枚举   | 任一 card                  | 对外 `verdict ∈ {green,amber,orange}`（非中文 label/非对象）         | TD §4.4 | P0  | 🟡   | 🔜   |

> **R03「行为 🔜」**：`CondoCard` 当前**没有 `tags` 字段**，tags 组装逻辑仅存在于 TD §4.4 的 `rowToCard` 设计稿，未实现（初稿误标 🟡，已更正）。tag 字符串以真实 seed（`永久地契`、TOP 2023、250 户、Kovan MRT 8 分钟）为准。见 §12-①。

---

## 9. B · 兜底（冷启动 / 零结果）— 默认类型 `unit`，端到端标 `[e2e]`

> SPEC §3.1 / §6.3 · TD §9。`computeFallback` 计算 `fallback ∈ {none, zero_result, cold_start}`，绝不把空列表当正常态。**已实现**：纯函数 `computeFallback`（[search.ts](../lib/condo/search.ts)）+ `countActiveProjects`（repo）；`/projects` 返回 `fallback`。契约 🟡 = 逻辑在 `lib/condo`，尚未收口到 TD 的 `SearchService` 模块。

| ID  | 场景             | 前置                          | 预期（可断言）                                                     | 依据      | 优  | 行为 | 契约 |
| --- | ---------------- | ----------------------------- | ------------------------------------------------------------------ | --------- | --- | ---- | ---- |
| B01 | 冷启动           | active 盘数 < 阈值（默认 30） | `fallback='cold_start'`；前端只露「按区浏览/留资」，**不出空列表** | SPEC §6.3 | P0  | ✅   | 🟡   |
| B02 | 零结果（有查询） | active 充足，q/区 命中 0      | `fallback='zero_result'`；前端「按区找近似？」+ 留资               | SPEC §3.1 | P0  | ✅   | 🟡   |
| B03 | 正常             | active 充足，命中 >0          | `fallback='none'`                                                  | SPEC §6.3 | P0  | ✅   | 🟡   |
| B04 | 零结果非错误     | B02 前置                      | HTTP 200 + `ok:true` + `fallback`（**非** error envelope）         | SPEC §5.4 | P0  | ✅   | 🟡   |
| B05 | 零结果埋点 [e2e] | B02                           | 前端发 `condo_search_zero_result(query)`                           | SPEC §8.2 | P1  | 🔜   | 🔜   |
| B06 | 冷启动阈值边界   | active 盘数 = 阈值            | 阈值口径明确（`<30` cold / `>=30` 正常），可复现                   | SPEC §6.3 | P1  | ✅   | 🟡   |

> B01–B06 由纯 `computeFallback`（search.test.ts）+ `/projects` route（projects-route.test.ts）覆盖；B05 埋点属前端，留 e2e。

---

## 10. K · 解耦 / 可独立化（约束 A）— 默认类型 `lint`/`unit`

> TD §2 / §7 / §11。

| ID  | 场景                        | 检查                                         | 预期（可断言）                                                | 依据    | 优  | 行为 | 契约 |
| --- | --------------------------- | -------------------------------------------- | ------------------------------------------------------------- | ------- | --- | ---- | ---- |
| K01 | 域/端口零外部依赖 [lint]    | `lib/condo-search/domain`、`ports` 的 import | 不 import Next/Supabase/`lib/project-scoring` 内部            | TD §2.2 | P1  | 🔜   | 🔜   |
| K02 | 内存 repo 可单测 service    | 注入内存版 `ProjectSearchRepository`         | `SearchService` 全部用例无需起 DB                             | TD §2.2 | P0  | 🔜   | 🔜   |
| K03 | 搜索不调计算引擎 [lint]     | 搜索后端代码                                 | 不 import/调用 `computeV2`/`lib/tax`                          | TD §7   | P1  | ✅   | ✅   |
| K04 | 适配度软提示属前端 [—]      | 后端 card                                    | 后端 **不产** `fitHint`（纯前端用 localStorage 比较）；非缺陷 | TD §7   | P2  | —    | —    |
| K05 | 搜索不 import 详情页 [lint] | 搜索代码                                     | 仅 `router.push('/condo/{slug}')`，不 import 详情组件         | TD §7   | P1  | ✅   | ✅   |

> **K04 已更正**：初稿误标 🟡。`fitHint` 由前端拿缓存的计算器结果与 `psfRange` 比较得出，后端 `CondoCard` 本就不含此字段——这是设计意图（搜索可在计算器缺席时独立运行），不是后端缺口。

---

## 11. X · 安全 / 健壮性 — 默认类型 `api`，静态标 `[lint]`

| ID   | 场景                             | 检查 / 输入             | 预期（可断言）                                                 | 依据      | 优  | 行为 | 契约 |
| ---- | -------------------------------- | ----------------------- | -------------------------------------------------------------- | --------- | --- | ---- | ---- |
| X01  | 全链路无「估值」字段/文案 [lint] | §13.2 的 grep           | 命中数为 0（PSF 仅「成交区间」）                               | SPEC §11  | P0  | ✅   | ✅   |
| X02  | anon 只读、无写 [unit]           | 搜索适配器              | 用 anon client；读路径无任何写、无 service-role                | SPEC §6.3 | P0  | ✅   | ✅   |
| X03a | repo 返回 `error` [unit]         | supabase 返回 `{error}` | ✅ repo 读函数 **throw**（repo.test.ts），不再静默 `[]`        | TD §5.4   | P0  | ✅   | ✅   |
| X03c | repo 抛异常 [api]                | listCards/repo throw    | ✅ route `try/catch` → `SEARCH_INTERNAL_ERROR`（200 envelope） | TD §5.4   | P1  | ✅   | ✅   |
| X04  | ilike 特殊字符 [unit]            | `q=%` / `q=_` / `q=\`   | ✅ `escapeLike` 转义为字面量（repo.test.ts，与 S10 同源）      | SPEC §6.3 | P1  | ✅   | 🟡   |

> X03a 在 repo 层（fake supabase builder）锁定「error 不当零结果」；X03c 在两个 route 测试锁定 try/catch → `SEARCH_INTERNAL_ERROR`。见 §12-⑤。

---

## 12. 设计 ↔ 当前实现差异（缺口清单 = 落地优先级）

> 本测试集以**设计文档**为准；下表说明 🔜/🟡/🐞 用例当前为何不过，即修复顺序。

| #   | 差异                                                                                                                     | 影响用例                | 优  | 状态 / 建议                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- | --- | ------------------------------------------------------------------------------------------------------- |
| ⑦   | 默认 profit 排序曾在 limit 之后（先 name 截断再内存重排）→ Top-N 错误                                                    | O06, O05                | P0  | ✅ **已修复**：sort-then-slice 全集扫描（`MAX_SCAN`）+ 回归测试；长期仍建议 profit 下沉 SQL             |
| ⑤   | repo `error`/`null` 静默返回 `[]`，DB 故障被当零结果                                                                     | X03, B04                | P0  | ✅ **已修复**：repo 读函数 error 时 throw（repo.test.ts）；两 route try/catch → `SEARCH_INTERNAL_ERROR` |
| ④   | 无 `fallback` 与 `activeProjectCount()`，分不清冷启动/零结果                                                             | B01–B06                 | P0  | ✅ **已修复**：`computeFallback`（纯）+ `countActiveProjects`；`/projects` 返回 `fallback`              |
| ⑥a  | 入站校验：补全 `q` 无 max → 加 zod；ilike 通配符 `%`/`_` 未转义                                                          | S07, S10, X04           | P1  | ✅ **已修复**：补全 route 加 `q` max 80；repo `escapeLike` 转义 `%`/`_`/`\`                             |
| ⑥b  | 列表 `district` 无规范化/格式校验                                                                                        | P01, P02                | P1  | ✅ **已修复**：`/projects` zod `trim+toUpperCase+^D\d{1,2}$`                                            |
| ⑥c  | 仍缺：`sort` 别名（`SORT_MAP`）、街道/邮编搜索（S11）、统一到独立 `acl/request.ts`                                       | A03, S11                | P1  | 🔜 待独立 ACL 模块（并入 ①）                                                                            |
| ①   | 无独立 `lib/condo-search/` 与两侧 ACL；`CondoCard` ≠ `ProjectCardDTO`（缺 tags/psfRange/枚举 verdict/estimated/fitHint） | L01-02,L04,R全组,S01-06 | P1  | 🔜 按 TD §2.1 建模块，DTO 收口到 `row-mapper.ts`+`response.ts`                                          |
| ③   | 无分页：仅 `limit`，缺 `page/pageSize/total`                                                                             | P03–P06                 | P1  | 🔜 按 TD §8 加 offset 分页 + `total`                                                                    |
| ②   | `/projects` 对未知 `sort` 严格 `INVALID_INPUT`，TD 要求宽松回退                                                          | O04                     | P2  | ⏳ **待决议**：建议采 TD §4.2 宽松回退 `profit`；若保严格则更新 TD                                      |

> **本轮（补缺口）落地**：P0 三项（⑦/⑤/④）+ P1 输入硬化（⑥a/⑥b）全部完成并有测试。剩余 ⑥c/①/③ 属「独立搜索上下文 + ACL 模块」重构（较大），②需产品/文档决策。

---

## 13. 黄金数据与可执行约定（确定性）

### 13.1 黄金 fixtures（取自真实 seed `scripts/condo-seed.ts`）

> 全部 `unit` 用例用这批确切值喂内存 repo；api 用例用同批 seed 入库（§14）。涨幅序列 `risingResale(startPsf, step, 8期)`，3 房 1000 sqft。

| 代号 | 盘（slug）                                     | 区  | tenure    | TOP  | 户数 | MRT 步行 | 成交 PSF（首→末）                    | 用途                                |
| ---- | ---------------------------------------------- | --- | --------- | ---- | ---- | -------- | ------------------------------------ | ----------------------------------- |
| G1   | The Gazania (`the-gazania`)                    | D19 | 永久地契  | 2023 | 250  | 8 分钟   | 1700→1980（8 期，step 40）           | S01, L02, O01, R03, R05             |
| G2   | Jadescape (`jadescape`)                        | D20 | 99 年地契 | 2022 | 1206 | 4 分钟   | 2050→2295（8 期，step 35）           | O02/O03 排序、区筛选对照            |
| G3   | Normanton Park (`normanton-park`)              | D05 | 99 年地契 | 2024 | 1862 | 12 分钟  | 1900→1954（**仅 4 期**，新盘薄历史） | 新盘/置信度（`regime`、confidence） |
| —    | **以下为测试构造盘（seed 无，需 fixture 补）** |
| G4   | `no-psf-demo`                                  | D09 | —         | —    | —    | —        | **psf_min/max = null**               | R02、缺 PSF 卡片                    |
| G5   | `stub-demo`                                    | D19 | —         | —    | —    | —        | `status='stub'`                      | S08, L06（应被过滤）                |
| G6   | `no-scores-demo`                               | D19 | 永久地契  | 2020 | 100  | —        | 有档案、**无 project_scores**        | L09, V07, V11（mean=null → orange） |
| G7   | cold-start 库                                  | —   | —         | —    | —    | —        | 整库 active < 30                     | B01, B06                            |

> **精确分数（profit/location）不在本文写死**：它们由评分引擎从上述输入确定性算出，应在测试首次运行时以 `toMatchSnapshot()` 锁定（避免本文与引擎漂移）。本文只断言**可预判的不变量**：tier 档位、null 处理、排序次序、置信度标注。

### 13.2 合规检查（X01）确切检索式

```bash
# 搜索域 + 对外 DTO 不得出现估值类字段/文案（应返回 0 命中）
grep -rniE 'valuation|估值|这套值|apprais' \
  lib/condo lib/condo-search app/api/v1/condo app/\(tools\)/condo \
  | grep -v -i 'psf\|成交\|区间'
```

### 13.3 契约快照样例（R05，目标 DTO，落地后锁定）

```jsonc
// __snapshots__/gazania-card.json — 前端唯一依赖的形状（TD §4.4）
{
  "slug": "the-gazania",
  "name": "The Gazania",
  "district": "D19",
  "verdict": "green", // 三值枚举，非中文 label/非对象
  "profitScore": 0, // 实际值首跑由 snapshot 锁定
  "scoreBand": "good",
  "estimatedFromSimilar": false,
  "psfRange": { "min": 0, "max": 0, "periodEnd": "" }, // 同上
  "tags": ["永久地契", "2023 TOP", "250 户", "MRT 8 分钟"],
  "fitHint": null,
}
```

---

## 14. api 用例的数据准备（seed 策略）

> §2/§3/§4/§5/§9/§11 的 `api` 用例需要库里有确定数据。三选一，**优先 (a)**：

- **(a) 内存 repo + 直测 route 逻辑**：把 route 的纯部分（ACL→service→DTO）抽出，注入内存 `ProjectSearchRepository`（TD §2.2）。**无需起 DB**，最快、最确定——这正是约束 A「可独立化」的红利。落地后 S/L/O/P 多数可降为 `unit`。
- **(b) Supabase 本地实例 + seed**：`supabase start` → `npx tsx scripts/condo-seed.ts`（幂等）灌入 G1–G3，另写 `condo-seed.test.ts` 补 G4–G7。集成层用，跑得慢。
- **(c) mock supabase client**：仅适合 X03（错误注入）等无需真数据的用例。

> 当前缺 (a) 所需的 service/端口分层（§12-①），所以多数 api 用例暂只能走 (b)/(c)。补齐分层后应迁到 (a)。

---

## 15. 落地建议（测试文件归位）

| 测试组 / 用例           | 建议文件                                                              | 类型 | 备注                       |
| ----------------------- | --------------------------------------------------------------------- | ---- | -------------------------- |
| V（裁决，上游契约）     | `tests/unit/lib/project-scoring/verdict.test.ts`                      | unit | **属评分引擎**，搜索仅引用 |
| O01/O05/L02/L08/L09     | `tests/unit/lib/condo/search.test.ts`（现实现）                       | unit | 对照 `lib/condo/search.ts` |
| O06 / X03 / 排序 Top-N  | `tests/unit/lib/condo/repo.test.ts`                                   | unit | 抓 §12-⑦/⑤ 的 bug          |
| A（入站 ACL）           | `tests/unit/lib/condo-search/acl-request.test.ts`                     | unit | 随模块新建                 |
| R（出站 ACL + 快照）    | `tests/unit/lib/condo-search/acl-response.test.ts` + `__snapshots__/` | unit | 含 R05 契约快照            |
| B（兜底）/ K02          | `tests/unit/lib/condo-search/service.test.ts`（内存 repo）            | unit | 随模块新建                 |
| S/L/O/P/X（端到端 API） | `tests/unit/app/condo/search-routes.test.ts`                          | api  | 优先迁向内存 repo（§14a）  |
| K01/K03/K05/X01         | `tests/unit/lib/condo-search/boundaries.test.ts`                      | lint | import 边界 + grep         |
| B05 埋点 / 真·端到端    | `tests/e2e/condo-search.spec.ts`                                      | e2e  |                            |

> 顺序对齐 TD §11 MVP：先 §7 域+端口（内存 repo 单测先行）→ §8 ACL 两侧（含契约快照）→ §9 适配器 → §10 API → §11 页面/埋点。**但 P0 的 O06/X03/④ 兜底是现网正确性问题，应先于架构重构修掉。**
