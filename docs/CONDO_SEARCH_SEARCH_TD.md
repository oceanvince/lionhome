# Condo Search — 搜索部分后端技术设计（TD）

> 配套：[CONDO_SEARCH_SPEC.md](./CONDO_SEARCH_SPEC.md)（产品）· [CONDO_SEARCH_TD.md](./CONDO_SEARCH_TD.md)（**详情页/报告页**读路径 + 评分引擎 + 离线采集管线）· [BACKEND_TD.md](./BACKEND_TD.md)（系统分层/错误 Envelope 规范）· [CALCULATOR_V2_TD.md](./CALCULATOR_V2_TD.md)（购买力引擎）
>
> 本文只聚焦 **SPEC §3「搜索入口与结果」**：搜索框、自动补全、结果列表（卡片预览）、零结果/冷启动兜底。**不重复** CONDO_SEARCH_TD 已覆盖的详情页、评分引擎、采集管线——本文把它们当作**上游已存在的数据底座**来消费。

| 字段       | 值                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 范围       | 搜索框 + 自动补全 + 结果列表（读路径）+ 防腐层 + 可独立化边界                                                    |
| 栈         | Next.js 15 App Router · Supabase(Postgres) · Zod · TS（沿用现有约定）                                            |
| 状态       | Draft for grooming                                                                                               |
| 两条硬约束 | ① 搜索部分须可被剥离成**独立功能**（与计算器平行的页面）；② 数据库交互的 API **请求与响应都必须有防腐层（ACL）** |

---

## 0. 一句话架构

> 搜索部分是一个**自包含的读模型消费者**：它通过一组**端口（Port）**读取由采集/评分管线产出的缓存表，**请求侧**用入站防腐层把前端宽松入参收敛成稳定的搜索域模型，**响应侧**用出站防腐层把 DB 行/评分引擎内部结构翻译成稳定的对外契约。搜索域**不直接 import 任何 DB 行类型、不直接 import 评分引擎内部类型、不依赖详情页/计算器的内部实现**——这正是它日后能被整体搬走、成为独立页面的前提。

```
┌─ 前端（搜索页，可独立部署）──────┐
│ 搜索框 / 自动补全 / 结果卡片列表  │
└───────────────┬──────────────────┘
                │ wire DTO（稳定契约，camelCase）
                ▼
┌─ API 层 route handler ───────────────────────────────────────┐
│ 入站 ACL : RequestDTO(zod)  ──►  SearchQuery（搜索域模型）     │
│ SearchService（排序/筛选/分页/兜底语义，纯逻辑）              │
│ 出站 ACL : ProjectCard（域）  ──►  ResponseDTO（稳定契约）     │
└───────────────┬──────────────────────────────────────────────┘
                │ 端口接口（ProjectSearchRepository）
                ▼
┌─ 适配器（唯一知道 Supabase/表结构的地方）────────────────────┐
│ 行映射 ACL : DbRow(snake_case)  ──►  ProjectCard（搜索域模型） │
│ 只读 projects(active) + 最新 project_scores(profit)           │
└──────────────────────────────────────────────────────────────┘
                ▲ 上游（本文不展开，见 CONDO_SEARCH_TD）
        采集管线 / 评分引擎 夜间写入这些缓存表
```

**读写分离**：搜索部分**全程只读**（RLS anon 可读 `status='active'`）；写入只发生在离线管线（service-role），不属于本文范围。

---

## 1. 设计目标与边界

### 1.1 范围内

- 搜索框单输入框 + 自动补全（楼盘名为主，区/街道/邮编模糊）— SPEC §3.1
- 搜索结果列表卡片预览（盈利分 + 结论徽章 + PSF 区间 + 关键标签 + 适配度提示）— SPEC §3.2
- 排序（默认盈利分降序 / PSF 低→高 / TOP 新→旧）、按区筛选、分页
- 零结果兜底 + 冷启动「按区浏览/留资」— SPEC §3.1 / §6.3
- 搜索相关埋点 — SPEC §8

### 1.2 范围外（明确委托给其他文档/模块）

