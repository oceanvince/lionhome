# Condo Search 后端技术设计（TD）— 详情页优先

> 配套：[CONDO_SEARCH_SPEC.md](./CONDO_SEARCH_SPEC.md)（产品）· [BACKEND_TD.md](./BACKEND_TD.md)（系统分层/响应规范）· [CALCULATOR_V2_TD.md](./CALCULATOR_V2_TD.md)（购买力引擎）
>
> 本文聚焦**决策报告页 `/condo/{slug}`** 的后端实现与**数据源策略**。搜索/对比/Lead 接入只给接口边界，不展开。

| 字段 | 值 |
| ---- | -- |
| 范围 | 详情页读路径 + 数据底座 + 评分引擎 + 数据采集管线（MVP） |
| 栈 | Next.js 15 App Router · Supabase(Postgres) · Zod · TS（沿用现有约定） |
| 状态 | Draft for grooming |

---

## 0. 一句话架构

> **请求时不碰任何外部 API**。URA / OneMap / MOE 的数据全部在**夜间离线管线**里抓取、清洗、算分，落进我们自己的 Postgres 缓存表；详情页（SSR）只读缓存表，保证 PRD §13 的「4G LCP < 2s」与不受第三方限流/抖动影响。

```
┌─ 离线（夜间 cron / 手动 seed）──────────────┐      ┌─ 在线（请求时）──────────────┐
│ URA API ─┐                                  │      │  GET /condo/{slug} (SSR)     │
│ OneMap ──┼─► ingestion workers ─► 缓存表 ───┼─读──►│   └─ 只读缓存表，零外部调用    │
│ MOE/gov ─┘        │                          │      │  适配度 = 复用 calculator/tax │
│ 人工编辑 ─────────┘ ─► project_scores(算分) │      └──────────────────────────────┘
└─────────────────────────────────────────────┘
```

读写分离：**写只发生在离线管线**（service-role），**在线只读**（RLS anon 可读 active 项目）。

---

## 1. 数据源总表（详情页每个字段从哪来）

> 这是本文核心。详情页每一块内容都必须能回答「这数据哪来的、多久刷一次、缺了怎么办」。

| 详情页区块（SPEC §4） | 字段 | 来源 | 具体 API / 数据集 | 落库表 | 刷新 |
| --- | --- | --- | --- | --- | --- |
| 楼盘档案 | 名称/区/产权/TOP/户数/开发商 | **URA** + 人工 | URA *Developer Sales* / 项目档案；冷启动人工补 | `projects` | 周级 |
| 决策快照·关键指标 | 地址、经纬度 | **OneMap** | OneMap `/api/common/elastic/search`（地址→坐标） | `projects.lat/lng` | 入库一次 |
| PSF 区间 / 成交 Tab | 成交价、面积、PSF、户型、成交日 | **URA** | URA *Private Residential Property Transactions*（API v1，按 batch 1–4 / period 拉） | `project_transactions` | **夜间增量** |
| 盈利分 Profit | 同户型转售 CAGR、同区基准 | **URA** + `lib/finance` | 同上成交数据；基准回退用 `regionalAppreciationLookup` | `project_scores` | 夜间随成交重算 |
| 地段分 Location | 最近 MRT 步行、1km 小学、配套密度 | **OneMap** | OneMap *Themes*（mrt_station / busstop / 等）+ Routing API（walk 时间） | `project_amenities` | 月级（地理稳定） |
| 学校 Tab | 小学清单、距离 | **OneMap + MOE** | OneMap 学校 theme + data.gov.sg *School Directory* | `project_amenities`(kind=school) | 学期级 |
| 学校 Tab | P1 报名热度/历史 | **MOE / data.gov.sg** | P1 报名/排位数据集（半公开，部分需人工年更） | `project_amenities.metadata` | 年级（手动） |
| 价格 Tab | 首付/月供 | **本地计算** | `computeV2` + `lib/tax`（不依赖外部） | 不落库（即时算） | — |
| 适配度（与四维同级） | 购买力区间、ABSD 负担 | **本地计算** | `computeV2` / `calculateAbsd` / `solveMaxPurchasePrice` | 取用户最近一次 `calculator_runs` | 即时 |
| 退出分 Exit（V2.1） | 供应宽松度、HDB 升级需求 | **data.gov.sg / URA** | HDB Resale Flat Prices + URA 未来供应（GLS/Pipeline） | `project_scores` | 夜间 |
| 租赁分 Rental（V2.1） | 毛回报率、出租率 | **URA + `lib/finance`** | URA *Rental Contracts* + `estimateMedianRent` | `project_scores` | 夜间 |
| 替代 Tab | 同区近似盘 | **本地派生** | 我方 `projects`/`project_scores` 聚类查询 | 查询时算 | — |
| 户型/相册/site plan | 图片、平面 | **人工编辑** | 运营上传（判断/版权类） | `projects.metadata` | 人工 |
| 伴随地图 | MRT/巴士/学校/配套图层 | **OneMap** | 同 `project_amenities`（带坐标） | `project_amenities` | 月级 |

