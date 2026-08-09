-- =====================================================================
-- analytics_events — first-party product analytics
--
-- Answers the daily ops questions that Vercel's runtime log cannot:
-- how many real people opened /calculator, how many pressed 计算,
-- how many went on to contact an advisor.
--
-- Deliberately NOT a general event bus: `name` is a short allow-list
-- enforced in lib/analytics/events.ts, and `props` stays small.
--
-- Privacy: no IP, no phone, no email, no free-form user input. visitor_id
-- and session_id are random first-party ids minted in the browser, so a
-- row is not personal data on its own (PDPA). Rows older than the
-- retention window are pruned by /api/cron/daily-report.
-- =====================================================================

create table analytics_events (
  id bigint generated always as identity primary key,
  name varchar(60) not null,
  visitor_id varchar(64),                         -- localStorage, survives reloads
  session_id varchar(64),                         -- sessionStorage, one browsing session
  path varchar(200),
  country varchar(8),                             -- x-vercel-ip-country
  is_bot boolean not null default false,          -- UA matched the crawler list
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- The daily report scans one or two days at a time; both indexes serve it.
create index analytics_events_created_at_idx on analytics_events (created_at desc);
create index analytics_events_name_created_at_idx on analytics_events (name, created_at desc);

-- Default-deny, matching the posture in 20260430000004_rls_policies.sql.
-- No policies are granted: anon/authenticated can neither read nor write.
-- All writes go through the service-role client (which bypasses RLS) in
-- /api/v1/events and /api/v1/calculator/compute.
alter table analytics_events enable row level security;

comment on table analytics_events is
  'First-party funnel events. Written server-side only. Pruned after 180 days.';
