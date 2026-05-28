-- =====================================================================
-- 2026-05-28 — profiles.is_beta flag
--
-- Gates the lib/analytics.ts tracker. Only users with is_beta=true
-- generate rows in public.analytics_events; everyone else no-ops
-- silently. Manually flipped per beta cohort via Supabase Studio
-- (no in-app UI to toggle).
-- =====================================================================

alter table public.profiles
  add column if not exists is_beta boolean not null default false;