### 1.1 各数据源接入要点

- **URA Property Information Service（核心）**
  - 必须先注册拿 **AccessKey**，每天用 AccessKey 换一个 **Token**（24h 有效），后续请求带 `AccessKey + Token`。→ 离线 worker 里先取 token 再批量拉。
  - 成交接口按 **batch（1–4，覆盖全岛）** 或按 **period（季度）** 分页；字段含 `project`、`street`、`marketSegment`、`x/y(SVY21 坐标)`、`transaction[]{ price, area, contractDate, propertyType, typeOfSale(1新销/2转售/3再售), tenure, floorRange, noOfUnits, district }`。
  - **坐标是 SVY21**（非 WGS84），需转换或用 OneMap 反查 → 统一存 WGS84 lat/lng。
  - 限流 + 偶发抖动 → 离线重试 + 幂等 upsert（按 `project + contractDate + area + price` 去重）。
- **OneMap（政府免费）**
  - Search：地址/邮编/楼盘名 → 坐标（geocode），用于 `projects.lat/lng` 与搜索补全。
  - Themes：拉 mrt 出口、bus stop、school、mall 等 POI 图层。
  - Routing（walking）：本盘坐标 → 最近 MRT 的**步行时间/距离**（地段分关键子因子）。某些接口需注册取 token。
  - 地理数据稳定 → 入库一次/月级刷新即可，不进夜间高频任务。
- **MOE / data.gov.sg**
  - School Directory（data.gov.sg 数据集）做学校基础档案；OneMap school theme 提供坐标。
  - P1 报名历史**半公开**，覆盖不全 → 标 `confidence`，缺失时 UI 走 SPEC §4.3「仅供方向参考」。
- **data.gov.sg（HDB / 未来供应）**：退出维度（V2.1）才接，MVP 不阻塞。
- **人工编辑**：Master Plan、en-bloc、未来供应、图片、site plan —— 判断/版权类，走运营后台写 `metadata`，不进自动管线。

> **法律红线（SPEC §11）落到工程**：`project_transactions` 只存「成交事实」，对外一律表述为「近 12 月成交 PSF 区间的算术换算」；**禁止**生成/存储任何 `valuation`/`估值` 字段。价格换算在读层即时算，不落「估价」列。

---

## 2. 数据底座（DDL）

新建 migration `..._condo_search.sql`，与现有命名/触发器/RLS 风格一致。

### 2.1 `projects` 扩展列（SPEC §6.1）

```sql
alter table projects
  add column slug            varchar(160) unique,                  -- URL，见 §3 slug 规则
  add column lat             numeric(9,6),
  add column lng             numeric(9,6),
  add column psf_min         numeric(10,2),                        -- 近 12 月成交 PSF 区间（缓存）
  add column psf_max         numeric(10,2),
  add column psf_period_end  date,                                 -- PSF 区间数据截止日
  add column status          varchar(16) not null default 'stub';  -- active / hidden / stub

create unique index projects_slug_idx on projects (slug) where slug is not null;
create index projects_status_district_idx on projects (status, district);
```

### 2.2 新表

