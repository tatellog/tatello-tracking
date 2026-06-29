-- 2026-06-17 — fn_transform_points_as_of: puntos del Emblema a una FECHA DE CORTE
--
-- Variante de fn_transform_points (20260612230000) que suma SOLO los días-hábito
-- hasta `p_as_of` (inclusive). Alimenta la card "Tu Historia" del Tab Progreso:
-- el "antes" del % de constelación = puntos acumulados hasta hace 30 días.
--
-- Mismos pesos, misma forma y misma seguridad que la base; lo único nuevo es el
-- filtro `ds.day <= p_as_of`. Límite heredado: la meta de proteína usa el target
-- ACTUAL (macro_targets no versiona historia) — retroactivo con la vara de hoy.
--
-- SEGURIDAD — security invoker (RLS de las tablas subyacentes corre como la
-- usuaria) + filtro auth.uid() explícito, idéntico a la función base.
--
-- Revertir: drop function public.fn_transform_points_as_of(date, int);
-- =====================================================================

drop function if exists public.fn_transform_points_as_of(date, int);

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
    and ds.day <= p_as_of
$$;

revoke all on function public.fn_transform_points_as_of(date, int) from anon;
grant execute on function public.fn_transform_points_as_of(date, int) to authenticated;
