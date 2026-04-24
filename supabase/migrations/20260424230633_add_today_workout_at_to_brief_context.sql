-- =====================================================================
-- Sprint 2 — add today_workout_at to brief context
--
-- The WorkoutCheckinBar's 'completed' state renders the exact time the
-- workout was marked ('Día sellado · 14:23'). To get that without a
-- separate round-trip, extend get_brief_context so it returns the
-- completed_at of today's workout row (or null when unmarked) alongside
-- the existing today_workout_completed boolean.
--
-- Signature, auth guards, and execute grants unchanged — this is a
-- field-only addition to the jsonb payload.
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
  v_today                date  := coalesce(
    p_date,
    (now() at time zone public.user_timezone())::date
  );
  v_streak               int;
  v_today_workout        boolean;
  v_today_workout_at     timestamptz;
  v_latest_measurement   jsonb;
  v_measurement_30d_ago  jsonb;
  v_grid                 jsonb;
  v_latest_mood          jsonb;
  v_day_name             text;
  v_targets              jsonb;
  v_today_macros         jsonb;
  v_meal_count           int;
begin
  if p_user_id is null then
    raise exception 'get_brief_context: not authenticated';
  end if;
  if p_user_id <> auth.uid() then
    raise exception 'get_brief_context: p_user_id must match auth.uid()';
  end if;

  v_streak := public.get_current_streak(p_user_id);

  -- Fetch both the exists-flag and the most recent completed_at for
  -- today's workout in a single subquery path. Null when unmarked.
  select
    (w.id is not null),
    w.completed_at
  into v_today_workout, v_today_workout_at
  from (
    select id, completed_at
    from public.workouts
    where user_id = p_user_id and workout_date = v_today
    order by completed_at desc
    limit 1
  ) w;
  -- If no row returned, the SELECT leaves both vars null → coerce
  -- the boolean to false for downstream consumers.
  v_today_workout := coalesce(v_today_workout, false);

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

  select to_jsonb(m) into v_latest_mood
  from public.mood_checkins m
  where user_id = p_user_id
    and checkin_date = v_today
  order by checked_at desc
  limit 1;

  v_day_name := case extract(dow from v_today)
    when 0 then 'Domingo'
    when 1 then 'Lunes'
    when 2 then 'Martes'
    when 3 then 'Miércoles'
    when 4 then 'Jueves'
    when 5 then 'Viernes'
    when 6 then 'Sábado'
  end;

  select to_jsonb(t) into v_targets
  from public.macro_targets t
  where t.user_id = p_user_id;

  select jsonb_build_object(
    'protein_g', coalesce(sum(protein_g), 0),
    'calories',  coalesce(sum(calories), 0)
  ) into v_today_macros
  from public.meals
  where user_id = p_user_id and meal_date = v_today;

  select count(*) into v_meal_count
  from public.meals
  where user_id = p_user_id and meal_date = v_today;

  return jsonb_build_object(
    'date',                    v_today,
    'day_of_week',             v_day_name,
    'streak_days',             v_streak,
    'today_workout_completed', v_today_workout,
    'today_workout_at',        v_today_workout_at,
    'latest_measurement',      v_latest_measurement,
    'measurement_30d_ago',     v_measurement_30d_ago,
    'grid_28_days',            v_grid,
    'latest_mood',             v_latest_mood,
    'targets',                 v_targets,
    'today_macros',            v_today_macros,
    'meal_count_today',        v_meal_count
  );
end;
$$;

revoke execute on function public.get_brief_context(uuid, date) from public;
grant  execute on function public.get_brief_context(uuid, date) to authenticated;
