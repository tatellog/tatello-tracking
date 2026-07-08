-- =====================================================================
-- 2026-07-08 — ai_insights: el AI Cache del AI Foundation release
-- (docs/ai-foundation-spec.md · paso 3)
--
-- Cachea la respuesta de IA por (usuaria, feature, periodo). La regla del
-- release: si el `context_hash` no cambió (y el `prompt_version` tampoco),
-- NO se vuelve a llamar la IA — se sirve esta fila.
--
-- · UNA fila por (user, feature, period_type, period_start, period_end):
--   el upsert la reemplaza cuando el contexto cambia (on conflict). Así el
--   caché nunca acumula respuestas viejas del mismo periodo.
-- · `context_hash` = hash del PeriodContext (solo agregados, nunca raw).
-- · `prompt_version` versiona el prompt+modelo: cambiarlo invalida el caché
--   sin tocar datos (una respuesta de gpt-4o-mini v1 ≠ una futura v2).
-- · `response` jsonb: la salida estructurada (p. ej. { voz: [...] }).
-- · `expires_at` opcional: TTL suave; null = vive hasta que cambie el hash.
--
-- La escribe la edge function con el JWT de la caller (RLS-scoped); nunca
-- service role. Feature-freeze de schema el 19-jul → entra ANTES.
--
-- Revertir: drop table if exists public.ai_insights;
-- =====================================================================

create table if not exists public.ai_insights (
  id             uuid not null default gen_random_uuid() primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- Qué superficie generó el insight (orbita_dia / orbita_semana /
  -- orbita_mes / progreso …). Length-check en vez de enum para no requerir
  -- migración al agregar una superficie nueva.
  feature        text not null check (char_length(feature) between 1 and 40),
  period_type    text not null check (period_type in ('day', 'week', 'month', 'last30')),
  period_start   date not null,
  period_end     date not null check (period_end >= period_start),
  -- Clave de de-dup: si no cambió, no se re-llama la IA.
  context_hash   text not null check (char_length(context_hash) between 1 and 128),
  prompt_version text not null check (char_length(prompt_version) between 1 and 32),
  -- Cap defensivo: un insight es voz corta (~1-2 KB). El tope evita que una
  -- escritura directa (RLS permite a la usuaria insertar en su propia fila)
  -- plante un blob gigante. Generoso: no juzga contenido, atrapa abuso.
  response       jsonb not null check (char_length(response::text) <= 20000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  expires_at     timestamptz,
  -- Un insight por superficie+periodo por usuaria → upsert reemplaza.
  unique (user_id, feature, period_type, period_start, period_end)
);

alter table public.ai_insights enable row level security;

-- Idempotente para re-runs (PG no soporta CREATE POLICY IF NOT EXISTS).
drop policy if exists "ai_insights_select_own" on public.ai_insights;
create policy "ai_insights_select_own" on public.ai_insights
  for select using (auth.uid() = user_id);
drop policy if exists "ai_insights_insert_own" on public.ai_insights;
create policy "ai_insights_insert_own" on public.ai_insights
  for insert with check (auth.uid() = user_id);
drop policy if exists "ai_insights_update_own" on public.ai_insights;
create policy "ai_insights_update_own" on public.ai_insights
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "ai_insights_delete_own" on public.ai_insights;
create policy "ai_insights_delete_own" on public.ai_insights
  for delete using (auth.uid() = user_id);

-- El lookup del caché va por (user, feature, period) — cubierto por el
-- UNIQUE. Índice extra por vencimiento para una limpieza futura barata.
create index if not exists ai_insights_expires_idx
  on public.ai_insights (expires_at)
  where expires_at is not null;

drop trigger if exists set_ai_insights_updated_at on public.ai_insights;
create trigger set_ai_insights_updated_at
  before update on public.ai_insights
  for each row execute function public.set_updated_at();
