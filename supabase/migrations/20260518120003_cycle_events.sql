-- =====================================================================
-- 2026-05-18 — cycle_events: menstrual cycle raw events (órbita, fase 2)
--
-- DELIBERATELY MINIMAL. This is the raw-signal layer the órbita engine
-- needs — not the rich product surface. A separate, deferred "cycle
-- lifecycle sprint" owns the derived model (current phase, predictions,
-- the multi-cycle "Tu Cielo" view). That sprint builds ON TOP of this
-- table; it does not replace it. Keeping this table to bare events
-- (period start / end) means the sprint can layer symptom logging and
-- derived phases later without a destructive rewrite.
--
-- From period_start dates alone the engine derives cycle length and
-- phase, which is what the órbita correlations ("cuándo floreces vs
-- colapsas relative to cycle phase") actually need.
--
-- event_date is the LOCAL calendar date, client-passed — a period start
-- is a date, not an instant, so there is no timestamp to store.
-- The table is per-user via RLS; whether to surface cycle logging at
-- all is a UI decision keyed off profiles.biological_sex.
-- =====================================================================

create table public.cycle_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_type  text not null check (event_type in ('period_start', 'period_end')),
  event_date  date not null,
  -- Flow intensity — meaningful mainly on a period_start row. Optional.
  flow        text check (flow is null or flow in ('light', 'medium', 'heavy')),
  notes       text,
  created_at  timestamptz not null default now()
);

-- Stops an exact duplicate event (same type, same day). It does NOT try
-- to enforce "one period_start per period" — that is derived logic the
-- cycle sprint owns, not a DB constraint.
create unique index cycle_events_user_type_date_unique
  on public.cycle_events (user_id, event_type, event_date);
create index cycle_events_user_date_idx
  on public.cycle_events (user_id, event_date desc);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.cycle_events enable row level security;

create policy "users read own cycle"   on public.cycle_events
  for select using (auth.uid() = user_id);
create policy "users insert own cycle" on public.cycle_events
  for insert with check (auth.uid() = user_id);
create policy "users update own cycle" on public.cycle_events
  for update using (auth.uid() = user_id);
create policy "users delete own cycle" on public.cycle_events
  for delete using (auth.uid() = user_id);