| 不做                                                | 归属                                                                 |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| 详情页 `/condo/{slug}` 渲染、四维评分明细、伴随地图 | CONDO_SEARCH_TD §4                                                   |
| 评分算法本身（profit/location/…）                   | `lib/project-scoring/`（CONDO_SEARCH_TD §5）                         |
| URA/OneMap 采集、`project_scores` 的**写入**        | 离线管线（CONDO_SEARCH_TD §6）                                       |
| 适配度的**实际计算**                                | `computeV2`/`lib/tax`（搜索卡只读其结果做「在预算内」轻提示，见 §7） |
| 跨盘「A 比 B 好」结论                               | Module 5 对比器                                                      |

### 1.3 两条硬约束（贯穿全文）

> 这两条不是「附加要求」，而是本设计的**结构主线**。

- **约束 A · 可独立化**：搜索部分将来可能成为与计算器平行的独立页面/独立功能。→ 见 §2，要求搜索是一个**有清晰边界的限界上下文**，对外只暴露端口与契约，对内不泄漏任何邻接模块的内部类型。
- **约束 B · 防腐层**：数据库交互的 API 请求与响应**都**必须有防腐层。→ 见 §4，入站把前端 DTO 翻译成域模型，出站把 DB 行/评分内部结构翻译成对外契约，两侧各有一道翻译层。

---

## 2. 模块化与可独立化设计（约束 A）

### 2.1 限界上下文与目录

搜索是一个**自包含上下文**，所有代码收敛到一个可整体移动的命名空间 `lib/condo-search/`，与现有 `lib/calculator/` 平级——这正是「与计算器平行」在代码层的对应。

```
lib/condo-search/
  domain/
    models.ts          // 搜索域模型：SearchQuery / ProjectCard / Suggestion / ScoreView（对外稳定，不引用 DB/评分内部类型）
    sort.ts            // SortSpec 枚举 + 排序语义（纯）
    service.ts         // SearchService：编排筛选/排序/分页/兜底（纯逻辑，依赖端口接口而非实现）
  ports/
    repository.ts      // ProjectSearchRepository 接口（端口）—— 搜索域对「数据来源」的唯一抽象
  acl/
    request.ts         // 入站 ACL：RequestDTO(zod) → SearchQuery
    response.ts        // 出站 ACL：ProjectCard → ResponseDTO
  adapters/
    supabase-repository.ts  // 端口实现（唯一 import Supabase / database.types 的文件）
    row-mapper.ts           // 行映射 ACL：DbRow → ProjectCard

app/api/v1/condo/search/route.ts      // 自动补全
app/api/v1/condo/projects/route.ts    // 结果列表
app/(tools)/condo/search/page.tsx     // 搜索页（与 (tools)/calculator 平级）
```

### 2.2 依赖方向（单向，向内收敛）

```
route handler ─► acl ─► service ─► ports(interface) ◄─ adapters(impl) ─► Supabase
```

- `domain/` 与 `ports/` **零外部依赖**（不 import Next、Supabase、`lib/project-scoring`、`lib/calculator`）。
- 只有 `adapters/` 知道 Supabase 与表结构；只有 `route.ts` 知道 HTTP。
- **可测性**：`SearchService` 注入一个内存版 `ProjectSearchRepository` 即可单测，无需起 DB。

### 2.3 「日后独立」的具体兑现

| 独立化诉求                                              | 本设计如何兑现                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 搜索页能单独路由/单独部署                               | 页面在 `app/(tools)/condo/search/`，逻辑全在 `lib/condo-search/`，无反向依赖详情页/计算器 |
| 数据源将来可换（如换 Typesense / 独立搜索库 / 独立 DB） | 只换 `adapters/`，`service`/`acl`/契约不动（端口隔离）                                    |
| 对外契约稳定，前端不随后端改                            | 出站 ACL 固化 wire DTO（§4.4），DB/评分内部变更被挡在 ACL 内                              |
| 与计算器解耦                                            | 搜索卡的「适配度提示」只**读**计算器结果做软提示，不调用计算引擎（§7）                    |

