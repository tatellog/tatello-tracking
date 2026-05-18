-- =====================================================================
-- 2026-05-18 — daily_signals view: the órbita engine's single surface
--
-- One row per (user_id, local day) that carries at least one signal,
-- with every órbita LEFT-joined in. This is what the órbita engine
-- queries — instead of re-implementing eight per-table aggregations.
--
-- TIMEZONE — read this. The local day of every signal is derived from
-- the RAW timestamp via profiles.timezone, NOT from the legacy
-- *_date generated columns (meal_date / workout_date / checkin_date),
-- which baked the 'America/Mexico_City' literal and are wrong for any
-- user outside that zone (see 20260518120001). The fase-2 tables
-- (sleep_logs, wellbeing_checkins, water_intake, cycle_events) already
-- carry a correct client-passed local date, so those are used as-is.
-- Net result: this view is correct for every user regardless of the
-- legacy debt underneath it.
--
-- SECURITY — created WITH (security_invoker = true) so the underlying
-- tables' RLS runs as the QUERYING user. Without it the view would run
-- as its owner and bypass RLS, exposing every user's data. With it,
-- each user sees only their own rows; no explicit user_id filter is
-- needed because RLS already does it.
-- =====================================================================

create view public.daily_signals
with (security_invoker = true)
as
with sleep_d as (
  select user_id, sleep_date as day, duration_minutes, quality
  from public.sleep_logs
),
wellbeing_d as (
  -- Multiple check-ins per day collapse to the day's average per axis.
  select user_id, checkin_date as day,
         avg(energy)::numeric(3, 1)     as energy,
         avg(motivation)::numeric(3, 1) as motivation,
         avg(stress)::numeric(3, 1)     as stress,
         count(*)                        as wellbeing_checkins
  from public.wellbeing_checkins
  group by user_id, checkin_date
),
mood_d as (
  -- The day's latest mood bucket; local day derived via the timezone.
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
  -- Weekly cadence — the day's latest weight reading, if any.
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
  -- A day is "on period" if it lies within [period_start, period_end].
  -- period_end is the earliest end on/after the start; an open period
  -- (no end logged yet) marks only its start day.
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
    generate_series(s.event_date, coalesce(pe.end_date, s.event_date), interval '1 day') gs
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

-- Anon cannot read; authenticated users get their own rows via the
-- security_invoker RLS pass-through above.
revoke all on public.daily_signals from anon;
grant select on public.daily_signals to authenticated;
