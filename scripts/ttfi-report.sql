-- =====================================================================
-- Reporte TTFI + Insights Opened per Week (roadmap V-04)
--
-- Las dos métricas norte de docs/product-vision-roadmap.md, calculables
-- con una query por usuaria. Correr en el SQL Editor de Supabase (o psql
-- con service role): leen eventos de TODAS las usuarias, así que RLS no
-- aplica desde el editor del dashboard.
--
-- Fuentes:
--   · analytics_events — insight_shown / insight_opened (lib/analytics.ts;
--     OJO: track() solo emite si profiles.is_beta = true — para validar
--     con la cuenta dev hay que ponerle is_beta).
--   · revelations (tier='pattern') — proxy del tier "primer patrón".
--   · weekly_readings.opened_at — tasa de apertura de la Lectura Semanal.
--
-- GAPS conocidos (deuda de V-04, anotada también en el roadmap):
--   1. El tier "patrón" aún NO emite insight_shown (la ceremonia no
--      trackea); se aproxima con revelations.shown_at, que hoy solo se
--      escribe con PATTERN_MEMORY_ENABLED + gate dev.
--   2. meal_logged solo lleva {hour}; falta {method} para el embudo por
--      método (el criterio "método dominante a la semana 2"). Hoy solo
--      quick_add_pressed distingue photo/text.
--
-- Semanas en hora local de la cohorte (America/Mexico_City), lunes a
-- domingo (isodow) — igual que la Lectura Semanal.
-- =====================================================================


-- ── 1 · TTFI por tier y usuaria ──────────────────────────────────────
-- t0 = fin de onboarding (fallback: primer app_opened). Metas por tier:
-- reflexión < 48 h · patrón < 14 d · gasto real < 28 d.

with beta as (
  select
    p.id as user_id,
    coalesce(p.display_name, left(p.id::text, 8)) as usuaria,
    coalesce(p.onboarding_completed_at, fo.first_open) as t0
  from profiles p
  left join lateral (
    select min(e.created_at) as first_open
    from analytics_events e
    where e.user_id = p.id and e.event_name = 'app_opened'
  ) fo on true
  where p.is_beta = true
),
t1 as (  -- primera reflexión con dato real (micro_reading / early_reading)
  select user_id, min(created_at) as at
  from analytics_events
  where event_name = 'insight_shown' and metadata->>'tier' = 'reflexion'
  group by user_id
),
t2 as (  -- primer patrón · PROVISIONAL vía revelations (ver gap 1)
  select user_id, min(shown_at) as at
  from revelations
  where tier = 'pattern'
  group by user_id
),
t3 as (  -- primera lectura de gasto real (Lectura Semanal grado completa)
  select user_id, min(created_at) as at
  from analytics_events
  where event_name = 'insight_shown'
    and metadata->>'source' = 'weekly_reading'
    and metadata->>'tier' = 'completa'
  group by user_id
)
select
  b.usuaria,
  b.t0::date                                                as inicio,
  round(extract(epoch from (t1.at - b.t0)) / 3600, 1)       as horas_a_reflexion,
  (t1.at - b.t0 < interval '48 hours')                      as reflexion_en_meta,
  round(extract(epoch from (t2.at - b.t0)) / 86400, 1)      as dias_a_patron,
  (t2.at - b.t0 < interval '14 days')                       as patron_en_meta,
  round(extract(epoch from (t3.at - b.t0)) / 86400, 1)      as dias_a_gasto_real,
  (t3.at - b.t0 < interval '28 days')                       as gasto_en_meta
from beta b
left join t1 on t1.user_id = b.user_id
left join t2 on t2.user_id = b.user_id
left join t3 on t3.user_id = b.user_id
order by b.t0;
-- null en una columna = ese tier aún no le llegó (dato honesto, no 0).


-- ── 2 · Insights Opened per Week (LA métrica reportable) ─────────────
-- Cuántos insights ABRIÓ cada usuaria por semana, y de qué fuente.

select
  coalesce(p.display_name, left(p.id::text, 8))               as usuaria,
  date_trunc('week', e.created_at
             at time zone 'America/Mexico_City')::date        as semana,
  count(*)                                                    as abiertos,
  count(*) filter (where e.metadata->>'source' = 'weekly_reading') as lectura_semanal,
  count(*) filter (where e.metadata->>'source' = 'day_reading')    as lectura_dia,
  count(*) filter (where e.metadata->>'source' = 'meal_reveal')    as post_registro
from analytics_events e
join profiles p on p.id = e.user_id and p.is_beta = true
where e.event_name = 'insight_opened'
group by 1, 2
order by 2 desc, 1;


-- ── 3 · Tasa de apertura de la Lectura Semanal (criterio V-06 ≥ 60%) ──
-- Directo de la tabla (no depende de analytics): emitidas vs abiertas.

select
  week_start                                                  as semana,
  count(*)                                                    as emitidas,
  count(opened_at)                                            as abiertas,
  round(100.0 * count(opened_at) / count(*), 0)               as pct_abiertas
from weekly_readings
group by week_start
order by week_start desc;


-- ── 4 · Combustible · comidas por usuaria-día y embudo por método ────
-- Diagnóstico, no norte. La segmentación real por método de meal_logged
-- está pendiente de instrumentar (gap 2); mientras, quick_add_pressed da
-- la intención de método en ✦.

select
  coalesce(p.display_name, left(p.id::text, 8))               as usuaria,
  date_trunc('week', e.created_at
             at time zone 'America/Mexico_City')::date        as semana,
  count(*) filter (where e.event_name = 'meal_logged')        as comidas,
  round(count(*) filter (where e.event_name = 'meal_logged') / 7.0, 1)
                                                              as comidas_por_dia,
  count(*) filter (where e.event_name = 'quick_add_pressed'
                     and e.metadata->>'method' = 'photo')     as quicklog_foto,
  count(*) filter (where e.event_name = 'quick_add_pressed'
                     and e.metadata->>'method' = 'text')      as quicklog_texto
from analytics_events e
join profiles p on p.id = e.user_id and p.is_beta = true
where e.event_name in ('meal_logged', 'quick_add_pressed')
group by 1, 2
order by 2 desc, 1;