> 红线：搜索域代码**禁止** `import` `@/lib/supabase/database.types`、`@/lib/project-scoring/*` 的内部类型、或详情页组件。需要这些数据时，一律经端口 + ACL 翻译进来。CI 可加 import 边界 lint（如 `eslint-plugin-boundaries` 或简单 grep）守护。

---

## 3. 搜索域模型（对外稳定契约的源头）

> 这是搜索上下文「自己的语言」。它**不是** DB 行，也**不是**评分引擎的 `ProjectScore`，而是「结果卡片要展示什么」反推出来的最小模型。DB 与评分引擎的形状变化，都要在 ACL 里被翻译成这套模型，绝不直接外泄。

```ts
// lib/condo-search/domain/models.ts

export type VerdictBand = "green" | "amber" | "orange"; // 值得入候选 / 值得比较 / 谨慎比较
export type District = `D${number}`; // "D19"

/** 评分在卡片上的「视图」——只保留卡片需要的，丢弃评分引擎内部的 components/basis 等 */
export interface ScoreView {
  value: number | null; // 0-10，null = 数据不足
  band: "excellent" | "good" | "fair" | "poor" | "insufficient";
  estimated: boolean; // 是否「相似盘估算」→ 卡片角标（SPEC §4.3）
}

export interface ProjectCard {
  slug: string;
  name: string;
  district: District;
  verdict: VerdictBand;
  profit: ScoreView; // 卡片主显分（SPEC §3.2）
  psf: { min: number; max: number; periodEnd: string } | null; // 近 12 月成交 PSF 区间，非估价
  tags: string[]; // 产权 / TOP 年份 / 总户数 / 最近 MRT 步行
  fitHint?: "in_budget" | "slightly_over" | null; // 适配度软提示（§7）
}

export interface Suggestion {
  slug: string;
  name: string;
  district: District;
  kind: "project" | "district" | "street"; // 补全条目类型
}

export type SortSpec = "profit_desc" | "psf_asc" | "top_desc";

export interface SearchQuery {
  keyword?: string; // 已 trim/收敛
  district?: District;
  sort: SortSpec;
  page: number; // 1-based
  pageSize: number;
}

export interface SearchResult {
  items: ProjectCard[];
  total: number;
  page: number;
  pageSize: number;
  /** 兜底语义：空结果时驱动「按区浏览 / 留资」UI（SPEC §3.1/§6.3） */
  fallback: "none" | "zero_result" | "cold_start";
}
```

---

## 4. 防腐层（ACL）设计（约束 B）

### 4.1 为什么搜索必须有两侧 ACL

搜索域被三个「外部模型」包围，任何一个直接穿透都会腐蚀搜索的稳定性：

| 外部模型                                                                                | 风险（若不隔离）                        | 由哪道 ACL 挡                      |
| --------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------- |
| **DB 行**（`projects`/`project_scores`，snake_case、可空、表耦合，归采集/评分管线所有） | 上游加列/改列/改可空性 → 直接打穿到前端 | 出站行映射 ACL（§4.4）             |
| **评分引擎内部类型**（`ProjectScore` 的 `components/basis/regime…`）                    | 评分算法迭代 bump 结构 → 搜索卡跟着改   | 出站行映射 ACL（只取 `ScoreView`） |
| **前端宽松入参**（query string，可能脏/缺/超界/恶意）                                   | 脏参数渗进查询逻辑或 SQL                | 入站请求 ACL（§4.3）               |

> 「请求与响应都要有防腐层」在工程上就是：**入站一道**（DTO→域），**出站两段**（DB 行→域，在适配器内；域→wire DTO，在 route 内）。

### 4.2 入站 ACL：RequestDTO → SearchQuery

前端入参**宽松**（大小写不定、可空、字符串数字混用），ACL 负责**校验 + 规范化 + 收敛**成干净的域模型，并保证非法输入永不进入下游。

