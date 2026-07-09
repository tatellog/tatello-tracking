-- Epic 01 · F5 · T5.1 — tabla `monthly_reports` (integrador final del motor).
--
-- Persiste el REPORTE ENSAMBLADO del mes: veredicto (déficit sostenido, NO la
-- balanza) + findings + stories + hypotheses + findingsHash. Lo computa
-- buildMonthlyReport (_shared/intelligence/report.ts) y lo escribe el writer
-- (plegado en compute-findings, JWT de la usuaria, RLS-scoped). Es lo que
-- Órbita Mes (R2) lee y R6 archiva.
--
-- Forma: columnas de consulta (findings_hash = llave de caché de la voz de IA;
-- month para el archivo longitudinal) + payload jsonb con el MonthlyReport
-- completo. El writer hace UPSERT (recomputa idempotente): el reporte es una
-- proyección de daily_signals, no tiene estado mutable propio (a diferencia de
-- hypotheses.status).
--
-- ADITIVA y no destructiva (DB en producción). Revertir:
--   drop table if exists public.monthly_reports cascade;

create table if not exists public.monthly_reports (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  period_type    text not null check (period_type in ('day', 'week', 'month', 'last30')),
  period_start   date not null,
  period_end     date not null check (period_end >= period_start),
  -- 'YYYY-MM' del reporte (archivo longitudinal R6).
  month          text not null check (month ~ '^\d{4}-\d{2}$'),
  -- Huella estable de los hallazgos: llave de caché de la voz de IA.
  findings_hash  text not null check (char_length(findings_hash) between 1 and 64),
  -- El MonthlyReport completo (veredicto + findings + stories + hypotheses).
  payload        jsonb not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Un reporte por (usuaria, periodo). El writer hace upsert.
  unique (user_id, period_type, period_start, period_end)
);

-- RLS: cada quien ve/escribe SOLO sus filas. (drop-if-exists → replay-safe.)
alter table public.monthly_reports enable row level security;

drop policy if exists "monthly_reports_select_own" on public.monthly_reports;
create policy "monthly_reports_select_own"
  on public.monthly_reports for select
  using (auth.uid() = user_id);

drop policy if exists "monthly_reports_insert_own" on public.monthly_reports;
create policy "monthly_reports_insert_own"
  on public.monthly_reports for insert
  with check (auth.uid() = user_id);

drop policy if exists "monthly_reports_update_own" on public.monthly_reports;
create policy "monthly_reports_update_own"
  on public.monthly_reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "monthly_reports_delete_own" on public.monthly_reports;
create policy "monthly_reports_delete_own"
  on public.monthly_reports for delete
  using (auth.uid() = user_id);

-- updated_at automático. Usa public.set_updated_at() (daily_notes migration);
-- este proyecto NO tiene la extensión moddatetime.
drop trigger if exists set_monthly_reports_updated_at on public.monthly_reports;
create trigger set_monthly_reports_updated_at
  before update on public.monthly_reports
  for each row execute function public.set_updated_at ();

-- Camino de lectura: el reporte de una usuaria en un periodo.
create index if not exists monthly_reports_user_period_idx
  on public.monthly_reports (user_id, period_type, period_start, period_end);

-- R6: archivo longitudinal por mes.
create index if not exists monthly_reports_user_month_idx
  on public.monthly_reports (user_id, month);