```sql
-- 成交（盈利 / PSF 来源）
create table project_transactions (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  txn_date     date not null,
  price        numeric(14,2) not null,
  area_sqft    numeric(10,2) not null,
  psf          numeric(10,2) not null,
  bedroom_type varchar(20),            -- '1','2',...,'penthouse'；URA 无则 null
  sale_type    smallint,              -- 1 新销 / 2 转售 / 3 再售（URA typeOfSale）
  source       varchar(20) not null default 'ura',
  ingested_at  timestamptz not null default now(),
  unique (project_id, txn_date, area_sqft, price)   -- 幂等去重键
);
create index project_txn_proj_date_idx on project_transactions (project_id, txn_date desc);

-- 配套（地段 / 学校 / 地图来源）
create table project_amenities (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  kind         varchar(24) not null,  -- mrt / busstop / school / mall / park ...
  name         varchar(200) not null,
  lat          numeric(9,6),
  lng          numeric(9,6),
  distance_m   numeric(10,1),
  walk_minutes numeric(6,1),
  metadata     jsonb not null default '{}'::jsonb,  -- 学校 P1 热度、MRT 线路等
  refreshed_at timestamptz not null default now()
);
create index project_amenity_proj_kind_idx on project_amenities (project_id, kind);

-- 评分缓存（确定性 / 可解释 / 带置信度）
create table project_scores (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  dimension          varchar(12) not null,   -- profit / location / exit / rental
  score              numeric(4,2),           -- 0-10，null = 数据不足
  band               varchar(16) not null,   -- excellent/good/fair/poor/insufficient
  confidence         varchar(20) not null,   -- high / low / estimated_similar
  components          jsonb not null default '{}'::jsonb,  -- 子因子明细 →「怎么算的」
  regime             varchar(24),            -- 市场状态标签
  basis              jsonb not null default '{}'::jsonb,   -- { similarProjects[], txnCount }
  data_snapshot_date date not null,          -- 数据快照日（漂移解释 §5.4）
  score_version      varchar(20) not null,   -- 算法版本
  computed_at        timestamptz not null default now(),
  unique (project_id, dimension, score_version)
);
create index project_scores_proj_idx on project_scores (project_id);

-- 数据纠错闭环（SPEC §7.2）
create table project_data_feedback (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  dimension   varchar(12),
  user_note   text not null,
  contact     varchar(120),
  status      varchar(16) not null default 'open',  -- open/reviewing/resolved/rejected
  created_at  timestamptz not null default now()
);
```

### 2.3 RLS（沿用现有策略风格）

- `projects`(status='active') / `project_transactions` / `project_amenities` / `project_scores`：**anon 可 SELECT**（详情页免登录，SPEC §2）。`status in ('stub','hidden')` 不对 anon 暴露。
- 所有写操作仅 **service-role**（离线管线 / 运营后台）。
- `project_data_feedback`：anon 可 INSERT（带 rate-limit），仅 service-role/staff 可 SELECT。

---

## 3. slug 与 SEO

- slug：项目名 → 小写、去空格/特殊符；同名加区后缀（`the-gazania-d19`）；冲突追加短哈希。生成在入库 worker，唯一约束在 DB。
- slug 变更（极少）→ 旧 slug 存 `projects.metadata.slug_history[]`，中间件 **301** 到新 slug。
- 详情页 **SSR/SSG**（Next.js server component 直接查缓存表），首屏决策快照对爬虫可见；`sitemap.ts` 随 `status='active'` 动态生成；`Schema.org` 用 `Residence`，**不用 AggregateRating**（SPEC §10/§11）。

---

## 4. 在线读路径（详情页）

### 4.1 渲染方式：SSR 直读，不经自有 HTTP API

详情页是 server component，直接用 `getSupabaseServerClient()` 查缓存表拼装 payload（少一跳、利于 LCP/SEO）。对外 REST 仅给「客户端增量交互」用（适配度重算、tab 懒数据、收藏）。

```
app/(tools)/condo/[slug]/page.tsx   ← SSR：getReportData(slug)
lib/condo/report.ts                 ← 组装：projects + scores + amenities + transactions(近12m)
```

