-- =====================================================================
-- Condo Search — 决策报告页 /condo/{slug} 的数据底座
-- projects 扩展列 + project_transactions / project_amenities /
-- project_scores / project_data_feedback。
-- 设计见 docs/CONDO_SEARCH_TD.md §2。
--
-- 读写分离：写仅 service-role（离线采集管线 / 运营后台）；
-- anon/authenticated 只读非敏感的 URA/OneMap 派生数据（与 projects 同口径）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- projects 扩展列：URL slug、经纬度、缓存 PSF 区间、发布状态
-- （slug 唯一性用下方 partial unique index 处理，允许多个 stub 为 null）
-- ---------------------------------------------------------------------

alter table projects
  add column if not exists slug           varchar(160),   -- URL slug，决定 /condo/{slug} 地址；唯一约束见下方 partial index
  add column if not exists lat            numeric(9, 6),  -- 纬度（WGS84）；地段评分与地图打点用，由 OneMap geocode
  add column if not exists lng            numeric(9, 6),  -- 经度（WGS84）；同上
  add column if not exists psf_min        numeric(10, 2), -- 近 12 月成交 PSF 区间下界（缓存自 project_transactions）
  add column if not exists psf_max        numeric(10, 2), -- 近 12 月成交 PSF 区间上界（缓存）
  add column if not exists psf_period_end date,           -- 上面 PSF 区间的数据截止日，界定「近 12 月」口径并对外展示
  add column if not exists status         varchar(16) not null default 'stub'; -- 发布状态：active 对外可见 / hidden 下架 / stub 占位未收录

-- 唯一索引：保证 slug 不重复；partial index 跳过 slug 为 null 的 stub 行，避免多条 null 冲突
create unique index if not exists projects_slug_idx on projects (slug) where slug is not null;
-- 复合索引：搜索结果「按区 + 仅 active」走索引（status 在前先过滤 stub/hidden）
create index if not exists projects_status_district_idx on projects (status, district);

-- ---------------------------------------------------------------------
-- project_transactions — 成交记录：盈利分 / PSF 区间的逐笔来源（URA）
-- ---------------------------------------------------------------------

create table project_transactions (
  id           uuid primary key default gen_random_uuid(),               -- 主键，自动生成 UUID
  project_id   uuid not null references projects (id) on delete cascade, -- 所属楼盘外键；楼盘删除则级联删本盘成交
  txn_date     date not null,                                            -- 成交日期（URA contractDate），算 CAGR 与「近 12 月」口径
  price        numeric(14, 2) not null,                                  -- 成交总价（S$）
  area_sqft    numeric(10, 2) not null,                                  -- 面积（平方英尺 sqft）
  psf          numeric(10, 2) not null,                                  -- 每平方英尺单价 = price/area_sqft；冗余存便于排序与筛选
  bedroom_type varchar(20),                                              -- 户型（卧室数）'1'..'5'/'penthouse'；URA 无则 null，盈利分按户型拆分
  sale_type    smallint,                                                 -- 交易类型：1 新销 / 2 转售 / 3 再售（URA typeOfSale）；盈利分只看转售
  source       varchar(20) not null default 'ura',                       -- 数据来源标识，多源混入时区分
  ingested_at  timestamptz not null default now(),                       -- 入库时间戳，供采集管线审计与增量
  unique (project_id, txn_date, area_sqft, price)                        -- 幂等去重键：同盘同日同面积同价视为同一笔，重复 upsert 不增行
);

-- 索引：按楼盘取最近成交（盈利分 / 成交 tab / PSF 走势都按 project + 时间倒序读）
create index project_txn_proj_date_idx on project_transactions (project_id, txn_date desc);

alter table project_transactions enable row level security;

-- ---------------------------------------------------------------------
-- project_amenities — 周边配套：地段分 / 学校 tab / 伴随地图来源（OneMap + MOE）
-- ---------------------------------------------------------------------

create table project_amenities (
  id           uuid primary key default gen_random_uuid(),               -- 主键
  project_id   uuid not null references projects (id) on delete cascade, -- 所属楼盘外键，级联删除
  kind         varchar(24) not null,                                     -- 配套类型：mrt / busstop / school / mall / park…；按 kind 取对应地图图层
  name         varchar(200) not null,                                    -- 配套名称（如 Kovan MRT、Xinmin Primary）
  lat          numeric(9, 6),                                            -- 配套纬度（WGS84），地图打点用
  lng          numeric(9, 6),                                            -- 配套经度（WGS84）
  distance_m   numeric(10, 1),                                           -- 到本盘直线距离（米），「1km 内小学」等口径判断用
  walk_minutes numeric(6, 1),                                            -- 到本盘步行分钟（OneMap Routing），最近 MRT 步行子因子
  metadata     jsonb not null default '{}'::jsonb,                       -- 扩展字段：学校 P1 报名热度、MRT 线路代号等非结构化信息
  refreshed_at timestamptz not null default now()                        -- 最后刷新时间，地理数据月级更新的审计
);

