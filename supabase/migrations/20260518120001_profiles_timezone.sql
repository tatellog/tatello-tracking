-- =====================================================================
-- 2026-05-18 — per-user timezone
--
-- Until now timezone was a single hardcoded literal: public.user_timezone()
-- returns 'America/Mexico_City' for everyone. That is wrong the moment a
-- second user lives in another zone — their "local day" gets computed in
-- Mexico City time, which silently misaligns every day-bucketed query and
-- would poison the cross-signal correlations the órbitas engine depends on.
--
-- This migration adds the real source of truth — profiles.timezone — and
-- a per-user lookup, public.user_tz(uuid), for every RPC and view from
-- here on.
--
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
-- --------------------------------------------
-- It does NOT rewrite public.user_timezone(). That function is IMMUTABLE
-- and is referenced by the meals.meal_date GENERATED column. Postgres
-- forbids a generated column from depending on a non-immutable function,
-- and a per-user lookup (it reads profiles, calls auth.uid()) is STABLE at
-- best. So user_timezone() is frozen as a legacy constant.
--
-- It also does NOT retro-fix workout_date / checkin_date / meal_date.
-- Those STORED generated columns baked the 'America/Mexico_City' literal
-- at write time and cannot be re-derived. They stay as a legacy, MX-time
-- convenience column. The fix lives forward, not backward:
--   * New órbita tables store raw timestamptz only — NO generated local
--     date — and a future daily_signals view derives the local day via
--     user_tz(). The raw timestamps are correct UTC; only the derived
--     date columns were ever wrong.
--   * RPCs that need "today" switch to user_tz() as they are next touched
--     (left untouched here so this migration stays purely additive).
-- =====================================================================

-- ─── profiles.timezone ───────────────────────────────────────────────
-- NOT NULL with the existing literal as default, so every current row
-- (and the handle_new_user signup insert) backfills to the right value
-- for the only user today without a separate backfill statement.
alter table public.profiles
  add column if not exists timezone text not null default 'America/Mexico_City';

-- Validate the IANA name at write time. A CHECK constraint can't query
-- pg_timezone_names (no subqueries allowed in CHECK), so a trigger does
-- it: `now() at time zone NEW.timezone` raises 'time zone "<x>" not
-- recognized' on its own for any bad name — no explicit lookup needed.
create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform now() at time zone new.timezone;
  return new;
end;
$$;

drop trigger if exists trg_validate_profile_timezone on public.profiles;
create trigger trg_validate_profile_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

-- ─── per-user timezone lookup ────────────────────────────────────────
-- The source of truth for every RPC and view from here on. STABLE
-- (it reads a table), so it must NEVER be used in a generated column or
-- index — that is what the frozen, immutable user_timezone() literal is
-- still for. Falls back to the default if the profile row or column is
-- somehow null.
--
-- SECURITY INVOKER (the default): called directly by a user it runs
-- under RLS, so it can only read that user's own profiles row; called
-- from inside a SECURITY DEFINER RPC it inherits that RPC's privileges
-- and can resolve any user_id the RPC already authorized. Either way
-- there is no cross-user timezone leak.
create or replace function public.user_tz(p_user_id uuid default auth.uid())
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    (select timezone from public.profiles where id = p_user_id),
    'America/Mexico_City'
  )
$$;

revoke execute on function public.user_tz(uuid) from public;
grant  execute on function public.user_tz(uuid) to authenticated;