```ts
// lib/condo-search/acl/request.ts
import { z } from "zod";
import type { SearchQuery, SortSpec } from "../domain/models";

const SORT_MAP: Record<string, SortSpec> = {
  profit: "profit_desc",
  psf: "psf_asc",
  top: "top_desc",
  profit_desc: "profit_desc",
  psf_asc: "psf_asc",
  top_desc: "top_desc",
};

export const SearchRequestSchema = z.object({
  q: z.string().trim().min(1).max(80).optional(),
  district: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^D\d{1,2}$/)
    .optional(), // 收敛成 "D19"
  sort: z.string().optional(),
  page: z.coerce.number().int().min(1).max(200).default(1),
  pageSize: z.coerce.number().int().min(1).max(24).default(12),
});

export type SearchRequestDTO = z.infer<typeof SearchRequestSchema>;

/** ACL：把校验后的 wire DTO 翻译成搜索域模型。下游只见 SearchQuery，不见 query string。 */
export function toSearchQuery(dto: SearchRequestDTO): SearchQuery {
  return {
    keyword: dto.q,
    district: dto.district as SearchQuery["district"],
    sort: (dto.sort && SORT_MAP[dto.sort]) ?? "profit_desc", // 未知排序回退默认，不报错
    page: dto.page,
    pageSize: dto.pageSize,
  };
}
```

自动补全入参同理（`AutocompleteRequestSchema`：`q` 必填 1–80 字符、`limit` 默认 8 上限 20）。

### 4.3 端口：搜索域对「数据来源」的唯一抽象

搜索域**只认这个接口**，不认 Supabase。换数据源 = 换实现，契约不变（兑现 §2.3）。

```ts
// lib/condo-search/ports/repository.ts
import type { SearchQuery, ProjectCard, Suggestion } from "../domain/models";

export interface ProjectSearchRepository {
  search(q: SearchQuery): Promise<{ items: ProjectCard[]; total: number }>;
  suggest(prefix: string, limit: number): Promise<Suggestion[]>;
  /** 冷启动判断：active 项目数（用于 fallback 语义，SPEC §6.3） */
  activeProjectCount(): Promise<number>;
}
```

### 4.4 出站 ACL：DB 行 → ProjectCard → ResponseDTO

**第一段（行映射，在适配器内）**：唯一接触表结构的地方。把 join 出来的原始行翻译成域模型，并在此**吸收所有 DB 的脏与空**（null 分数 → `insufficient`、缺 PSF → `null`、组装 tags）。

```ts
// lib/condo-search/adapters/row-mapper.ts
import type { ProjectCard, ScoreView } from "../domain/models";

// 适配器私有：join projects + 最新 profit 评分后的原始行形状（snake_case）
interface DbProjectSearchRow {
  slug: string;
  name: string;
  district: string;
  tenure: string | null;
  top_year: number | null;
  total_units: number | null;
  psf_min: number | null;
  psf_max: number | null;
  psf_period_end: string | null;
  nearest_mrt_walk_min: number | null;
  profit_score: number | null;
  profit_band: string | null;
  profit_confidence: string | null;
  verdict_band: string | null;
}

function toScoreView(
  score: number | null,
  band: string | null,
  confidence: string | null
): ScoreView {
  if (score === null) return { value: null, band: "insufficient", estimated: false };
  return {
    value: score,
    band: (band as ScoreView["band"]) ?? "fair",
    estimated: confidence === "estimated_similar", // 评分引擎枚举 → 卡片角标布尔
  };
}

export function rowToCard(row: DbProjectSearchRow): ProjectCard {
  const tags = [
    row.tenure,
    row.top_year ? `${row.top_year} TOP` : null,
    row.total_units ? `${row.total_units} 户` : null,
    row.nearest_mrt_walk_min ? `MRT ${row.nearest_mrt_walk_min} 分钟` : null,
  ].filter(Boolean) as string[];

  return {
    slug: row.slug,
    name: row.name,
    district: row.district as ProjectCard["district"],
    verdict: (row.verdict_band as ProjectCard["verdict"]) ?? "amber",
    profit: toScoreView(row.profit_score, row.profit_band, row.profit_confidence),
    psf:
      row.psf_min != null && row.psf_max != null
        ? { min: row.psf_min, max: row.psf_max, periodEnd: row.psf_period_end ?? "" }
        : null,
    tags,
  };
}
```

