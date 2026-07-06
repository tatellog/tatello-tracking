-- =====================================================================
-- 2026-07-01 — bugfix: desempate de latest_mood en get_brief_context
--
-- `latest_mood` se elegía con `order by checked_at desc limit 1`, SIN
-- desempate. Cuando la usuaria cambia de ánimo varias veces el mismo día y
-- las filas comparten `checked_at` (p. ej. registros de un día pasado anclados
-- al mediodía, o filas antiguas creadas antes del fix de cliente), el empate se
-- rompía de forma arbitraria y el brief devolvía el ánimo VIEJO. Como Brillo
-- (Tu universo hoy) ahora deriva del ánimo, esto dejaba Brillo clavado en el
-- primer ánimo del día aunque el slider mostrara otro.
--
-- Fix: `order by checked_at desc, created_at desc` → ante empate de checked_at
-- gana la fila insertada más recientemente (created_at). La tabla es
-- append-only, así que created_at ES el orden real de registro.
--
-- Redefinición de función pura (firma, guards, grants y payload idénticos);
-- solo cambia el ORDER BY del SELECT de v_latest_mood. Sin cambios de schema.
-- Revertir: re-aplicar 20260424230633 (order by checked_at desc).
-- =====================================================================

create or replace function public.get_brief_context(
  p_user_id uuid default auth.uid(),
  p_date    date default null
)
returns jsonb
language plpgsql
-- SECURITY DEFINER porque: agrega tablas de la usuaria (mood_checkins, workouts,
-- body_measurements, meals, macro_targets) en un solo payload con search_path
-- fijo; los guards de auth.uid() garantizan que solo lee lo propio.
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

  -- Desempate por created_at: ante checked_at igual, gana la fila registrada
  -- más recientemente (la tabla es append-only). Sin esto, cambiar de ánimo el
  -- mismo día podía devolver el ánimo viejo.
  select to_jsonb(m) into v_latest_mood
  from public.mood_checkins m
  where user_id = p_user_id
    and checkin_date = v_today
  order by checked_at desc, created_at desc
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
