-- =====================================================================
-- 2026-06-18 — fix: on_period para periodos ABIERTOS (bugfix)
--
-- Bug: la app solo registra `period_start` (nunca `period_end`), así que
-- todo periodo queda "abierto". La definición anterior de daily_signals
-- marcaba un periodo abierto SOLO en su día de inicio
-- (coalesce(pe.end_date, s.event_date) → generate_series(start, start)),
-- por lo que `on_period` era true únicamente el día 1. Resultado: Órbita
-- decía "Fuera del periodo" desde el día 2, contradiciendo a Hoy (que usa
-- la fase: días 1–5 = menstrual = "Tu período").
--
-- Fix: un periodo abierto asume la VENTANA MENSTRUAL ESTÁNDAR de 5 días
-- (start .. start+4), igual que phaseForDay()/phaseBounds() en el cliente
-- (menstrual = días 1..5). Si algún día se registra un `period_end`, ese
-- sigue mandando (override). Solo cambia el CTE `period_d`; columnas,
-- security_invoker y grants quedan idénticos.
--
-- Revertir: re-aplicar 20260518120005 (coalesce(pe.end_date, s.event_date)).
-- =====================================================================

create or replace view public.daily_signals
with (security_invoker = true)
as
with sleep_d as (
  select user_id, sleep_date as day, duration_minutes, quality
  from public.sleep_logs
),
wellbeing_d as (
  select user_id, checkin_date as day,
         avg(energy)::numeric(3, 1)     as energy,
         avg(motivation)::numeric(3, 1) as motivation,
         avg(stress)::numeric(3, 1)     as stress,
         count(*)                        as wellbeing_checkins
  from public.wellbeing_checkins
  group by user_id, checkin_date
),
mood_d as (
  select distinct on (m.user_id, (m.checked_at at time zone p.timezone)::date)
         m.user_id,
         (m.checked_at at time zone p.timezone)::date as day,
         m.value                                       as mood
  from public.mood_checkins m
  join public.profiles p on p.id = m.user_id
  order by m.user_id, (m.checked_at at time zone p.timezone)::date, m.checked_at desc
),
meals_d as (
  select m.user_id,
         (m.consumed_at at time zone p.timezone)::date as day,
         sum(m.protein_g)::numeric(7, 1) as protein_g,
         sum(m.calories)::int             as calories,
         count(*)                          as meal_count
  from public.meals m
  join public.profiles p on p.id = m.user_id
  group by m.user_id, (m.consumed_at at time zone p.timezone)::date
),
workouts_d as (
  select w.user_id,
         (w.completed_at at time zone p.timezone)::date as day,
         true        as trained,
         max(w.type) as workout_type
  from public.workouts w
  join public.profiles p on p.id = w.user_id
  group by w.user_id, (w.completed_at at time zone p.timezone)::date
),
body_d as (
  select distinct on (b.user_id, (b.measured_at at time zone p.timezone)::date)
         b.user_id,
         (b.measured_at at time zone p.timezone)::date as day,
         b.weight_kg
  from public.body_measurements b
  join public.profiles p on p.id = b.user_id
  order by b.user_id, (b.measured_at at time zone p.timezone)::date, b.measured_at desc
),
water_d as (
  select user_id, intake_date as day, glasses
  from public.water_intake
),
rest_d as (
  select user_id, rest_date as day, true as rested
  from public.rest_days
),
period_d as (
  -- "On period" = el día cae en [period_start, period_end]. period_end es
  -- el fin más temprano en/después del inicio; un periodo ABIERTO (sin fin
  -- registrado) asume la ventana menstrual estándar de 5 días (start..start+4),
  -- igual que phaseForDay() en el cliente (menstrual = días 1..5).
  select s.user_id, gs::date as day
  from public.cycle_events s
  join lateral (
    select min(e.event_date) as end_date
    from public.cycle_events e
    where e.user_id = s.user_id
      and e.event_type = 'period_end'
      and e.event_date >= s.event_date
  ) pe on true
  cross join lateral
    generate_series(
      s.event_date,
      coalesce(pe.end_date, s.event_date + interval '4 days'),
      interval '1 day'
    ) gs
  where s.event_type = 'period_start'
),
days as (
  select user_id, day from sleep_d
  union select user_id, day from wellbeing_d
  union select user_id, day from mood_d
  union select user_id, day from meals_d
  union select user_id, day from workouts_d
  union select user_id, day from body_d
  union select user_id, day from water_d
  union select user_id, day from rest_d
  union select user_id, day from period_d
)
select
  d.user_id,
  d.day,
  s.duration_minutes          as sleep_minutes,
  s.quality                   as sleep_quality,
  w.energy,
  w.motivation,
  w.stress,
  w.wellbeing_checkins,
  mo.mood,
  me.protein_g,
  me.calories,
  me.meal_count,
  coalesce(wo.trained, false) as trained,
  wo.workout_type,
  bo.weight_kg,
  wa.glasses                  as water_glasses,
  coalesce(r.rested, false)   as rested,
  (pe.day is not null)        as on_period
from days d
left join sleep_d     s  on s.user_id  = d.user_id and s.day  = d.day
left join wellbeing_d w  on w.user_id  = d.user_id and w.day  = d.day
left join mood_d      mo on mo.user_id = d.user_id and mo.day = d.day
left join meals_d     me on me.user_id = d.user_id and me.day = d.day
left join workouts_d  wo on wo.user_id = d.user_id and wo.day = d.day
left join body_d      bo on bo.user_id = d.user_id and bo.day = d.day
left join water_d     wa on wa.user_id = d.user_id and wa.day = d.day
left join rest_d      r  on r.user_id  = d.user_id and r.day  = d.day
left join period_d    pe on pe.user_id = d.user_id and pe.day = d.day;

revoke all on public.daily_signals from anon;
grant select on public.daily_signals to authenticated;