`getReportData(slug)` 返回结构（即「决策快照 + 四维 + tabs」一次取齐，避免瀑布）：

```ts
interface CondoReport {
  project: { slug; name; district; tenure; topYear; totalUnits; developer; lat; lng; psfMin; psfMax; psfPeriodEnd };
  scores: ProjectScore[];                 // profit/location 有值，exit/rental insufficient
  verdict: { band: 'green'|'amber'|'orange'; sentence: string };  // 模板拼装，非 LLM（§5）
  keyMetrics: { topYear; tenure; nearestMrt; totalUnits };
  amenities: { mrt: []; schools: []; malls: [] };
  transactions: ProjectTxn[];             // 近 12 月，供成交 tab + PSF 走势
  snapshotDate; scoreVersion;
  diff?: { profit: '+0.3'; reason: '新增 4 笔成交' };   // §5.4
  disclaimers: string[];                  // 合规免责
}
```

未收录（`status='stub'`/查无）：**不渲染半截报告**，返回「按区浏览 + 留资」兜底（SPEC §6.3），HTTP 200 + `noindex`。

### 4.2 适配度（个性化，单独算）

适配度依赖**用户**的购买力，不能进项目级缓存。来源优先级：
1. 用户最近一次 `calculator_runs`（登录）或前端 localStorage 缓存的 calc 结果；
2. 都没有 → 显示「测一下买不买得起 →」。

```
POST /api/v1/condo/fit
  body: { slug, calcRunId? | calcInputs? }
  → 复用 computeV2 求购买力区间；用 projects.psf_min/max × 典型面积反推本盘起价；
    calculateAbsd 算身份负担；返回 { projectPriceFrom, comfortRange, inBudget, absd }
```

> **零外部依赖、纯函数**（同 calculator/compute 范式），可被详情页客户端组件即时调用。

### 4.3 其余 REST 接口（边界，详情页相关）

| 接口 | 用途 |
| --- | --- |
| `GET /api/v1/condo/search?q=` | 自动补全（查 `projects` active，名称/区/邮编模糊） |
| `GET /api/v1/condo/projects?district=&sort=` | 搜索结果列表（卡片预览：盈利分+结论+PSF） |
| `POST /api/v1/condo/fit` | 适配度即时计算（§4.2） |
| `POST /api/v1/condo/feedback` | 数据纠错写入（§7.2，anon 限流） |

响应统一 `{ ok, data|error }`，错误码沿用 `INVALID_INPUT` 等，新增 `PROJECT_NOT_FOUND` / `PROJECT_NOT_PUBLISHED`。

---

## 5. 评分引擎（`lib/project-scoring/`，新建）

> SPEC §5.3 红线：**不要**扩展 `lib/scoring/`（那是 lead 评分 stub）。楼盘多维评分新建独立模块。

```
lib/project-scoring/
  types.ts          // ProjectScore / MarketRegime / band 单一来源常量映射
  profit.ts         // computeProfitScore(txns, regionalBaseline) → 同户型 CAGR vs 基准
  location.ts       // computeLocationScore(amenities) → MRT步行 + 1km小学 + 配套密度
  verdict.ts        // 四维分档 → 一句话结论（模板拼装，禁 LLM 幻觉数字）
  similar.ts        // 相似盘聚类（区+价位+TOP楼龄）→ 盈利样本不足时回退
  index.ts          // scoreProject(projectId, snapshot) 编排，写 project_scores
```

特性（SPEC §5.1）：**确定性**（同 `data_snapshot_date` 同输出）、**可解释**（返回 `components`）、**带置信度**。

### 5.1 可复用现有代码（已核对存在）

| 现有 | 用途 |
| --- | --- |
| `lib/calculator/v2-compute.ts#computeV2` | 适配度购买力区间、首付/月供 |
| `lib/tax/#calculateAbsd/#calculateBsd/#solveMaxPurchasePrice` | 适配度 ABSD 负担、PSF→可负担总价反推 |
| `lib/finance/rent-estimate.ts#estimateMedianRent` | 租赁维度（V2.1）租金基准 |
| `lib/finance/index.ts#regionalAppreciationLookup` | 盈利维度同区基准回退 |

