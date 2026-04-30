-- =====================================================================
-- Sprint 2.6 — extend profiles for onboarding wizard
--
-- Adds the 5 imprescindibles captured by the onboarding wizard
-- (date_of_birth, biological_sex, height_cm) plus two timestamps the
-- Home uses to decide if the user is in the "Día 1" ceremony state:
--   * onboarding_completed_at — set when the user finishes the wizard
--   * first_workout_at        — set automatically by trigger on the
--                               first row inserted into workouts
-- weight_kg deliberately does NOT go on profiles. The wizard inserts a
-- body_measurements row instead so the historical series starts at
-- day 1 (see Sprint 2.6, Bloque C.6).
-- =====================================================================

alter table public.profiles
  add column if not exists date_of_birth          date,
  add column if not exists biological_sex         text,
  add column if not exists height_cm              int,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists first_workout_at        timestamptz;

-- Constraints separated from the column adds so re-running the
-- migration on a partially-applied database doesn't fail with
-- "constraint already exists".
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_biological_sex_check'
  ) then
    alter table public.profiles
      add constraint profiles_biological_sex_check
      check (biological_sex is null or biological_sex in ('female', 'male'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_height_cm_check'
  ) then
    alter table public.profiles
      add constraint profiles_height_cm_check
      check (height_cm is null or (height_cm > 50 and height_cm < 250));
  end if;
end $$;

-- Set first_workout_at the very first time a user logs a workout.
-- security definer so the update bypasses RLS (the trigger fires from
-- inside the workouts insert path, and the inserted row already passed
-- the RLS check). search_path pinned for the same reason as
-- handle_new_user — avoid being hijacked by a malicious shadow.
create or replace function public.set_first_workout_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set first_workout_at = new.completed_at
   where id = new.user_id
     and first_workout_at is null;
  return new;
end;
$$;

drop trigger if exists trg_set_first_workout_at on public.workouts;
create trigger trg_set_first_workout_at
  after insert on public.workouts
  for each row
  execute function public.set_first_workout_at();
