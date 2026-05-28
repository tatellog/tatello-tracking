-- =====================================================================
-- 2026-05-27 — RLS smoke-test helper
--
-- A security-definer function that reports RLS status + policy count
-- for every public table. Called by scripts/check-rls.ts (pre-deploy
-- smoke test) so engineers can verify with one command that no table
-- shipped without policies.
--
-- Security definer because `pg_class.relrowsecurity` and
-- `pg_policies` aren't visible to the calling role under PostgREST —
-- the function runs as the owner (postgres) regardless of who calls
-- it. Execute is granted only to service_role; the anon + authenticated
-- roles have no reason to introspect schema-level security.
-- =====================================================================

create or replace function public.check_rls_status()
returns table (
  table_name   text,
  rls_enabled  boolean,
  policy_count int
)
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select
    t.tablename::text,
    c.relrowsecurity,
    (
      select count(*)::int
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename = t.tablename
    )
  from pg_tables t
  join pg_class c
    on c.relname = t.tablename
   and c.relnamespace = 'public'::regnamespace
  where t.schemaname = 'public'
  order by t.tablename;
$$;

revoke all     on function public.check_rls_status() from public;
grant  execute on function public.check_rls_status() to service_role;