**第二段（响应序列化，在 route 内）**：把域模型固化成对外 wire DTO。这是前端**唯一**依赖的形状——DB/评分怎么变都不波及它。

```ts
// lib/condo-search/acl/response.ts
import type { ProjectCard, SearchResult } from "../domain/models";

export interface ProjectCardDTO {
  slug: string;
  name: string;
  district: string;
  verdict: "green" | "amber" | "orange";
  profitScore: number | null; // 注意：对外是 number|null，不暴露 ScoreView 全貌
  scoreBand: string;
  estimatedFromSimilar: boolean; // 角标
  psfRange: { min: number; max: number; periodEnd: string } | null;
  tags: string[];
  fitHint: "in_budget" | "slightly_over" | null;
}

export function toCardDTO(card: ProjectCard): ProjectCardDTO {
  return {
    slug: card.slug,
    name: card.name,
    district: card.district,
    verdict: card.verdict,
    profitScore: card.profit.value,
    scoreBand: card.profit.band,
    estimatedFromSimilar: card.profit.estimated,
    psfRange: card.psf,
    tags: card.tags,
    fitHint: card.fitHint ?? null,
  };
}

export function toSearchResultDTO(r: SearchResult) {
  return {
    items: r.items.map(toCardDTO),
    page: r.page,
    pageSize: r.pageSize,
    total: r.total,
    fallback: r.fallback,
  };
}
```

### 4.5 ACL 的好处（一句话）

- DB 加列/改列 → 只动 `row-mapper.ts`；评分换算法 → 只动 `toScoreView`；前端契约纹丝不动。
- 脏/恶意入参在 `request.ts` 一道拦死，service 与 SQL 永远收到干净域对象。
- 搜索整体搬走时，带走 `lib/condo-search/` 即可；换数据源只换 `adapters/`。

---

## 5. API 接口契约

> 沿用 BACKEND_TD 的统一 Envelope：业务失败也走 **HTTP 200** + `{ ok:false, error }`。

### 5.1 端点

| Method | Path                                                        | Auth | 用途                  |
| ------ | ----------------------------------------------------------- | ---- | --------------------- |
| GET    | `/api/v1/condo/search?q=&limit=`                            | anon | 自动补全（SPEC §3.1） |
| GET    | `/api/v1/condo/projects?q=&district=&sort=&page=&pageSize=` | anon | 结果列表（SPEC §3.2） |

> 与 CONDO_SEARCH_TD §4.3 的接口边界一致；本文给出**完整请求/响应契约 + ACL 落点**。`/condo/fit`（适配度）、`/condo/feedback` 不属搜索部分，见对方文档。

### 5.2 结果列表（`GET /api/v1/condo/projects`）

route handler 把三道关串起来——**入站 ACL → service（经端口）→ 出站 ACL**：

```ts
// app/api/v1/condo/projects/route.ts
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = SearchRequestSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "参数校验失败",
        fields: parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })),
      },
    });
  }
  const query = toSearchQuery(parsed.data); // 入站 ACL
  const repo = createSupabaseSearchRepository(); // 端口实现（适配器）
  const service = new SearchService(repo);
  try {
    const result = await service.run(query); // 域逻辑（排序/分页/兜底）
    return NextResponse.json({ ok: true, data: toSearchResultDTO(result) }); // 出站 ACL
  } catch (err) {
    console.error("[/api/v1/condo/projects]", err);
    return NextResponse.json({
      ok: false,
      error: { code: "SEARCH_INTERNAL_ERROR", message: "搜索暂不可用，请重试" },
    });
  }
}
```

**成功响应**：

```jsonc
{
  "ok": true,
  "data": {
    "items": [
      {
        "slug": "the-gazania-d19",
        "name": "The Gazania",
        "district": "D19",
        "verdict": "green",
        "profitScore": 6.8,
        "scoreBand": "good",
        "estimatedFromSimilar": false,
        "psfRange": { "min": 1850, "max": 2100, "periodEnd": "2026-05-31" },
        "tags": ["永久地契", "2023 TOP", "250 户", "MRT 6 分钟"],
        "fitHint": "in_budget",
      },
    ],
    "page": 1,
    "pageSize": 12,
    "total": 37,
    "fallback": "none",
  },
}
```

