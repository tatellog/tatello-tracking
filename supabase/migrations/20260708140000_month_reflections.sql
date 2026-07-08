-- =====================================================================
-- 2026-07-08 — month_reflections: metacognición de Órbita Mes IA
-- (docs/orbita-mes-ia-spec.md · Release 2)
--
-- Guarda la respuesta de la usuaria a las preguntas del chat guiado
-- ("¿también lo habías notado?" → sí / no / nunca me había dado cuenta).
-- La IA hace pensar; la respuesta se persiste para alimentar futuras
-- conversaciones ("la vez pasada no lo habías notado…").
--
-- · UNA respuesta por (usuaria, mes, pregunta) → upsert la reemplaza.
-- · `month` = 'YYYY-MM' (el mes del que habla la conversación).
-- · `question_key` = id estable de la pregunta (p. ej. 'deficit_friday').
-- · `answer` = el VALOR de la opción elegida (texto corto), no la etiqueta.
--
-- Feature-freeze de schema el 19-jul → esta tabla entra ANTES.
--
-- Revertir: drop table if exists public.month_reflections;
-- =====================================================================

create table if not exists public.month_reflections (
  id           uuid not null default gen_random_uuid() primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  -- Mes del que habla la reflexión ('YYYY-MM'). No es fecha completa: la
  -- conversación es sobre un mes, no un día.
  month        text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  question_key text not null check (char_length(question_key) between 1 and 64),
  answer       text not null check (char_length(answer) between 1 and 64),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, month, question_key)
);

alter table public.month_reflections enable row level security;

drop policy if exists "month_reflections_select_own" on public.month_reflections;
create policy "month_reflections_select_own" on public.month_reflections
  for select using (auth.uid() = user_id);
drop policy if exists "month_reflections_insert_own" on public.month_reflections;
create policy "month_reflections_insert_own" on public.month_reflections
  for insert with check (auth.uid() = user_id);
drop policy if exists "month_reflections_update_own" on public.month_reflections;
create policy "month_reflections_update_own" on public.month_reflections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "month_reflections_delete_own" on public.month_reflections;
create policy "month_reflections_delete_own" on public.month_reflections
  for delete using (auth.uid() = user_id);

create index if not exists month_reflections_user_month_idx
  on public.month_reflections (user_id, month);

drop trigger if exists set_month_reflections_updated_at on public.month_reflections;
create trigger set_month_reflections_updated_at
  before update on public.month_reflections
  for each row execute function public.set_updated_at();
