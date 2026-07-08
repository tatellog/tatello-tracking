-- =====================================================================
-- 2026-07-07 — wearables fase 0: tablas crudas de aterrizaje
-- (docs/wearables-integration-spec.md §2)
--
-- El reloj escribe AQUÍ (upsert idempotente por user+source+external_id),
-- NUNCA en las tablas manuales (workouts / sleep_logs tienen semántica
-- manual que no se contamina). La view daily_signals las mergea en la
-- migración siguiente con la regla "manual gana, el reloj rellena".
--
-- · Timestamps crudos SE PRESERVAN (primera fuente de bedtime/wake
--   reales; los futuros patrones de hora salen de aquí).
-- · `sleep_date` = el día LOCAL en que despertó (lo computa el cliente
--   con profiles.timezone, misma convención que sleep_logs).
-- · Garmin reenvía summaries corregidos → el UNIQUE hace el re-sync
--   idempotente (upsert reemplaza, nunca duplica).
-- · wearable_steps es agregado diario pre-deduplicado (HKStatisticsQuery
--   / summary Garmin): su identidad natural es (user, source, día).
--
-- Revertir:
--   drop table if exists public.wearable_workouts;
--   drop table if exists public.wearable_sleep;
--   drop table if exists public.wearable_steps;
-- =====================================================================

-- ── wearable_workouts ────────────────────────────────────────────────
create table if not exists public.wearable_workouts (
  id           uuid not null default gen_random_uuid() primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  source       text not null check (source in ('apple_health', 'garmin')),
  external_id  text not null check (char_length(external_id) between 1 and 256),
  started_at   timestamptz not null,
  ended_at     timestamptz not null check (ended_at >= started_at),
  workout_type text check (workout_type is null or char_length(workout_type) <= 64),
  duration_min integer check (duration_min is null or (duration_min >= 0 and duration_min <= 1440)),
  -- kcal del ENTRENO (viene DENTRO del HKWorkout / summary; jamás el
  -- stream de calorías activas del día — spec §4). Rango generoso:
  -- atrapa basura, no juzga cuerpos.
  energy_kcal  integer check (energy_kcal is null or (energy_kcal >= 0 and energy_kcal <= 5000)),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table public.wearable_workouts enable row level security;

drop policy if exists "wearable_workouts_select_own" on public.wearable_workouts;
create policy "wearable_workouts_select_own" on public.wearable_workouts
  for select using (auth.uid() = user_id);
drop policy if exists "wearable_workouts_insert_own" on public.wearable_workouts;
create policy "wearable_workouts_insert_own" on public.wearable_workouts
  for insert with check (auth.uid() = user_id);
drop policy if exists "wearable_workouts_update_own" on public.wearable_workouts;
create policy "wearable_workouts_update_own" on public.wearable_workouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wearable_workouts_delete_own" on public.wearable_workouts;
create policy "wearable_workouts_delete_own" on public.wearable_workouts
  for delete using (auth.uid() = user_id);

-- La view agrupa por día local derivado de ended_at → índice por usuaria
-- y fin del entreno.
create index if not exists wearable_workouts_user_ended_idx
  on public.wearable_workouts (user_id, ended_at);

drop trigger if exists set_wearable_workouts_updated_at on public.wearable_workouts;
create trigger set_wearable_workouts_updated_at
  before update on public.wearable_workouts
  for each row execute function public.set_updated_at();

-- ── wearable_sleep ───────────────────────────────────────────────────
create table if not exists public.wearable_sleep (
  id             uuid not null default gen_random_uuid() primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  source         text not null check (source in ('apple_health', 'garmin')),
  external_id    text not null check (char_length(external_id) between 1 and 256),
  -- Día local en que DESPERTÓ (convención de sleep_logs.sleep_date).
  sleep_date     date not null,
  bedtime_at     timestamptz,
  wake_at        timestamptz check (wake_at is null or bedtime_at is null or wake_at >= bedtime_at),
  -- Suma de etapas "asleep" (no inBed — el error clásico que infla 1-2h).
  asleep_minutes integer not null check (asleep_minutes >= 0 and asleep_minutes <= 1440),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table public.wearable_sleep enable row level security;

drop policy if exists "wearable_sleep_select_own" on public.wearable_sleep;
create policy "wearable_sleep_select_own" on public.wearable_sleep
  for select using (auth.uid() = user_id);
drop policy if exists "wearable_sleep_insert_own" on public.wearable_sleep;
create policy "wearable_sleep_insert_own" on public.wearable_sleep
  for insert with check (auth.uid() = user_id);
drop policy if exists "wearable_sleep_update_own" on public.wearable_sleep;
create policy "wearable_sleep_update_own" on public.wearable_sleep
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wearable_sleep_delete_own" on public.wearable_sleep;
create policy "wearable_sleep_delete_own" on public.wearable_sleep
  for delete using (auth.uid() = user_id);

create index if not exists wearable_sleep_user_date_idx
  on public.wearable_sleep (user_id, sleep_date);

drop trigger if exists set_wearable_sleep_updated_at on public.wearable_sleep;
create trigger set_wearable_sleep_updated_at
  before update on public.wearable_sleep
  for each row execute function public.set_updated_at();

-- ── wearable_steps ───────────────────────────────────────────────────
-- Ingest-only (spec §1): el motor/superficie deciden después. Agregado
-- diario pre-deduplicado; identidad natural (user, source, día).
create table if not exists public.wearable_steps (
  id         uuid not null default gen_random_uuid() primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  source     text not null check (source in ('apple_health', 'garmin')),
  day_date   date not null,
  steps      integer not null check (steps >= 0 and steps <= 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, day_date)
);

alter table public.wearable_steps enable row level security;

drop policy if exists "wearable_steps_select_own" on public.wearable_steps;
create policy "wearable_steps_select_own" on public.wearable_steps
  for select using (auth.uid() = user_id);
drop policy if exists "wearable_steps_insert_own" on public.wearable_steps;
create policy "wearable_steps_insert_own" on public.wearable_steps
  for insert with check (auth.uid() = user_id);
drop policy if exists "wearable_steps_update_own" on public.wearable_steps;
create policy "wearable_steps_update_own" on public.wearable_steps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "wearable_steps_delete_own" on public.wearable_steps;
create policy "wearable_steps_delete_own" on public.wearable_steps
  for delete using (auth.uid() = user_id);

create index if not exists wearable_steps_user_date_idx
  on public.wearable_steps (user_id, day_date);

drop trigger if exists set_wearable_steps_updated_at on public.wearable_steps;
create trigger set_wearable_steps_updated_at
  before update on public.wearable_steps
  for each row execute function public.set_updated_at();
