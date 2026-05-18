-- =====================================================================
-- 2026-05-18 — sleep_logs: a night's sleep (órbita engine, fase 2)
--
-- One row per user per night. A sleep episode spans two calendar days,
-- so the night is attributed to `sleep_date` — the LOCAL date the user
-- woke up. The client passes that date (it knows profiles.timezone),
-- exactly like water_intake.intake_date / rest_days.rest_date. No
-- generated local-date column here on purpose: a generated column would
-- have to bake a timezone literal, the legacy mistake the per-user
-- timezone migration (20260518120001) exists to stop repeating.
--
-- bedtime / wake_time are absolute instants (timestamptz). duration is
-- derived ONCE at write time by a generated column — that is safe here
-- because it is pure arithmetic on the row's own columns, with no
-- timezone function involved (unlike workout_date / meal_date).
-- =====================================================================

create table public.sleep_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  sleep_date       date not null,
  bedtime          timestamptz not null,
  wake_time        timestamptz not null,
  duration_minutes int generated always as (
    (extract(epoch from (wake_time - bedtime)) / 60)::int
  ) stored,
  -- 1 (terrible) … 5 (great). Nullable: the user may log times only.
  quality          smallint check (quality is null or (quality between 1 and 5)),
  notes            text,
  created_at       timestamptz not null default now(),
  constraint sleep_logs_wake_after_bed check (wake_time > bedtime)
);

-- One sleep per night; the unique index makes the client upsert on
-- (user_id, sleep_date) fall out naturally.
create unique index sleep_logs_user_date_unique
  on public.sleep_logs (user_id, sleep_date);
create index sleep_logs_user_date_idx
  on public.sleep_logs (user_id, sleep_date desc);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.sleep_logs enable row level security;

create policy "users read own sleep"   on public.sleep_logs
  for select using (auth.uid() = user_id);
create policy "users insert own sleep" on public.sleep_logs
  for insert with check (auth.uid() = user_id);
create policy "users update own sleep" on public.sleep_logs
  for update using (auth.uid() = user_id);
create policy "users delete own sleep" on public.sleep_logs
  for delete using (auth.uid() = user_id);
