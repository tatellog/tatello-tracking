-- =====================================================================
-- 2026-05-20 — órbita onboarding fields
--
-- Six columns the rebalanced onboarding fills so Stelar has a real
-- baseline from day one — without them the Voz can only speak in
-- abstractions ("5 horas de sueño se notan" needs to know YOUR median).
--
--   cycle_length_days     — drives Mes phase prediction past month 1
--   typical_sleep_hours   — baseline for "se notan menos horas" voz
--   training_frequency    — baseline for the entreno↔sueño pattern
--   cycle_situation       — gates Mes / cycle UI for users who don't
--                           menstruate, are on contraception, etc.
--   monthly_focus         — single chip choice; biases the Voz toward
--                           the user's intention for the cycle
--   frictions             — moved from AsyncStorage (`@app:onboarding_
--                           frictions`) to the DB; the TODO already
--                           lived in onboardingFlags.ts
--
-- All NULLABLE: existing users who pre-date this onboarding shouldn't
-- be force-stopped on the next session, and skipping cycle_situation
-- legitimately means "Stelar reads body without cycle data".
--
-- The last menstruation date does NOT live here — it goes into
-- cycle_events as a period_start row (the 20260518120003 migration
-- already supports that). One source of truth, no duplication.
-- =====================================================================

alter table public.profiles
  add column if not exists cycle_length_days int
    check (cycle_length_days is null or (cycle_length_days between 21 and 45));

alter table public.profiles
  add column if not exists typical_sleep_hours numeric(3,1)
    check (typical_sleep_hours is null or (typical_sleep_hours between 3 and 14));

alter table public.profiles
  add column if not exists training_frequency text
    check (training_frequency is null or training_frequency in ('none','low','mid','high'));

alter table public.profiles
  add column if not exists cycle_situation text
    check (
      cycle_situation is null or cycle_situation in (
        'menstruates',
        'contraception',
        'pregnant',
        'postmenopause',
        'irregular',
        'skip'
      )
    );

alter table public.profiles
  add column if not exists monthly_focus text
    check (
      monthly_focus is null or monthly_focus in (
        'sleep',
        'movement',
        'food',
        'mind',
        'cycle',
        'self_knowledge',
        'other'
      )
    );

-- jsonb so the engine can later read structured friction tags without
-- a second migration. Default empty array so reads never need to
-- coalesce.
alter table public.profiles
  add column if not exists frictions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(frictions) = 'array');
