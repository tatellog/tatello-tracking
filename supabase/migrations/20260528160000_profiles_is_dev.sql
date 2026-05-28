-- =====================================================================
-- 2026-05-28 — profiles.is_dev flag
--
-- Gates internal-developer surfaces (the dev-constellations route,
-- and any future "see-everything" tools). Independent from is_beta:
-- you can be a beta user without being a dev, and vice versa.
-- Manually flipped via Supabase Studio — no in-app UI to toggle.
-- =====================================================================

alter table public.profiles
  add column if not exists is_dev boolean not null default false;
