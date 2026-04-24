-- =====================================================================
-- Sprint 2.5 — centralize user timezone
--
-- One function, one source of truth. Every migration from here on
-- (and every RPC/generated column that needs "today in the user's
-- local time") calls public.user_timezone() instead of repeating
-- the IANA literal.
--
-- Existing migrations (initial_schema, mood_checkins, brief_rpcs,
-- extend_brief_context) still contain literals because migrations
-- are append-only by policy. Re-aliasing the literals there would
-- require rewriting generated columns, which is a risky nuclear
-- option for zero functional gain. New tables + future RPCs route
-- through this function.
--
-- When we eventually move timezone into profiles.timezone, the
-- function becomes a lookup over auth.uid() and every call site
-- keeps working.
-- =====================================================================

create or replace function public.user_timezone()
returns text
language sql
immutable
set search_path = public
as $$
  select 'America/Mexico_City'::text
$$;

revoke execute on function public.user_timezone() from public;
grant  execute on function public.user_timezone() to authenticated, anon;
