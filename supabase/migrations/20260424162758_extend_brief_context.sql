-- =====================================================================
-- Sprint 2 — extend get_brief_context
--
-- Three additions the new Home needs:
--   grid_28_days  — the last 28 days' completed flags for the heatmap
--   latest_mood   — today's most-recent mood_checkin, or null
--   day_of_week   — Spanish weekday name for the header
--
-- Signature is preserved (uuid default auth.uid(), date default null)
-- so supabase-js call sites don't change. Security guards stay: null
-- p_user_id ⇒ not authenticated; mismatched p_user_id ⇒ not authorized.
-- =====================================================================

create or replace function public.get_brief_context(
  p_user_id uuid default auth.uid(),
  p_date    date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today                date  := coalesce(p_date, (now() at time zone 'America/Mexico_City')::date);
  v_streak               int;
  v_today_workout        boolean;
  v_latest_measurement   jsonb;
  v_measurement_30d_ago  jsonb;
  v_grid                 jsonb;
  v_latest_mood          jsonb;
  v_day_name             text;
begin
  if p_user_id is null then
    raise exception 'get_brief_context: not authenticated';
  end if;
  if p_user_id <> auth.uid() then
    raise exception 'get_brief_context: p_user_id must match auth.uid()';
  end if;

  v_streak := public.get_current_streak(p_user_id);

  select exists (
    select 1 from public.workouts
    where user_id = p_user_id and workout_date = v_today
  ) into v_today_workout;

  select to_jsonb(m) into v_latest_measurement
  from public.body_measurements m
  where user_id = p_user_id
  order by measured_at desc
  limit 1;

  select to_jsonb(m) into v_measurement_30d_ago
  from public.body_measurements m
  where user_id = p_user_id
    and measured_at <= (v_today - interval '25 days')
  order by measured_at desc
  limit 1;

  -- 28-day grid, oldest first, today last. Each element:
  --   { "date": 'YYYY-MM-DD', "completed": bool }
  select jsonb_agg(
    jsonb_build_object(
      'date',      d::date,
      'completed', exists (
        select 1 from public.workouts
        where user_id = p_user_id and workout_date = d::date
      )
    ) order by d
  ) into v_grid
  from generate_series(v_today - interval '27 days', v_today, interval '1 day') d;

  -- Today's most-recent mood, if any.
  select to_jsonb(m) into v_latest_mood
  from public.mood_checkins m
  where user_id = p_user_id
    and checkin_date = v_today
  order by checked_at desc
  limit 1;

  -- Spanish weekday. Postgres dow: 0=Sunday .. 6=Saturday.
  v_day_name := case extract(dow from v_today)
    when 0 then 'Domingo'
    when 1 then 'Lunes'
    when 2 then 'Martes'
    when 3 then 'Miércoles'
    when 4 then 'Jueves'
    when 5 then 'Viernes'
    when 6 then 'Sábado'
  end;

  return jsonb_build_object(
    'date',                    v_today,
    'day_of_week',             v_day_name,
    'streak_days',             v_streak,
    'today_workout_completed', v_today_workout,
    'latest_measurement',      v_latest_measurement,
    'measurement_30d_ago',     v_measurement_30d_ago,
    'grid_28_days',            v_grid,
    'latest_mood',             v_latest_mood
  );
end;
$$;

-- create or replace preserves existing grants, but re-apply for clarity.
revoke execute on function public.get_brief_context(uuid, date) from public;
grant  execute on function public.get_brief_context(uuid, date) to authenticated;
