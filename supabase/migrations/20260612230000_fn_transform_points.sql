-- =====================================================================
-- 2026-06-12 — fn_transform_points: puntos del Emblema Celeste
--
-- El emblema (transformación personal) se revela con la SUMA de hábitos
-- acumulados desde el día 1 — persistente, nunca se reinicia (a
-- diferencia de la constelación natal, que es mensual y solo Entrené).
-- RETROACTIVO por diseño: deriva el total del historial completo en
-- daily_signals, así el cliente nunca acumula contadores propios (sin
-- drift, sin doble conteo, idempotente).
--
-- Pesos por día (cada fuente cuenta UNA vez por día, máx. 30/día):
--   entrené +10 · primera comida +3 · meta proteína +6 · sueño +4 ·
--   agua completa +3 · energía +2 · check-in +2
-- El total son puntos INTERNOS: la usuaria jamás ve el número; el
-- cliente lo mapea a etapas visuales (features/emblem/logic.ts).
--
-- Límites conocidos (aceptados para V1):
--   · La meta de proteína usa el target ACTUAL (macro_targets no
--     versiona historia) — retroactivo con la vara de hoy.
--   · La meta de agua vive en AsyncStorage del cliente, no en DB →
--     se pasa como parámetro (default 8 vasos = 2 L).
--
-- SEGURIDAD — security invoker + daily_signals es security_invoker:
-- el RLS de las tablas subyacentes corre como la usuaria que consulta.
-- El filtro auth.uid() es explícito además, para acotar el plan.
--
-- Revertir: drop function public.fn_transform_points(int);
-- =====================================================================

create or replace function public.fn_transform_points(p_water_goal_glasses int default 8)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(
      (case when ds.trained then 10 else 0 end)
    + (case when coalesce(ds.meal_count, 0) >= 1 then 3 else 0 end)
    + (case when mt.protein_g is not null
             and coalesce(ds.protein_g, 0) >= mt.protein_g then 6 else 0 end)
    + (case when ds.sleep_minutes is not null then 4 else 0 end)
    + (case when coalesce(ds.water_glasses, 0) >= greatest(1, p_water_goal_glasses)
            then 3 else 0 end)
    + (case when ds.energy is not null then 2 else 0 end)
    + (case when coalesce(ds.wellbeing_checkins, 0) >= 1 then 2 else 0 end)
  ), 0)::int
  from public.daily_signals ds
  left join public.macro_targets mt on mt.user_id = ds.user_id
  where ds.user_id = auth.uid()
$$;

revoke all on function public.fn_transform_points(int) from anon;
grant execute on function public.fn_transform_points(int) to authenticated;
