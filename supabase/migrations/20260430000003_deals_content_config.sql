-- =====================================================================
-- Deals, settlements, projects, content, config tables
-- =====================================================================

-- ---------------------------------------------------------------------
-- projects (cached from URA)
-- ---------------------------------------------------------------------

create table projects (
  id uuid primary key default gen_random_uuid(),
  external_ref varchar(120) unique,                 -- URA project key
  name varchar(200) not null,
  district varchar(10),
  tenure varchar(40),
  top_year int,
  total_units int,
  developer varchar(200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_district_idx on projects (district);

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

alter table projects enable row level security;

-- ---------------------------------------------------------------------
-- deals
-- ---------------------------------------------------------------------

create table deals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete restrict,
  agent_id uuid not null references agents (id) on delete restrict,
  project_id uuid references projects (id) on delete set null,
  stage deal_stage not null default 'lead',
  transaction_price numeric(14, 2),
  commission_total numeric(14, 2),
  platform_share_pct numeric(5, 4) not null default 0.20,
  platform_share_amount numeric(14, 2),
  ota_signed_at date,
  completion_date date,
  buyer_confirmed_at timestamptz,
  agent_confirmed_at timestamptz,
  settlement_status settlement_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column deals.transaction_price is
  'PII: transaction price — application-level encryption recommended (PRD §16.4)';

create index deals_lead_idx on deals (lead_id);
create index deals_agent_idx on deals (agent_id);
create index deals_stage_idx on deals (stage);

create trigger deals_set_updated_at
  before update on deals
  for each row execute function set_updated_at();

alter table deals enable row level security;

-- ---------------------------------------------------------------------
-- settlements
-- ---------------------------------------------------------------------

create table settlements (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null unique references deals (id) on delete restrict,
  agent_id uuid not null references agents (id) on delete restrict,
  amount_owed numeric(14, 2) not null,
  status settlement_status not null default 'pending',
  paid_at timestamptz,
  reference varchar(120),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger settlements_set_updated_at
  before update on settlements
  for each row execute function set_updated_at();

alter table settlements enable row level security;

-- ---------------------------------------------------------------------
-- content (CMS)
-- ---------------------------------------------------------------------

create table content (
  id uuid primary key default gen_random_uuid(),
  slug varchar(200) not null unique,
  title varchar(300) not null,
  body_md text,
  excerpt text,
  hero_image_url text,
  status content_status not null default 'draft',
  tags text[] not null default '{}',
  meta_title varchar(300),
  meta_description text,
  og_image_url text,
  published_at timestamptz,
  author_user_id uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_status_idx on content (status, published_at desc);
create index content_tags_idx on content using gin (tags);

create trigger content_set_updated_at
  before update on content
  for each row execute function set_updated_at();

alter table content enable row level security;

-- ---------------------------------------------------------------------
-- config — generic key/value with versioning
-- ---------------------------------------------------------------------

create table config (
  key varchar(120) not null,
  version varchar(40) not null,
  value jsonb not null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  primary key (key, version)
);

create index config_active_idx on config (key, effective_from desc) where effective_to is null;

alter table config enable row level security;

-- ---------------------------------------------------------------------
-- tax_rates — typed config table for BSD/ABSD/LTV/TDSR/MSR
-- Calc engine MUST read from this table (PRD Appendix §24).
-- ---------------------------------------------------------------------

create table tax_rates (
  id uuid primary key default gen_random_uuid(),
  version varchar(40) not null unique,
  effective_from date not null,
  effective_to date,
  bsd_slabs jsonb not null,
  absd_matrix jsonb not null,
  ltv_rules jsonb not null,
  tdsr jsonb not null,
  msr jsonb not null,
  notes text,
  created_at timestamptz not null default now()
);

create index tax_rates_active_idx on tax_rates (effective_from desc) where effective_to is null;

alter table tax_rates enable row level security;