-- 索引：按楼盘 + 类型取配套（如「这个盘 1km 内的 school」）
create index project_amenity_proj_kind_idx on project_amenities (project_id, kind);

alter table project_amenities enable row level security;

-- ---------------------------------------------------------------------
-- project_scores — 评分缓存：四维分数算分结果（确定性 / 可解释 / 带置信度）
-- ---------------------------------------------------------------------

create table project_scores (
  id                 uuid primary key default gen_random_uuid(),               -- 主键
  project_id         uuid not null references projects (id) on delete cascade, -- 所属楼盘外键，级联删除
  dimension          varchar(12) not null,                                     -- 维度：profit 盈利 / location 地段 / exit 退出 / rental 租赁
  score              numeric(4, 2),                                            -- 0–10 分；null = 数据不足，不硬凑
  band               varchar(16) not null,                                     -- 档位枚举：excellent/good/fair/poor/insufficient（与中文档位单一来源映射）
  confidence         varchar(20) not null,                                     -- 置信度：high / low / estimated_similar；驱动数据诚实度标注
  components         jsonb not null default '{}'::jsonb,                       -- 子因子明细，供前端「怎么算的」逐项展开
  regime             varchar(24),                                              -- 市场状态标签：流动活跃 / 惜售 / new_project…；给分数加语境
  basis              jsonb not null default '{}'::jsonb,                       -- 算分依据 { similarProjects[]:相似盘集合, txnCount:样本笔数 }
  data_snapshot_date date not null,                                            -- 输入数据快照日；确定性复现 + 漂移解释（§5.4）的锚点
  score_version      varchar(20) not null,                                     -- 算法版本号；迭代时 bump，历史快照可回溯
  computed_at        timestamptz not null default now(),                       -- 本次算分的时间戳
  unique (project_id, dimension, score_version)                                -- 唯一约束：一个盘的一个维度在某算法版本下只一条
);

-- 索引：详情页按楼盘一次取齐四维分数
create index project_scores_proj_idx on project_scores (project_id);

alter table project_scores enable row level security;

-- ---------------------------------------------------------------------
-- project_data_feedback — 数据纠错：用户「发现数据有误？反馈」（SPEC §7.2）
-- ---------------------------------------------------------------------

create table project_data_feedback (
  id         uuid primary key default gen_random_uuid(),               -- 主键
  project_id uuid not null references projects (id) on delete cascade, -- 被反馈的楼盘外键，级联删除
  dimension  varchar(12),                                              -- 被质疑的维度（可空：泛泛反馈不指定维度）
  user_note  text not null,                                            -- 用户填写的纠错内容
  contact    varchar(120),                                             -- 选填联系方式，便于回访（同时是 lead 信号）
  status     varchar(16) not null default 'open',                      -- 处理状态：open 待处理 / reviewing 核实中 / resolved 已解决 / rejected 驳回
  created_at timestamptz not null default now()                        -- 提交时间
);

create index project_data_feedback_proj_idx on project_data_feedback (project_id, created_at desc);

alter table project_data_feedback enable row level security;

-- =====================================================================
-- RLS 策略
-- 默认 deny；下面给窄 allow。service-role 自动绕过 RLS（采集管线/运营写入）。
-- =====================================================================

-- 成交 / 配套 / 评分：公开只读（与 projects_public_select 同口径，均为非敏感 URA/OneMap 派生数据）。
-- 注：是否对外暴露未发布盘由「读路径按 status='active' 过滤」在 repo 层兜底（详情页查无 active → 留资兜底）。
create policy project_transactions_public_select on project_transactions
  for select to anon, authenticated using (true);

create policy project_amenities_public_select on project_amenities
  for select to anon, authenticated using (true);

create policy project_scores_public_select on project_scores
  for select to anon, authenticated using (true);

-- 数据纠错：anon/authenticated 可提交（带应用层限流）；读取仅 service-role（无 select 策略 → 默认拒绝）。
create policy project_data_feedback_anon_insert on project_data_feedback
  for insert to anon with check (true);

create policy project_data_feedback_auth_insert on project_data_feedback
  for insert to authenticated with check (true);
