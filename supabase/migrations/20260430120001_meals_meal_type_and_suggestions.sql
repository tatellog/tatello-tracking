-- =====================================================================
-- Sprint Foundation — meal_type column + suggestions RPC
--
-- Bloque 4 redesigns the log-meal screen around a sugestor that
-- proposes "Lo de ayer" + recent meals matching the current meal
-- type (breakfast / lunch / dinner / snack). The suggestor needs:
--   1. A meal_type column to filter by.
--   2. A get_meal_suggestions RPC the client calls with the current
--      slot.
--
-- Existing rows get meal_type inferred from consumed_at hour so the
-- seed and any historical entries surface in suggestions immediately.
-- =====================================================================

-- 1. Column. Nullable on add so the inference UPDATE can fill it
--    before we tighten the constraint.
alter table public.meals add column if not exists meal_type text;

-- 2. Backfill from local hour-of-day. The buckets match the client's
--    inferMealType helper so server suggestions and client copy stay
--    in sync.
update public.meals
   set meal_type = case
     when extract(hour from (consumed_at at time zone 'America/Mexico_City')) between 5 and 10
       then 'breakfast'
     when extract(hour from (consumed_at at time zone 'America/Mexico_City')) between 11 and 15
       then 'lunch'
     when extract(hour from (consumed_at at time zone 'America/Mexico_City')) between 16 and 20
       then 'dinner'
     else 'snack'
   end
 where meal_type is null;

-- 3. Lock down the values + require it on every new row.
alter table public.meals
  alter column meal_type set not null,
  add constraint meals_meal_type_check
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack'));

-- 4. Index for the suggestion RPC's (user_id, meal_type, consumed_at)
--    walk. Without it the planner falls back to a sort of the whole
--    user partition, which gets slow once the user has months of
--    history.
create index if not exists meals_user_type_consumed_idx
  on public.meals (user_id, meal_type, consumed_at desc);

-- 5. Suggestions RPC. Returns up to p_limit rows for the requested
--    meal_type ordered by relevance: yesterday's exact entry first,
--    then distinct-by-name recent entries from the last 14 days.
--    Excludes today's already-logged meals so we don't suggest
--    something the user just added.
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
      select id, source, name, protein_g, calories, rank as ord
        from yesterday_meal
       union all
      select id, source, name, protein_g, calories,
             1000000 - dense_rank() over (order by rank_seed desc) as ord
        from recent_meals
    ) sub
   order by sub.ord
   limit p_limit;
end;
$$;

grant execute on function public.get_meal_suggestions(text, int) to authenticated;