### 5.3 自动补全（`GET /api/v1/condo/search`）

```jsonc
{
  "ok": true,
  "data": {
    "suggestions": [
      { "slug": "the-gazania-d19", "name": "The Gazania", "district": "D19", "kind": "project" },
    ],
  },
}
```

零结果（SPEC §3.1）：`suggestions: []` + 前端展示「按区找近似 / 留资」，并埋 `condo_search_zero_result`。

### 5.4 错误码

| 错误码                  | 触发           | 备注                               |
| ----------------------- | -------------- | ---------------------------------- |
| `INVALID_INPUT`         | zod 校验失败   | 附 `fields[]`                      |
| `SEARCH_INTERNAL_ERROR` | 适配器/DB 异常 | 写后端日志；前端给「搜索暂不可用」 |

> 「查无结果」**不是错误**：返回 `ok:true` + 空 `items` + `fallback` 字段，由前端渲染兜底（与 calculator「infeasible 走 ok:true」口径一致）。

---

## 6. 数据读取（DB interaction）

> 搜索**全程只读**采集/评分管线产出的缓存表（表的 DDL/RLS 归 CONDO_SEARCH_TD §2，本文不重复定义，只声明读取契约与索引诉求）。

### 6.1 读取形状

适配器一次 join 取齐卡片所需，避免 N+1：

- `projects`（`status='active'`）：slug/name/district/tenure/top_year/total_units/psf_min/psf_max/psf_period_end
- `project_scores`：仅取每 project 的 **profit 维度最新 `score_version`** 行（score/band/confidence）—— 卡片只显主分
- 最近 MRT 步行：可从 `project_amenities`（kind=mrt 最小 walk_minutes）派生，或在采集期预冷到 `projects` 冗余列（推荐后者，搜索读路径零 join 配套表）

> 建议在 CONDO_SEARCH_TD 的采集管线里**预冷 `projects.nearest_mrt_walk_min` 冗余列 + `projects.verdict_band` 冗余列**，让搜索列表退化为「单表扫描 + 一次 scores join」，吃满索引、利于列表 LCP。这是搜索读路径对上游的**唯一新增诉求**（其余复用现有表）。

### 6.2 索引诉求（供上游 migration 落地）

```sql
-- 按区 + 默认按盈利分降序（最高频列表查询）
create index if not exists projects_search_district_idx
  on projects (status, district);

-- 自动补全：名称前缀/模糊（pg_trgm）
create extension if not exists pg_trgm;
create index if not exists projects_name_trgm_idx
  on projects using gin (name gin_trgm_ops) where status = 'active';

-- 取每盘最新 profit 评分（join 命中）
create index if not exists project_scores_profit_latest_idx
  on project_scores (project_id, dimension, score_version desc);
```

### 6.3 RLS 与安全

- anon 只能 SELECT `projects.status='active'` 及其关联评分（沿用 CONDO_SEARCH_TD §2.3）；`stub/hidden` 不进搜索结果。
- 适配器用 `getSupabaseServerClient()`（anon），**不**用 service-role——搜索无任何写操作。
- 自动补全做轻量节流/长度下限（`q` ≥ 1 且 ≤ 80），`pageSize ≤ 24`、`page ≤ 200`，防扫库。

---

## 7. 与计算器 / 详情页的解耦关系

> 兑现约束 A：搜索**用**它们的产物，但**不依赖**它们的内部实现。

| 关系                                | 解耦方式                                                                                                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 卡片「适配度提示」（在预算内/略超） | 前端把已缓存的计算器结果（localStorage `V2ComputeResult`）与卡片 `psfRange` 做**轻量比较**得出 `fitHint`，或经独立的 `/condo/fit` 接口；搜索后端**不调用** `computeV2`/`lib/tax` |
| 点击卡片 → 详情页                   | 仅 `router.push('/condo/{slug}')`，搜索不 import 任何详情页组件/类型                                                                                                             |
| 「加入对比」                        | 仅收集 slug 跳转对比器（Module 5），不在搜索内产出对比结论                                                                                                                       |

