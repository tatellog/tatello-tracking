-- Epic 01 · F2 · T2.1 — tabla `findings` (Findings Engine).
--
-- Persiste los HALLAZGOS ya detectados + rankeados (motor determinístico
-- compartido, _shared/intelligence/findings.ts) por (usuaria, periodo). La
-- escribe un WRITER backend (edge, con el JWT de la usuaria, RLS-scoped); la lee
-- Órbita (R2) y la memoria longitudinal (R6). La IA solo EXPLICA lo persistido.
--
-- Diseño: columnas de CONSULTA (finding_id, category, is_obstacle, confidence,
-- subject) para análisis longitudinal (R6) + `payload` jsonb con el Finding
-- COMPLETO (reconstrucción sin pérdida). El resto del contenido (contrast,
-- hypothesis, north_link, evidence_dates, charts, metacognition, followUps) vive
-- en el payload. Las columnas duplican a propósito unos pocos campos (índice de
-- consulta vs fuente).
--
-- ADITIVA y no destructiva (DB en producción). Revertir:
--   drop table if exists public.findings cascade;

create table if not exists public.findings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  period_type   text not null check (period_type in ('day', 'week', 'month', 'last30')),
  period_start  date not null,
  period_end    date not null check (period_end >= period_start),
  -- Slug estable del hallazgo ('weekday-diet-break', 'deficit-summary', …).
  finding_id    text not null check (char_length(finding_id) between 1 and 60),
  category      text not null check (
    category in ('deficit', 'movimiento', 'sueno', 'agua', 'proteina', 'alimentacion')
  ),
  is_obstacle   boolean not null default false,
  confidence    integer not null check (confidence >= 0 and confidence <= 100),
  subject       text not null check (char_length(subject) between 1 and 200),
  -- El Finding COMPLETO, para reconstruirlo sin pérdida al leer.
  payload       jsonb not null check (char_length(payload::text) <= 20000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Idempotencia del writer: un hallazgo por (usuaria, periodo, slug) → upsert.
  unique (user_id, period_type, period_start, period_end, finding_id)
);

-- RLS: cada quien ve/escribe SOLO sus filas. (drop-if-exists → replay-safe.)
alter table public.findings enable row level security;

drop policy if exists "findings_select_own" on public.findings;
create policy "findings_select_own"
  on public.findings for select
  using (auth.uid() = user_id);

drop policy if exists "findings_insert_own" on public.findings;
create policy "findings_insert_own"
  on public.findings for insert
  with check (auth.uid() = user_id);

drop policy if exists "findings_update_own" on public.findings;
create policy "findings_update_own"
  on public.findings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "findings_delete_own" on public.findings;
create policy "findings_delete_own"
  on public.findings for delete
  using (auth.uid() = user_id);

-- updated_at automático (marca el último recomputo del writer). Usa
-- public.set_updated_at() (definida en 20260701213508_daily_notes.sql).
drop trigger if exists set_findings_updated_at on public.findings;
create trigger set_findings_updated_at
  before update on public.findings
  for each row execute function public.set_updated_at ();

-- Camino de lectura: los hallazgos de una usuaria en un periodo.
create index if not exists findings_user_period_idx
  on public.findings (user_id, period_type, period_start, period_end);

-- Longitudinal (R6): "¿este hallazgo apareció en meses anteriores?".
create index if not exists findings_user_finding_idx
  on public.findings (user_id, finding_id);
