-- Epic 05 · hardening — cap de tamaño en experiments.plan/result (#10 del review).
--
-- `plan` y `result` son jsonb chicos (un puñado de números + enums), pero no
-- tenían tope, a diferencia de findings.payload (CHECK ≤20000). Se agrega el
-- límite por consistencia y para no aceptar basura arbitraria vía la edge.
--
-- ADITIVA y no destructiva (no hay filas en producción aún). CHECK-only, sin
-- tocar RLS. Revertir:
--   alter table public.experiments drop constraint if exists experiments_plan_size;
--   alter table public.experiments drop constraint if exists experiments_result_size;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'experiments_plan_size') then
    alter table public.experiments
      add constraint experiments_plan_size check (char_length(plan::text) <= 4000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'experiments_result_size') then
    alter table public.experiments
      add constraint experiments_result_size
      check (result is null or char_length(result::text) <= 4000);
  end if;
end $$;
