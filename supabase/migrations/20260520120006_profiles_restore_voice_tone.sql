-- =====================================================================
-- 2026-05-20 — restore profiles.voice_tone
--
-- Brought back after the team decided to keep the tone-selection step
-- (with a proper visual redesign) instead of removing it. Same shape
-- as the 20260520120004 column — four bands the Voz pipeline reads.
-- NULL falls back to 'suave' in the Voz layer when not yet picked.
-- =====================================================================

alter table public.profiles
  add column if not exists voice_tone text
    check (
      voice_tone is null or voice_tone in (
        'directa',
        'suave',
        'curiosa',
        'amiga'
      )
    );
