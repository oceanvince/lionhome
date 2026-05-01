-- =====================================================================
-- LionHome — Initial extensions, enums, and helper functions
-- All tables use UUID PKs and timestamptz for timestamps (PRD §16).
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "citext";

-- ---------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------

create type residency_status as enum ('citizen', 'pr', 'foreigner', 'company');

create type marital_status as enum (
  'single',
  'married',
  'married_foreign_spouse'
);

create type preferred_language as enum ('zh-CN', 'zh-TW', 'en');

create type lead_status as enum (
  'new',
  'layer1',
  'layer2',
  'qualified',
  'routed',
  'contacted',
  'viewing',
  'negotiation',
  'closed',
  'lost',
  'dormant'
);

create type buyer_archetype as enum (
  'upgrader',
  'school',
  'commuter',
  'value',
  'diaspora'
);

create type readiness_band as enum ('hot', 'warm', 'cool', 'cold');

create type agent_status as enum ('active', 'paused', 'removed');

create type agent_tier as enum ('top', 'mid', 'probation', 'removed');

create type deal_stage as enum (
  'lead',
  'contacted',
  'viewing',
  'negotiation',
  'otp_issued',
  'completed',
  'lost'
);

create type settlement_status as enum (
  'pending',
  'verified',
  'paid',
  'disputed'
);

create type consent_type as enum (
  'privacy_policy',
  'data_sharing_with_advisor',
  'marketing_email',
  'marketing_whatsapp',
  'cookies'
);

create type lead_event_type as enum (
  'page_view',
  'cta_click',
  'form_start',
  'form_submit',
  'chat_message',
  'note',
  'system'
);

create type report_request_status as enum (
  'pending',
  'in_progress',
  'ready',
  'expired',
  'cancelled'
);

create type content_status as enum ('draft', 'scheduled', 'published', 'archived');

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
