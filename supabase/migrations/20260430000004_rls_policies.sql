-- =====================================================================
-- Row Level Security policies
-- Default posture: DENY everything for anon/authenticated, then add
-- narrow allow rules. Service-role connections bypass RLS automatically.
--
-- These are MVP policies — production will tighten further (e.g. roles,
-- audit hooks, column-level encryption). Engineering must NOT loosen
-- these without a security review.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: identify "self" via Supabase Auth
-- ---------------------------------------------------------------------

create or replace function current_user_id()
returns uuid
language sql
stable
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------
-- users — a user can read & update their own row
-- ---------------------------------------------------------------------

create policy users_self_select on users
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy users_self_update on users
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ---------------------------------------------------------------------
-- user_profile
-- ---------------------------------------------------------------------

create policy user_profile_self_select on user_profile
  for select to authenticated
  using (user_id = current_user_id());

create policy user_profile_self_upsert on user_profile
  for insert to authenticated
  with check (user_id = current_user_id());

create policy user_profile_self_update on user_profile
  for update to authenticated
  using (user_id = current_user_id())
  with check (user_id = current_user_id());

-- ---------------------------------------------------------------------
-- calculator_runs / quiz_runs — anonymous insert allowed (PRD §6.7);
-- read limited to row-owner once associated.
-- ---------------------------------------------------------------------

create policy calculator_runs_anon_insert on calculator_runs
  for insert to anon
  with check (user_id is null);

create policy calculator_runs_self_insert on calculator_runs
  for insert to authenticated
  with check (user_id is null or user_id = current_user_id());

create policy calculator_runs_self_select on calculator_runs
  for select to authenticated
  using (user_id = current_user_id());

create policy quiz_runs_anon_insert on quiz_runs
  for insert to anon
  with check (user_id is null);

create policy quiz_runs_self_insert on quiz_runs
  for insert to authenticated
  with check (user_id is null or user_id = current_user_id());

create policy quiz_runs_self_select on quiz_runs
  for select to authenticated
  using (user_id = current_user_id());

-- ---------------------------------------------------------------------
-- leads / lead_scores / lead_assignments / lead_journey_events
-- C-end: user can read their own lead. Operations / agents access via
-- service-role (admin API) until role-based policies are added.
-- ---------------------------------------------------------------------

create policy leads_self_select on leads
  for select to authenticated
  using (user_id = current_user_id());

create policy lead_scores_self_select on lead_scores
  for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_scores.lead_id and l.user_id = current_user_id()
    )
  );

create policy lead_assignments_self_select on lead_assignments
  for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_assignments.lead_id and l.user_id = current_user_id()
    )
  );

create policy lead_journey_events_self_select on lead_journey_events
  for select to authenticated
  using (
    user_id = current_user_id()
    or exists (
      select 1 from leads l
      where l.id = lead_journey_events.lead_id and l.user_id = current_user_id()
    )
  );

-- ---------------------------------------------------------------------
-- consent_log — append-only insert; user can read their own log
-- (UPDATE/DELETE were revoked at table grant level in migration 2)
-- ---------------------------------------------------------------------

create policy consent_log_anon_insert on consent_log
  for insert to anon
  with check (user_id is null);

create policy consent_log_auth_insert on consent_log
  for insert to authenticated
  with check (user_id is null or user_id = current_user_id());

create policy consent_log_self_select on consent_log
  for select to authenticated
  using (user_id = current_user_id());

-- ---------------------------------------------------------------------
-- agents / agent_profile
-- An agent can read & update their own row (linked via auth_user_id).
-- ---------------------------------------------------------------------

create policy agents_self_select on agents
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy agents_self_update on agents
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy agent_profile_self_select on agent_profile
  for select to authenticated
  using (
    exists (select 1 from agents a where a.id = agent_profile.agent_id and a.auth_user_id = auth.uid())
  );

create policy agent_profile_self_upsert on agent_profile
  for insert to authenticated
  with check (
    exists (select 1 from agents a where a.id = agent_profile.agent_id and a.auth_user_id = auth.uid())
  );

create policy agent_profile_self_update on agent_profile
  for update to authenticated
  using (
    exists (select 1 from agents a where a.id = agent_profile.agent_id and a.auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from agents a where a.id = agent_profile.agent_id and a.auth_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- deals / settlements — service-role only at MVP.
-- (No anon/authenticated policies → effectively denied.)
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- projects — public read (cached URA reference data is non-sensitive)
-- ---------------------------------------------------------------------

create policy projects_public_select on projects
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------
-- content — public can read PUBLISHED rows only
-- ---------------------------------------------------------------------

create policy content_public_select on content
  for select to anon, authenticated
  using (status = 'published');

-- ---------------------------------------------------------------------
-- config / tax_rates — public read of currently effective rows.
-- Writes restricted to service-role.
-- ---------------------------------------------------------------------

create policy config_public_select on config
  for select to anon, authenticated
  using (effective_to is null or effective_to > now());

create policy tax_rates_public_select on tax_rates
  for select to anon, authenticated
  using (effective_to is null or effective_to > current_date);
