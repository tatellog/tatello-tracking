-- =====================================================================
-- Sprint 2.6 — backfill profiles.first_workout_at
--
-- The set_first_workout_at trigger added in
-- 20260429120001_extend_profiles_onboarding.sql only fires on workout
-- INSERTs. Users who already had workouts at the time of that
-- migration kept first_workout_at = null, which puts the app into a
-- ghost "Día 1" mode while the streak grid still shows their 14-day
-- history (the brief reads workouts directly).
--
-- This one-shot backfill closes the gap: every profile whose user
-- has at least one workout gets first_workout_at = the oldest
-- workout's completed_at. Idempotent — re-running is a no-op
-- because the WHERE clause filters on first_workout_at IS NULL.
-- =====================================================================

update public.profiles p
   set first_workout_at = w.first_completed_at
  from (
    select user_id, min(completed_at) as first_completed_at
      from public.workouts
     group by user_id
  ) w
 where p.id = w.user_id
   and p.first_workout_at is null;
