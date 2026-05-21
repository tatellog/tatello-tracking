-- =====================================================================
-- 2026-05-20 — Stelar voice tone preference
--
-- Step 3 of the wizard was originally "fricciones" (multi-select of
-- emotional blockers). That territory was emotional + ED-adjacent and
-- the team pulled it back. This column replaces it with a much lighter,
-- neutral question: "¿Cómo te gustaría que te hable Stelar?".
--
-- Four bands the Voz pipeline reads to tune phrasing:
--
--   directa  → short, declarative, no softeners
--   suave    → gentler verbs, more reassurance, no urgency
--   curiosa  → reads as questions where it can
--   amiga    → casual, contractions, lower formality
--
-- NULL = the user hasn't reached the screen yet OR onboarded before
-- this column existed. The Voz layer falls back to 'suave' when NULL
-- so unconfigured profiles still get a humane default.
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
