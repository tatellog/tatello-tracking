-- =====================================================================
-- 2026-09-25 — Registro cero (spec wearables §9): agua del reloj + pasos
--
-- 1) Tabla cruda `wearable_water`: agua bebida por día (mL) que Salud trae
--    de apps de hidratación o Garmin Connect. Misma identidad que
--    wearable_steps (user, source, día) → upsert idempotente. RLS estricta.
-- 2) daily_signals:
--    · water_glasses = COALESCE(manual, round(reloj_ml / 250))  → manual
--      gana, el reloj rellena (250 ml = GLASS_ML de features/water).
--    · columnas nuevas AL FINAL: water_source ('manual'|'wearable'|null)
--      y steps (agregado diario de wearable_steps, antes ingest-only).
--    Cero cambios en tipo/orden de las columnas existentes.
--
-- OJO security_invoker: se declara en el CREATE y se re-asegura con ALTER
-- al final (root cause del leak entre usuarias de jun 2026).
--
-- Revertir: drop table wearable_water + re-correr 20260922120000.
-- =====================================================================

create table if not exists public.wearable_water (
  id         uuid not null default gen_random_uuid() primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  source     text not null check (source in ('apple_health', 'garmin')),
  day_date   date not null,
  water_ml   integer not null check (water_ml >= 0 and water_ml <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, day_date)
);

alter table public.wearable_water enable row level security;

drop policy if exists "wearable_water_select_own" on public.wearable_water;
create policy "wearable_water_select_own" on public.wearable_water
  for select using (auth.uid() = user_id);
drop policy if exists "wearable_water_insert_own" on public.wearable_water;
create policy "wearable_water_insert_own" on public.wearable_water
  for insert with check (auth.uid() = user_id);
drop policy if exists "wearable_water_update_own" on public.wearable_water;
create policy "wearable_water_update_own" on public.wearable_water
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wearable_water_delete_own" on public.wearable_water;
create policy "wearable_water_delete_own" on public.wearable_water
  for delete using (auth.uid() = user_id);

create index if not exists wearable_water_user_date_idx
  on public.wearable_water (user_id, day_date);

drop trigger if exists set_wearable_water_updated_at on public.wearable_water;
create trigger set_wearable_water_updated_at
  before update on public.wearable_water
  for each row execute function public.set_updated_at();

