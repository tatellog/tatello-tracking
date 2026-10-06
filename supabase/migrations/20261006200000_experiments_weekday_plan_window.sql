-- 2026-10-06 — experiments: ventana de hasta 28 días para planes de un día
--
-- Un plan "si es viernes, haré X" (dueña 6 oct 2026) mide SOLO ese día de la
-- semana: con el tope de 14 días tendría 2 viernes y nunca daría veredicto.
-- Se sube el tope a 28 días (4 ocurrencias) SOLO cuando plan.weekday existe;
-- los experimentos de dimensión siguen en 14, también en la DB (espejo de
-- _shared/intelligence/experiments.ts).
--
-- Solo cambia un CHECK; no toca RLS, policies ni datos (las filas existentes,
-- todas ≤14 días, cumplen el nuevo límite).
--
-- Revertir (solo si ninguna fila pasa de 14 días):
--   alter table public.experiments drop constraint if exists experiments_window_check;
--   alter table public.experiments add constraint experiments_ends_on_check
--     check (ends_on >= started_on and ends_on <= started_on + 14);

do $$
declare
  c record;
begin
  -- El CHECK original es de columna y sin nombre explícito: se busca por su
  -- definición para no depender del nombre autogenerado.
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.experiments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%started_on + 14%'
      and conname <> 'experiments_window_check' -- la nueva también dice "+ 14"
  loop
    execute format('alter table public.experiments drop constraint %I', c.conname);
  end loop;

  -- Si el tope de 14 sigue (la constraint se renombró o se reescribió), fallar
  -- en voz alta: si no, los planes de 28 días romperían en runtime.
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.experiments'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%started_on + 14%'
      and conname <> 'experiments_window_check'
  ) then
    raise exception 'experiments: el tope de 14 días sigue presente';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'experiments_window_check'
      and conrelid = 'public.experiments'::regclass
  ) then
    alter table public.experiments
      add constraint experiments_window_check
      check (
        ends_on >= started_on
        and ends_on <= started_on + 28
        and (ends_on <= started_on + 14 or plan ? 'weekday')
      );
  end if;
end $$;