这样搜索页可独立存在：即使详情页/计算器尚未上线或被替换，搜索仍能跑（fitHint 退化为 `null`，卡片照常渲染）。

---

## 8. 排序 / 筛选 / 分页语义（SearchService，纯逻辑）

- **排序**：`profit_desc`（默认，null 分数排末尾）/ `psf_asc`（缺 PSF 排末尾）/ `top_desc`。下沉到 SQL `ORDER BY ... NULLS LAST`，service 只声明 `SortSpec`，由适配器翻译成 SQL（保持域不含 SQL）。
- **筛选**：MVP 仅 `district`；价位/产权筛选为 V2（加枚举即可，ACL 与契约向后兼容）。
- **分页**：offset 分页（MVP 数据量 < 3000 盘，offset 足够）；`total` 用 `count` 一并返回，前端显示页码。

---

## 9. 冷启动 / 零结果兜底（SPEC §3.1 / §6.3）

`SearchService.run()` 计算 `fallback` 字段，**绝不返回半截/空白列表当正常态**：

```
activeCount = repo.activeProjectCount()
if activeCount 很少（< 阈值，如 30）        → fallback = "cold_start"  → 前端只露「按区浏览 / 留资」
else if items 为空 且 有 keyword/district  → fallback = "zero_result" → 「这个盘还没收录，按区找近似？」+ 留资
else                                       → fallback = "none"
```

`zero_result` 由前端埋 `condo_search_zero_result(query)`，驱动收录优先级（SPEC §8.2）。

---

## 10. 埋点（SPEC §8.1，搜索相关子集）

| 事件                       | 关键属性           | 触发点                   |
| -------------------------- | ------------------ | ------------------------ |
| `condo_search_started`     | query、entry_point | 搜索框提交/补全选择      |
| `condo_search_zero_result` | query              | `fallback="zero_result"` |
| `compare_added`            | project_slug       | 卡片「加入对比」         |

> 埋点在前端发起，后端不阻塞；命名遵循主 PRD §20 taxonomy。

---

## 11. 验收 / MVP 实施顺序

### 验收（对齐 SPEC §13 搜索相关项）

- [ ] 搜索 API 全程**只读**，请求时零外部调用（数据来自缓存表）。
- [ ] 入站 ACL：脏/缺/超界入参被 `INVALID_INPUT` 或默认值收敛，下游只见干净 `SearchQuery`。
- [ ] 出站 ACL：前端契约（`ProjectCardDTO`）不含任何 DB 列名/评分引擎内部字段；改 DB 列只动 `row-mapper`，CI 验证契约快照不变。
- [ ] `lib/condo-search/domain` 与 `ports` 零外部 import（lint 守护边界）；`SearchService` 用内存 repo 可单测。
- [ ] 查无结果返回 `ok:true` + `fallback`，冷启动不出空列表，零结果有留资入口。
- [ ] 全链路无 `valuation/估值` 字段（PSF 仅「成交区间」，SPEC §11）。

### MVP 顺序

1. **域 + 端口**：`domain/models.ts`、`ports/repository.ts`、`domain/service.ts`（内存 repo 单测先行）。
2. **ACL 两侧**：`acl/request.ts`、`acl/response.ts`（含契约快照测试）。
3. **适配器**：`adapters/row-mapper.ts` + `supabase-repository.ts`；协调上游补 `projects` 冗余列与索引（§6.1/§6.2）。
4. **API**：`/api/v1/condo/projects` + `/api/v1/condo/search`。
5. **页面**：`app/(tools)/condo/search/page.tsx`（结果列表 + 自动补全 + 兜底）。
6. **埋点**接入（§10）。

> V2：价位/产权筛选、按区浏览页、补全权重调优、（如规模增长）切独立搜索引擎——均只需扩 `adapters/` 或加枚举，契约向后兼容。