CREATE OR REPLACE VIEW public.daily_signals
WITH (security_invoker = true) AS
 WITH sleep_d AS (
         SELECT sleep_logs.user_id,
            sleep_logs.sleep_date AS day,
            max(sleep_logs.duration_minutes) AS duration_minutes,
            max(sleep_logs.quality) AS quality
           FROM sleep_logs
          GROUP BY sleep_logs.user_id, sleep_logs.sleep_date
        ), wearable_sleep_d AS (
         SELECT ws.user_id,
            ws.sleep_date AS day,
            max(ws.asleep_minutes) AS asleep_minutes
           FROM wearable_sleep ws
          GROUP BY ws.user_id, ws.sleep_date
        ), wellbeing_d AS (
         SELECT wellbeing_checkins.user_id,
            wellbeing_checkins.checkin_date AS day,
            avg(wellbeing_checkins.energy)::numeric(3,1) AS energy,
            avg(wellbeing_checkins.motivation)::numeric(3,1) AS motivation,
            avg(wellbeing_checkins.stress)::numeric(3,1) AS stress,
            count(*) AS wellbeing_checkins
           FROM wellbeing_checkins
          GROUP BY wellbeing_checkins.user_id, wellbeing_checkins.checkin_date
        ), mood_d AS (
         SELECT DISTINCT ON (m.user_id, ((m.checked_at AT TIME ZONE p.timezone)::date)) m.user_id,
            (m.checked_at AT TIME ZONE p.timezone)::date AS day,
            m.value AS mood
           FROM mood_checkins m
             JOIN profiles p ON p.id = m.user_id
          ORDER BY m.user_id, ((m.checked_at AT TIME ZONE p.timezone)::date), m.checked_at DESC
        ), meals_d AS (
         SELECT m.user_id,
            (m.consumed_at AT TIME ZONE p.timezone)::date AS day,
            sum(m.protein_g)::numeric(7,1) AS protein_g,
            sum(m.calories)::integer AS calories,
            count(*) AS meal_count
           FROM meals m
             JOIN profiles p ON p.id = m.user_id
          GROUP BY m.user_id, ((m.consumed_at AT TIME ZONE p.timezone)::date)
        ), workouts_d AS (
         SELECT w_1.user_id,
            (w_1.completed_at AT TIME ZONE p.timezone)::date AS day,
            true AS trained,
            max(w_1.type) AS workout_type
           FROM workouts w_1
             JOIN profiles p ON p.id = w_1.user_id
          GROUP BY w_1.user_id, ((w_1.completed_at AT TIME ZONE p.timezone)::date)
        ), wearable_workouts_d AS (
         SELECT ww.user_id,
            (ww.ended_at AT TIME ZONE p.timezone)::date AS day,
            true AS trained,
            max(ww.workout_type) AS workout_type,
            sum(ww.energy_kcal)::integer AS workout_kcal,
            sum(ww.duration_min)::integer AS workout_minutes
           FROM wearable_workouts ww
             JOIN profiles p ON p.id = ww.user_id
          GROUP BY ww.user_id, ((ww.ended_at AT TIME ZONE p.timezone)::date)
        ), body_d AS (
         SELECT DISTINCT ON (b.user_id, ((b.measured_at AT TIME ZONE p.timezone)::date)) b.user_id,
            (b.measured_at AT TIME ZONE p.timezone)::date AS day,
            b.weight_kg
           FROM body_measurements b
             JOIN profiles p ON p.id = b.user_id
          ORDER BY b.user_id, ((b.measured_at AT TIME ZONE p.timezone)::date), b.measured_at DESC
        ), water_d AS (
         SELECT water_intake.user_id,
            water_intake.intake_date AS day,
            sum(water_intake.glasses)::integer AS glasses
           FROM water_intake
          GROUP BY water_intake.user_id, water_intake.intake_date
        ), wearable_water_d AS (
         SELECT wwa.user_id,
            wwa.day_date AS day,
            round(max(wwa.water_ml) / 250.0)::integer AS glasses
           FROM wearable_water wwa
          GROUP BY wwa.user_id, wwa.day_date
        ), wearable_steps_d AS (
         SELECT wst.user_id,
            wst.day_date AS day,
            max(wst.steps)::integer AS steps
           FROM wearable_steps wst
          GROUP BY wst.user_id, wst.day_date
        ), rest_d AS (
         SELECT rest_days.user_id,
            rest_days.rest_date AS day,
            true AS rested
           FROM rest_days
          GROUP BY rest_days.user_id, rest_days.rest_date
        ), period_d AS (
         SELECT DISTINCT s_1.user_id,
            gs.gs::date AS day
           FROM cycle_events s_1
             JOIN LATERAL ( SELECT min(e.event_date) AS end_date
                   FROM cycle_events e
                  WHERE e.user_id = s_1.user_id AND e.event_type = 'period_end'::text AND e.event_date >= s_1.event_date) pe_1 ON true
             CROSS JOIN LATERAL generate_series(s_1.event_date::timestamp without time zone, COALESCE(pe_1.end_date::timestamp without time zone, s_1.event_date + '4 days'::interval), '1 day'::interval) gs(gs)
          WHERE s_1.event_type = 'period_start'::text
        ), days AS (
         SELECT sleep_d.user_id, sleep_d.day FROM sleep_d
        UNION
         SELECT wearable_sleep_d.user_id, wearable_sleep_d.day FROM wearable_sleep_d
        UNION
         SELECT wellbeing_d.user_id, wellbeing_d.day FROM wellbeing_d
        UNION
         SELECT mood_d.user_id, mood_d.day FROM mood_d
        UNION
         SELECT meals_d.user_id, meals_d.day FROM meals_d
        UNION
         SELECT workouts_d.user_id, workouts_d.day FROM workouts_d
        UNION
         SELECT wearable_workouts_d.user_id, wearable_workouts_d.day FROM wearable_workouts_d
        UNION
         SELECT body_d.user_id, body_d.day FROM body_d
        UNION
         SELECT water_d.user_id, water_d.day FROM water_d
        UNION
         SELECT wearable_water_d.user_id, wearable_water_d.day FROM wearable_water_d
        UNION
         SELECT wearable_steps_d.user_id, wearable_steps_d.day FROM wearable_steps_d
        UNION
         SELECT rest_d.user_id, rest_d.day FROM rest_d
        UNION
         SELECT period_d.user_id, period_d.day FROM period_d
        )
 SELECT d.user_id,
    d.day,
    COALESCE(s.duration_minutes, wsl.asleep_minutes) AS sleep_minutes,
    s.quality AS sleep_quality,
    w.energy,
    w.motivation,
    w.stress,
    w.wellbeing_checkins,
    mo.mood,
    me.protein_g,
    me.calories,
    me.meal_count,
    COALESCE(wo.trained, ww.trained, false) AS trained,
    COALESCE(wo.workout_type, ww.workout_type) AS workout_type,
    bo.weight_kg,
    COALESCE(wa.glasses, wwa.glasses) AS water_glasses,
    COALESCE(r.rested, false) AS rested,
    pe.day IS NOT NULL AS on_period,
    ww.workout_kcal,
    CASE
        WHEN wo.trained THEN 'manual'
        WHEN ww.trained THEN 'wearable'
        ELSE NULL
    END AS workout_source,
    CASE
        WHEN s.duration_minutes IS NOT NULL THEN 'manual'
        WHEN wsl.asleep_minutes IS NOT NULL THEN 'wearable'
        ELSE NULL
    END AS sleep_source,
    ww.workout_minutes,
    CASE
        WHEN wa.glasses IS NOT NULL THEN 'manual'
        WHEN wwa.glasses IS NOT NULL THEN 'wearable'
        ELSE NULL
    END AS water_source,
    wst.steps
   FROM days d
     LEFT JOIN sleep_d s ON s.user_id = d.user_id AND s.day = d.day
     LEFT JOIN wearable_sleep_d wsl ON wsl.user_id = d.user_id AND wsl.day = d.day
     LEFT JOIN wellbeing_d w ON w.user_id = d.user_id AND w.day = d.day
     LEFT JOIN mood_d mo ON mo.user_id = d.user_id AND mo.day = d.day
     LEFT JOIN meals_d me ON me.user_id = d.user_id AND me.day = d.day
     LEFT JOIN workouts_d wo ON wo.user_id = d.user_id AND wo.day = d.day
     LEFT JOIN wearable_workouts_d ww ON ww.user_id = d.user_id AND ww.day = d.day
     LEFT JOIN body_d bo ON bo.user_id = d.user_id AND bo.day = d.day
     LEFT JOIN water_d wa ON wa.user_id = d.user_id AND wa.day = d.day
     LEFT JOIN wearable_water_d wwa ON wwa.user_id = d.user_id AND wwa.day = d.day
     LEFT JOIN wearable_steps_d wst ON wst.user_id = d.user_id AND wst.day = d.day
     LEFT JOIN rest_d r ON r.user_id = d.user_id AND r.day = d.day
     LEFT JOIN period_d pe ON pe.user_id = d.user_id AND pe.day = d.day;

-- Cinturón y tirantes: aunque el CREATE de arriba ya lo declara, se
-- re-asegura por si una herramienta re-emite la view sin el WITH (el
-- root cause del leak de jun 2026 fue exactamente ese descuido).
ALTER VIEW public.daily_signals SET (security_invoker = on);
