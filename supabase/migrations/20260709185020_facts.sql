-- Epic 01 · F1 · T1.1 — tabla `facts` (Facts Engine).
--
-- El primer engine de R1: registros → HECHOS agregados por (usuaria, periodo).
-- Nunca interpreta, solo calcula. La escribe un WRITER backend (edge/RPC con el
-- JWT de la usuaria, RLS-scoped); el cliente la lee con fallback a compute
-- (ver docs/adr/0001-...). Contrato de dominio: _shared/intelligence/engine.ts
-- (type `Fact`).
--
-- ADITIVA y no destructiva (DB en producción con usuarias reales): solo crea una
-- tabla nueva; no toca nada existente.
--
-- Revertir: `drop table if exists public.facts cascade;`

create table if not exists public.facts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  -- Periodo del agregado. period_type acota la granularidad; el rango es explícito.
  period_type   text not null check (period_type in ('day', 'week', 'month', 'last30')),
  period_start  date not null,
  period_end    date not null check (period_end >= period_start),
  -- Qué hecho es (ej. 'deficit_days', 'avg_protein', 'workout_days'). Slug corto.
  kind          text not null check (char_length(kind) between 1 and 60),
  -- El valor agregado (número). Cota generosa: atrapa basura, no juzga.
  value         numeric not null check (value > -1000000 and value < 100000000),
  unit          text check (unit is null or char_length(unit) <= 20),
  -- Cuántos días/registros lo sostienen (honestidad sobre la muestra).
  evidence_count integer not null default 0 check (evidence_count >= 0 and evidence_count <= 3660),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Idempotencia del writer: un hecho por (usuaria, periodo, kind) → upsert.
  unique (user_id, period_type, period_start, period_end, kind)
);

-- RLS: cada quien ve/escribe SOLO sus filas. (drop-if-exists → replay-safe.)
alter table public.facts enable row level security;

drop policy if exists "facts_select_own" on public.facts;
create policy "facts_select_own"
  on public.facts for select
  using (auth.uid() = user_id);

drop policy if exists "facts_insert_own" on public.facts;
create policy "facts_insert_own"
  on public.facts for insert
  with check (auth.uid() = user_id);

drop policy if exists "facts_update_own" on public.facts;
create policy "facts_update_own"
  on public.facts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "facts_delete_own" on public.facts;
create policy "facts_delete_own"
  on public.facts for delete
  using (auth.uid() = user_id);

-- updated_at se mantiene solo (marca el último recomputo del writer). Usa
-- public.set_updated_at() (definida en 20260701213508_daily_notes.sql); este
-- proyecto NO tiene la extensión moddatetime.
drop trigger if exists set_facts_updated_at on public.facts;
create trigger set_facts_updated_at
  before update on public.facts
  for each row execute function public.set_updated_at ();

-- Índice del camino de lectura: buscar los hechos de una usuaria en un periodo.
create index if not exists facts_user_period_idx
  on public.facts (user_id, period_type, period_start, period_end);
