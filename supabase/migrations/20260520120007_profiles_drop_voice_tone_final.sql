-- =====================================================================
-- 2026-05-20 — drop profiles.voice_tone (final)
--
-- The team decided not to keep the tone-selection step after all. The
-- column was re-added in 20260520120006 to set up the redesigned
-- screen; the screen got reverted before any user data was captured,
-- so the column drops again to keep the schema honest.
-- =====================================================================

alter table public.profiles
  drop column if exists voice_tone;
