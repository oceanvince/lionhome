-- =====================================================================
-- Core tables: users, profile, calculator/quiz runs, leads, agents.
-- Every table has RLS enabled (PRD §16.4 + §19.3).
-- PII columns are flagged in COMMENTs — application-level encryption
-- (Supabase pgcrypto) to be added in the application layer.
-- =====================================================================

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------

create table users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                       -- FK to auth.users (Supabase Auth)
  phone varchar(20),                              -- E.164
  email citext,
  display_name varchar(100),
  residency residency_status,
  preferred_language preferred_language not null default 'zh-CN',
  utm_source varchar(255),
  utm_medium varchar(255),
  utm_campaign varchar(255),
  utm_content varchar(255),
  utm_term varchar(255),
  last_seen_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column users.phone is 'PII: E.164 phone — application-level encryption required (PRD §16.4)';
comment on column users.email is 'PII: email — application-level encryption required (PRD §16.4)';
comment on column users.display_name is 'PII: display name — handle with care (PRD §16.4)';

create unique index users_phone_unique on users (phone) where phone is not null and deleted_at is null;
create unique index users_email_unique on users (email) where email is not null and deleted_at is null;
create index users_last_seen_idx on users (last_seen_at desc);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

alter table users enable row level security;

-- ---------------------------------------------------------------------
-- user_profile (extended fields)
-- ---------------------------------------------------------------------

create table user_profile (
  user_id uuid primary key references users (id) on delete cascade,
  marital_status marital_status,
  spouse_residency residency_status,
  household_size int,
  age int,
  employment_type varchar(40),
  preferred_districts text[],
  preferred_unit_types text[],
  self_use_weight int,                            -- 0-100 slider
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_profile_set_updated_at
  before update on user_profile
  for each row execute function set_updated_at();

alter table user_profile enable row level security;

-- ---------------------------------------------------------------------
-- calculator_runs
-- ---------------------------------------------------------------------

create table calculator_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  session_id uuid not null default gen_random_uuid(),
  inputs jsonb not null,
  outputs jsonb not null,
  tax_rates_version varchar(40) not null,         -- which tax_rates row was used
  created_at timestamptz not null default now()
);

comment on column calculator_runs.inputs is
  'PII: contains income/cash/CPF/budget figures — application-level encryption required (PRD §16.4)';

create index calculator_runs_user_idx on calculator_runs (user_id, created_at desc);
create index calculator_runs_session_idx on calculator_runs (session_id);

alter table calculator_runs enable row level security;

-- ---------------------------------------------------------------------
-- quiz_runs
-- ---------------------------------------------------------------------

create table quiz_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,
  session_id uuid not null default gen_random_uuid(),
  answers jsonb not null,
  archetype buyer_archetype,
  score int,
  score_components jsonb,
  created_at timestamptz not null default now()
);

create index quiz_runs_user_idx on quiz_runs (user_id, created_at desc);
create index quiz_runs_session_idx on quiz_runs (session_id);

alter table quiz_runs enable row level security;

-- ---------------------------------------------------------------------
-- agents
-- ---------------------------------------------------------------------

create table agents (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  name varchar(120) not null,
  cea_number varchar(20) not null unique,
  cea_verified_at timestamptz,
  status agent_status not null default 'active',
  tier agent_tier not null default 'mid',
  phone varchar(20),
  whatsapp varchar(20),
  email citext,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column agents.phone is 'PII: agent contact — application-level encryption required';
comment on column agents.whatsapp is 'PII: agent contact — application-level encryption required';
comment on column agents.email is 'PII: agent contact — application-level encryption required';

create trigger agents_set_updated_at
  before update on agents
  for each row execute function set_updated_at();

alter table agents enable row level security;

-- ---------------------------------------------------------------------
-- agent_profile
-- ---------------------------------------------------------------------

create table agent_profile (
  agent_id uuid primary key references agents (id) on delete cascade,
  bio text,
  specializations jsonb not null default '{}'::jsonb,   -- {districts:[], property_types:[], buyer_archetypes:[], languages:[]}
  years_experience int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger agent_profile_set_updated_at
  before update on agent_profile
  for each row execute function set_updated_at();

alter table agent_profile enable row level security;

-- ---------------------------------------------------------------------
-- leads
-- ---------------------------------------------------------------------

create table leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  status lead_status not null default 'new',
  score int not null default 0 check (score between 0 and 100),
  score_components jsonb,
  buyer_archetype buyer_archetype,
  readiness_band readiness_band,
  current_assignment_id uuid,                     -- set after lead_assignments row exists; FK added below
  source_channel varchar(60),
  source_campaign varchar(120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_status_idx on leads (status);
create index leads_score_idx on leads (score desc);
create index leads_user_idx on leads (user_id);

create trigger leads_set_updated_at
  before update on leads
  for each row execute function set_updated_at();

alter table leads enable row level security;

-- ---------------------------------------------------------------------
-- lead_scores (history)
-- ---------------------------------------------------------------------

create table lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  score int not null check (score between 0 and 100),
  components jsonb not null,
  computed_by varchar(40) not null default 'system',
  created_at timestamptz not null default now()
);

create index lead_scores_lead_idx on lead_scores (lead_id, created_at desc);

alter table lead_scores enable row level security;

-- ---------------------------------------------------------------------
-- lead_assignments
-- ---------------------------------------------------------------------

create table lead_assignments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  agent_id uuid not null references agents (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  expires_at timestamptz,
  outcome varchar(40),
  notes text,
  created_at timestamptz not null default now()
);

create index lead_assignments_lead_idx on lead_assignments (lead_id, assigned_at desc);
create index lead_assignments_agent_idx on lead_assignments (agent_id, assigned_at desc);

alter table lead_assignments enable row level security;

alter table leads
  add constraint leads_current_assignment_fk
  foreign key (current_assignment_id) references lead_assignments (id) on delete set null;

-- ---------------------------------------------------------------------
-- lead_journey_events (high-volume)
-- ---------------------------------------------------------------------

create table lead_journey_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  event_type lead_event_type not null,
  event_data jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index lead_journey_events_lead_idx on lead_journey_events (lead_id, occurred_at desc);
create index lead_journey_events_user_idx on lead_journey_events (user_id, occurred_at desc);
create index lead_journey_events_type_idx on lead_journey_events (event_type, occurred_at desc);

alter table lead_journey_events enable row level security;

-- ---------------------------------------------------------------------
-- consent_log (CRITICAL — append-only, never deleted; PRD §16, §18.1)
-- ---------------------------------------------------------------------

create table consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users (id) on delete set null,    -- nulled on user delete; row preserved
  consent_type consent_type not null,
  consent_version varchar(40) not null,
  consent_text_hash varchar(128) not null,
  granted boolean not null,
  ip_address inet,
  user_agent text,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

create index consent_log_user_idx on consent_log (user_id, granted_at desc);
create index consent_log_type_idx on consent_log (consent_type, granted_at desc);

alter table consent_log enable row level security;

-- Block UPDATE and DELETE at the table level — append-only by design.
-- Withdrawal is recorded via a NEW row with granted=false; withdrawn_at update
-- on the original row is allowed only via the revoke_consent SECURITY DEFINER
-- function (added in a later migration when we wire ops tooling).
revoke update, delete on consent_log from public;
revoke update, delete on consent_log from authenticated;
revoke update, delete on consent_log from anon;
