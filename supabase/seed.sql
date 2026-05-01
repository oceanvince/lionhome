-- =====================================================================
-- LionHome — local-development seed data
-- Run via `supabase db reset` (which re-applies migrations + seed.sql).
-- DO NOT add real PII here.
-- =====================================================================

-- Sample article (draft) so the CMS read path has something to query.
insert into content (slug, title, body_md, status, tags)
values (
  'welcome-lionhome',
  'Welcome to LionHome',
  '# Welcome\n\nThis is a seeded draft article for local development.',
  'draft',
  array['welcome']
)
on conflict (slug) do nothing;
