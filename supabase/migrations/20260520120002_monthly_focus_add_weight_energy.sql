-- =====================================================================
-- 2026-05-20 — monthly_focus: add weight + energy
--
-- The intention chips in tu-intencion.tsx originally covered only
-- dimensional outcomes (sleep / movement / food / mind / cycle /
-- self_knowledge). Real users come with two more buckets we kept
-- forcing into the wrong slot:
--
--   weight  — "bajar de peso" is the #1 reason a user opens an app
--             in this category. Mapping it to "food" or "movement"
--             muddied which dimension the Voz biases toward.
--   energy  — "tener más energía" is a distinct outcome from the
--             behaviour ("moverme más") that produces it. The user
--             tells us the outcome they want; Stelar picks the
--             behaviour.
--
-- This drops the old CHECK constraint and replaces it with the
-- expanded set. NULLABLE stays; users from before this migration
-- keep whatever value they had.
-- =====================================================================

alter table public.profiles
  drop constraint if exists profiles_monthly_focus_check;

alter table public.profiles
  add constraint profiles_monthly_focus_check check (
    monthly_focus is null or monthly_focus in (
      'weight',
      'energy',
      'sleep',
      'food',
      'cycle',
      'patterns',
      'mind',
      'other'
    )
  );

-- 'self_knowledge' is renamed to 'patterns' to match the rephrased
-- chip ("Entender mis patrones") — clearer about what Stelar
-- actually does. Migrate any existing rows so the CHECK above can
-- enforce the new set without orphaning data.
update public.profiles
   set monthly_focus = 'patterns'
 where monthly_focus = 'self_knowledge';
