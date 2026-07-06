-- =====================================================================
-- 2026-06-29 — fn_transform_points: re-pondera el Emblema a EVIDENCIA
--
-- Cambio de FILOSOFÍA (ver docs/orbita-mes-spec.md): la constelación debe
-- crecer por EVIDENCIA acumulada (comportamientos que crean cambio físico),
-- no por DATOS acumulados (haber registrado). Se separan dos sistemas:
--   · TRANSFORMACIÓN (lo que revela el emblema): déficit, proteína,
--     movimiento, sueño de calidad, agua.
--   · PRESENCIA (NO suma puntos de emblema): primera comida, energía
--     subjetiva, check-in. Importa, pero no es progreso físico.
--
-- Pesos por día (cada fuente cuenta UNA vez por día, máx. 31/día):
--   día en déficit +10 · entrené +8 · meta proteína +6 ·
--   sueño ≥ 7 h +4 · agua completa +3
-- El déficit es el OBJETIVO primario de la app → el peso más alto. Sueño
-- pasa de "registrado" a EVIDENCIA de calidad (≥ 7 h = 420 min).
--
-- "Día en déficit" = consumo en [0.6 × meta, meta], misma definición que
-- la experiencia de Día (healthyDeficit) — fuente única. El piso 60% evita
-- premiar restricción extrema (manifiesto). Usa la meta ACTUAL de calorías
-- (macro_targets.calories; no versiona historia → retroactivo con la vara
-- de hoy, igual que la meta de proteína).
--
-- INMUTABILIDAD: el % revelado NUNCA retrocede en cliente — el hook aplica
-- un high-water-mark monótono por usuaria (transformProgressForPoints /
-- features/emblem/hooks.ts). Aunque el re-pesado baje los puntos crudos de
-- alguien, su reveal no retrocede. Espejo de pesos en
-- features/emblem/logic.ts (TRANSFORM_WEIGHTS) — si cambias uno, cambia el otro.
--
-- SEGURIDAD — security invoker (el RLS de las tablas subyacentes corre como
-- la usuaria que consulta) + filtro auth.uid() explícito. Sin cambios de
-- firma → no hace falta regenerar types.
--
-- Revertir: restaurar las definiciones previas (migraciones
-- 20260612230000_fn_transform_points.sql y
-- 20260617230742_fn_transform_points_as_of.sql).
-- =====================================================================

create or replace function public.fn_transform_points(p_water_goal_glasses int default 8)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(
      (case when mt.calories is not null
             and ds.calories is not null and ds.calories > 0
             and ds.calories <= mt.calories
             and ds.calories >= 0.6 * mt.calories then 10 else 0 end)
    + (case when ds.trained then 8 else 0 end)
    + (case when mt.protein_g is not null
             and coalesce(ds.protein_g, 0) >= mt.protein_g then 6 else 0 end)
    + (case when coalesce(ds.sleep_minutes, 0) >= 420 then 4 else 0 end)
    + (case when coalesce(ds.water_glasses, 0) >= greatest(1, p_water_goal_glasses)
            then 3 else 0 end)
  ), 0)::int
  from public.daily_signals ds
  left join public.macro_targets mt on mt.user_id = ds.user_id
  where ds.user_id = auth.uid()
$$;

revoke all on function public.fn_transform_points(int) from anon;
grant execute on function public.fn_transform_points(int) to authenticated;

-- Variante a FECHA DE CORTE (card "Tu Historia" del Tab Progreso): mismos
-- pesos, misma forma, más el filtro ds.day <= p_as_of. Re-pesada en lockstep.
create or replace function public.fn_transform_points_as_of(
  p_as_of date,
  p_water_goal_glasses int default 8
)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(
      (case when mt.calories is not null
             and ds.calories is not null and ds.calories > 0
             and ds.calories <= mt.calories
             and ds.calories >= 0.6 * mt.calories then 10 else 0 end)
    + (case when ds.trained then 8 else 0 end)
    + (case when mt.protein_g is not null
             and coalesce(ds.protein_g, 0) >= mt.protein_g then 6 else 0 end)
    + (case when coalesce(ds.sleep_minutes, 0) >= 420 then 4 else 0 end)
    + (case when coalesce(ds.water_glasses, 0) >= greatest(1, p_water_goal_glasses)
            then 3 else 0 end)
  ), 0)::int
  from public.daily_signals ds
  left join public.macro_targets mt on mt.user_id = ds.user_id
  where ds.user_id = auth.uid()
    and ds.day <= p_as_of
$$;

revoke all on function public.fn_transform_points_as_of(date, int) from anon;
grant execute on function public.fn_transform_points_as_of(date, int) to authenticated;
