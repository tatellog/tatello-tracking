-- =====================================================================
-- 2026-05-31 — profiles.monthly_focus_secondary
--
-- The intention step (app/onboarding/intention.tsx) is multi-select: the
-- user can pick MORE THAN ONE focus, in order of priority. Until now,
-- only the FIRST pick (selected[0]) was persisted to monthly_focus —
-- secondary picks were held in component state and lost on navigation.
-- A real bug: users select multiple intentions, the UI acknowledges
-- them, and the DB only remembers one. Settings can't show them either.
--
-- This adds `monthly_focus_secondary` — an ORDERED text[] of the picks
-- AFTER the priority. The priority itself stays in `monthly_focus`
-- (single text) so the engine contract (calcMacros etc.) is unchanged.
-- The secondaries are context for the Voz, not engine inputs.
--
-- Why a separate column instead of expanding monthly_focus to an array:
--   • calcMacros and every consumer reads monthly_focus as a single
--     text. Migrating them to read array[0] would touch 6+ files for no
--     behavioural change — the priority IS the single value the engine
--     wants. Keep the engine contract; add context alongside.
--   • Legacy rows already in production carry a single text. No data
--     migration needed — `monthly_focus_secondary` starts NULL for
--     everyone and rows opt-in as they re-touch the screen.
--
-- CHECK constraints mirror app/onboarding/intention.tsx's FOCUS_OPTIONS:
--   1. Every element belongs to the MONTHLY_FOCUS_VALUES enum (same set
--      profiles_monthly_focus_check enforces on the single column).
--   2. Elements are unique within the array (no duplicate picks).
--   3. Array length capped at 7 (the enum has 8 values; one lives in
--      monthly_focus, so secondaries can hold the other 7 max — but in
--      practice the UI offers only 5 cards, so this is a defensive
--      ceiling, not a real expectation).
--
-- The "priority is not duplicated in secondaries" invariant is enforced
-- at the application layer (intention.tsx strips selected[0] before
-- persisting). A trigger could enforce it server-side too, but the
-- single-writer (the wizard) makes app-layer enforcement enough.
--
-- Reversible:
--   alter table public.profiles
--     drop constraint if exists profiles_monthly_focus_secondary_check;
--   alter table public.profiles
--     drop column if exists monthly_focus_secondary;
-- =====================================================================

alter table public.profiles
  add column if not exists monthly_focus_secondary text[];

alter table public.profiles
  drop constraint if exists profiles_monthly_focus_secondary_check;

alter table public.profiles
  add constraint profiles_monthly_focus_secondary_check check (
    monthly_focus_secondary is null
    or (
      -- coalesce because `array_length('{}', 1)` returns NULL in Postgres
      -- (not 0). An empty array is a valid persisted value — it means
      -- "the user picked only one intention, no secondaries" — and must
      -- pass these checks the same as a non-empty one. Without coalesce,
      -- `null <= 7` evaluates to null, and CHECK silently fails for `{}`.
      coalesce(array_length(monthly_focus_secondary, 1), 0) <= 7
      -- Elements must be unique. The scalar subquery is evaluated per
      -- row at insert/update and references only the same row's column,
      -- so it carries the row-scope guarantees CHECK expects (no
      -- cross-row reads, deterministic). `count(distinct)` ignores NULL
      -- elements; the `<@` check below rejects arrays containing NULL
      -- against the literal text[] domain, so duplicate-NULL inputs
      -- can't slip through.
      and coalesce(array_length(monthly_focus_secondary, 1), 0) = (
        select count(distinct e) from unnest(monthly_focus_secondary) as e
      )
      -- Every element must be in the same enum as `monthly_focus` (see
      -- profiles_monthly_focus_check in 20260520120002). If the enum
      -- ever grows, BOTH checks need updating — kept duplicated rather
      -- than abstracted into a function so the constraint reads
      -- standalone in psql `\d`.
      and monthly_focus_secondary <@ array[
        'weight',
        'energy',
        'sleep',
        'food',
        'cycle',
        'patterns',
        'mind',
        'other'
      ]::text[]
    )
  );

comment on column public.profiles.monthly_focus_secondary is
  'Ordered list of additional monthly focuses after the priority (which lives in monthly_focus). Context for the Voz; not read by calcMacros.';