### 5.2 数据诚实度 → 字段映射（SPEC §4.3，可测断言）

引擎输出直接驱动 UI 标注，CI 用黄金样本回归：

| 触发 | 输出 |
| --- | --- |
| 近 12 月转售 < 3 笔 | `confidence != 'high'` |
| 用相似盘估 | `confidence == 'estimated_similar'`，`basis.similarProjects[]` |
| TOP < 1 年 | `regime == 'new_project'` |
| 某户型交易太少 | `components.byBedroom[x].excluded == true` |
| 完全无转售史 | `score == null`, `band == 'insufficient'` |

### 5.3 版本化与漂移解释（SPEC §5.4）

- `project_scores` 存 `data_snapshot_date + score_version`，历史快照保留。
- 详情页「最后计算时间」旁的 diff 文案：取同 project 上一快照算差值（「较上次 +0.3，因新增 4 笔成交」）。
- 算法迭代 bump `score_version`，旧分可回溯。

---

## 6. 离线采集管线（cron）

> 全部 service-role 写。MVP 用 Supabase 定时任务 / Vercel Cron 触发 route handler（`app/api/cron/condo-*`，校验 `CRON_SECRET`）。

| Job | 频率 | 动作 | 幂等 |
| --- | --- | --- | --- |
| `ingest-ura-transactions` | 夜间 | 取 URA token → 拉增量成交 → SVY21→WGS84 → upsert `project_transactions` → 刷 `projects.psf_min/max` | upsert 唯一键 |
| `recompute-scores` | 夜间（成交后） | 对受影响 project 跑 `scoreProject` → 写 `project_scores`（新 snapshot） | 按 snapshot_date |
| `geocode-amenities` | 月级 / 新项目入库 | OneMap geocode + themes + walk 时间 → `project_amenities` | 按 (proj,kind,name) |
| `ingest-hdb-supply`（V2.1） | 夜间 | data.gov.sg HDB resale + 未来供应 → 退出维度 | — |

冷启动（SPEC §6.3）：先**人工 seed 50–100 热门盘**（`status='active'`），管线再增量回填；未铺满时搜索只露「按区浏览/留资」，**绝不空列表**。

失败策略：外部源抖动 → job 重试 + 告警；**绝不**让缓存表写半截脏数据污染读路径（写入事务化 / 先算后 swap）。

---

## 7. 验收对齐（SPEC §13）

- [ ] 详情页 SSR 只读缓存表，请求时零外部调用 → 4G LCP < 2s（地图懒加载不计首屏）。
- [ ] 每个分数 `components` 非空，前端「怎么算的」可展开（无黑箱）。
- [ ] §4.3 每个数据不足场景满足对应可测断言，黄金样本（3–5 真实盘含 1 数据不足 + 1 新盘）CI 回归。
- [ ] 同 project 同 `data_snapshot_date` 分数确定性可复现。
- [ ] 一句话结论模板拼装，全链路无 LLM 生成数字。
- [ ] 全库无 `valuation/估值/这套值` 字段或文案（lint/检索可查）。
- [ ] 免登录读完整报告；保存/深度报告/约顾问 gate 登录。

---

## 8. MVP 实施顺序

1. **DDL**：projects 扩展列 + 4 张新表 + RLS + slug。
2. **冷启动 seed**：人工 50–100 盘（含坐标）。
3. **采集管线**：`ingest-ura-transactions` + `geocode-amenities`（OneMap）。
4. **评分引擎**：`lib/project-scoring/` 的 profit + location + verdict + similar（退出/租赁 stub）。
5. **读路径**：`lib/condo/report.ts` + `app/(tools)/condo/[slug]/page.tsx`（SSR）。
6. **适配度 + 接口**：`POST /condo/fit`、`/search`、`/projects`、`/feedback`。
7. **SEO**：sitemap + 301 + Schema.org；埋点（SPEC §8）。

> 退出/租赁完整算法、HDB 源、伴随地图全图层 → V2.1（与 SPEC §12 对齐）。
