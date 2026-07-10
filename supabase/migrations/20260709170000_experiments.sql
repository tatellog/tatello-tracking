-- Epic 05 · F-A · T-A1 — tabla `experiments` (R5 · Experiments).
--
-- Convierte una HIPÓTESIS (del Hypothesis Engine, R1) en un EXPERIMENTO medible
-- y reversible: UN activo a la vez, ≤2 semanas, con resultado determinístico
-- (confirmada/descartada/inconclusa · lo decide el motor midiendo daily_signals,
-- NUNCA la IA). La IA de R5 solo redacta el copy; no decide ni inventa.
--
-- Acoplamiento con `hypotheses` (por eso ambas tocan en esta migración): el FK
-- COMPUESTO (hypothesis_id, user_id) garantiza a nivel DB que un experimento solo
-- pueda referenciar una hipótesis de LA MISMA usuaria — imposible cruzar datos
-- entre cuentas aunque el id se filtrara. Requiere una unique (id, user_id) en
-- hypotheses como destino del FK (aditiva, id ya es PK).
--
-- ADITIVA y no destructiva (DB en producción). Revertir:
--   drop table if exists public.experiments cascade;
--   alter table public.hypotheses drop constraint if exists hypotheses_id_user_key;

-- Destino del FK compuesto: unique (id, user_id) en hypotheses (idempotente).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'hypotheses_id_user_key'
  ) then
    alter table public.hypotheses
      add constraint hypotheses_id_user_key unique (id, user_id);
  end if;
end $$;

create table if not exists public.experiments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- La hipótesis fuente. FK compuesto → misma usuaria garantizada por DB.
  hypothesis_id  uuid not null,
  -- La dimensión que se mide (ej. 'sueno', 'agua', 'movimiento'). El detalle del
  -- plan (acción, dirección, línea base, meta) vive en `plan`.
  dimension      text not null check (char_length(dimension) between 1 and 40),
  -- 'running' = el activo (≤1 por usuaria, ver índice parcial). Los 3 terminales
  -- son el RESULTADO, alineados con hypotheses.status (menos open/experimenting).
  status         text not null default 'running'
    check (status in ('running', 'confirmed', 'discarded', 'inconclusive')),
  -- Ventana del experimento. ≤2 semanas forzado por CHECK (started + 14 días).
  started_on     date not null,
  ends_on        date not null
    check (ends_on >= started_on and ends_on <= started_on + 14),
  -- El plan determinístico (scaffold de B1): acción reversible, dirección,
  -- métrica, línea base. jsonb para no rigidizar la forma mientras B lo define.
  plan           jsonb not null default '{}'::jsonb,
  -- La evidencia de la medición al cerrar (B2): valor medido, delta, etc. null
  -- mientras corre.
  result         jsonb,
  closed_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Misma usuaria garantizada: FK compuesto contra hypotheses(id, user_id).
  constraint experiments_hypothesis_same_user_fkey
    foreign key (hypothesis_id, user_id)
    references public.hypotheses (id, user_id) on delete cascade
);

-- RLS: cada quien ve/escribe SOLO sus filas. (drop-if-exists → replay-safe.)
alter table public.experiments enable row level security;

drop policy if exists "experiments_select_own" on public.experiments;
create policy "experiments_select_own"
  on public.experiments for select
  using (auth.uid() = user_id);

drop policy if exists "experiments_insert_own" on public.experiments;
create policy "experiments_insert_own"
  on public.experiments for insert
  with check (auth.uid() = user_id);

drop policy if exists "experiments_update_own" on public.experiments;
create policy "experiments_update_own"
  on public.experiments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "experiments_delete_own" on public.experiments;
create policy "experiments_delete_own"
  on public.experiments for delete
  using (auth.uid() = user_id);

-- updated_at automático. Usa public.set_updated_at() (daily_notes migration);
-- este proyecto NO tiene la extensión moddatetime.
drop trigger if exists set_experiments_updated_at on public.experiments;
create trigger set_experiments_updated_at
  before update on public.experiments
  for each row execute function public.set_updated_at ();

-- LA REGLA "≤1 activo a la vez": índice único parcial sobre el estado corriendo.
-- Postgres rechaza un segundo 'running' de la misma usuaria a nivel DB.
create unique index if not exists experiments_one_active_idx
  on public.experiments (user_id)
  where status = 'running';

-- Camino de lectura: los experimentos de una usuaria por estado (activo/cerrados).
create index if not exists experiments_user_status_idx
  on public.experiments (user_id, status);

-- Historial por hipótesis (un experimento por hipótesis, longitudinal R6).
create index if not exists experiments_hypothesis_idx
  on public.experiments (hypothesis_id);
