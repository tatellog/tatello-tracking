-- Epic 01 · F4 · T4.1 — tabla `hypotheses` (Hypothesis Engine).
--
-- Persiste las HIPÓTESIS: sugieren una posible relación ("es posible que…"),
-- NUNCA afirman causa (manifiesto). Las computa buildHypotheses
-- (_shared/intelligence/hypothesis.ts) y las escribe el writer (plegado en
-- compute-findings, JWT de la usuaria, RLS-scoped).
--
-- `status` es la SEMILLA de Experiments (R5) y es MUTABLE por R5. Por eso el
-- writer inserta con ON CONFLICT DO NOTHING (no re-pisa el status de una
-- hipótesis ya en curso al recomputar). El default es 'open'.
--
-- ADITIVA y no destructiva (DB en producción). Revertir:
--   drop table if exists public.hypotheses cascade;

create table if not exists public.hypotheses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  period_type    text not null check (period_type in ('day', 'week', 'month', 'last30')),
  period_start   date not null,
  period_end     date not null check (period_end >= period_start),
  -- Slug estable de la hipótesis ('hyp-story-…', 'hyp-find-…').
  hypothesis_id  text not null check (char_length(hypothesis_id) between 1 and 100),
  -- El texto tentativo ("es posible que…").
  text           text not null check (char_length(text) between 1 and 400),
  confidence     integer not null check (confidence >= 0 and confidence <= 100),
  status         text not null default 'open'
    check (status in ('open', 'experimenting', 'confirmed', 'discarded', 'inconclusive')),
  source_finding_id text check (source_finding_id is null or char_length(source_finding_id) <= 60),
  source_story_id   text check (source_story_id is null or char_length(source_story_id) <= 140),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Una hipótesis por (usuaria, periodo, slug). El writer inserta do-nothing.
  unique (user_id, period_type, period_start, period_end, hypothesis_id)
);

-- RLS: cada quien ve/escribe SOLO sus filas. (drop-if-exists → replay-safe.)
alter table public.hypotheses enable row level security;

drop policy if exists "hypotheses_select_own" on public.hypotheses;
create policy "hypotheses_select_own"
  on public.hypotheses for select
  using (auth.uid() = user_id);

drop policy if exists "hypotheses_insert_own" on public.hypotheses;
create policy "hypotheses_insert_own"
  on public.hypotheses for insert
  with check (auth.uid() = user_id);

drop policy if exists "hypotheses_update_own" on public.hypotheses;
create policy "hypotheses_update_own"
  on public.hypotheses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "hypotheses_delete_own" on public.hypotheses;
create policy "hypotheses_delete_own"
  on public.hypotheses for delete
  using (auth.uid() = user_id);

-- updated_at automático. Usa public.set_updated_at() (daily_notes migration);
-- este proyecto NO tiene la extensión moddatetime.
drop trigger if exists set_hypotheses_updated_at on public.hypotheses;
create trigger set_hypotheses_updated_at
  before update on public.hypotheses
  for each row execute function public.set_updated_at ();

-- Camino de lectura: las hipótesis de una usuaria en un periodo.
create index if not exists hypotheses_user_period_idx
  on public.hypotheses (user_id, period_type, period_start, period_end);

-- R5/R6: buscar por estado (experimentos activos) y longitudinal por slug.
create index if not exists hypotheses_user_status_idx
  on public.hypotheses (user_id, status);
