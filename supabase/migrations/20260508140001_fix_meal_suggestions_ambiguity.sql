-- =====================================================================
-- 2026-05-08 — fix `column reference "id" is ambiguous` in
-- get_meal_suggestions
--
-- The original migration (20260430120001) declared OUT params named
-- id / source / name / protein_g / calories via `RETURNS TABLE`.
-- Inside the body, the inline UNION subquery referenced those names
-- without qualifying them with a CTE alias, so PostgreSQL couldn't
-- decide whether `id` meant the OUT parameter or the column from
-- yesterday_meal / recent_meals — and rejected the call with code
-- 42702. Effect: every authenticated `rpc('get_meal_suggestions')`
-- call returned an error, the client swallowed it and rendered the
-- empty-state welcome card forever, regardless of how many meals
-- the user had logged.
--
-- Fix: alias the CTEs in the UNION (y / r) and qualify every
-- column reference. The directive `#variable_conflict use_column`
-- belt-and-suspenders the OUT-param vs. column resolution so any
-- future edits don't regress.
-- =====================================================================

create or replace function public.get_meal_suggestions(
  p_meal_type text,
  p_limit int default 3
)
returns table (
  id uuid,
  source text,
  name text,
  protein_g numeric,
  calories int
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_today_start timestamptz :=
    date_trunc('day', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City';
begin
  return query
  with yesterday_meal as (
    select m.id, 'yesterday'::text as source, m.name, m.protein_g, m.calories,
           1 as rank
      from meals m
     where m.user_id = v_user_id
       and m.meal_type = p_meal_type
       and m.consumed_at >= v_today_start - interval '1 day'
       and m.consumed_at <  v_today_start
     order by m.consumed_at desc
     limit 1
  ),
  recent_meals as (
    select distinct on (m.name)
           m.id, 'recent'::text as source, m.name, m.protein_g, m.calories,
           extract(epoch from m.consumed_at)::int as rank_seed
      from meals m
     where m.user_id = v_user_id
       and m.meal_type = p_meal_type
       and m.consumed_at >= v_today_start - interval '14 days'
       and m.consumed_at <  v_today_start
       and not exists (
         select 1 from yesterday_meal y where y.id = m.id
       )
     order by m.name, m.consumed_at desc
  )
  select sub.id, sub.source, sub.name, sub.protein_g, sub.calories
    from (
      select y.id, y.source, y.name, y.protein_g, y.calories, y.rank as ord
        from yesterday_meal y
       union all
      select r.id, r.source, r.name, r.protein_g, r.calories,
             1000000 - dense_rank() over (order by r.rank_seed desc) as ord
        from recent_meals r
    ) sub
   order by sub.ord
   limit p_limit;
end;
$$;
