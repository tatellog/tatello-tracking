-- =====================================================================
-- 2026-05-20 — drop profiles.voice_tone
--
-- The step that fed this column (the old "fricciones" slot, rebooted
-- as a Stelar-tone selector) was retired before any consumer wired
-- it in. The column held NULL for every row in flight; dropping it
-- now keeps the schema honest with what the wizard actually captures.
--
-- If a multi-tone Voz pipeline lands later, it can re-introduce the
-- column with the bands it actually needs.
-- =====================================================================

alter table public.profiles
  drop column if exists voice_tone;
