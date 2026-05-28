-- =====================================================================
-- 2026-05-28 — analytics_events: client-instrumented usage stream
--
-- Append-only event log produced by lib/analytics.ts.track().
-- Populated only for beta users — the tracker reads
-- profiles.is_beta and no-ops for everyone else, so the
-- table stays small (one cohort of ~4 users for now).
--
-- RLS is per-user (read + insert own). We intentionally don't
-- enforce is_beta=true in the policy because that coupling would
-- block dev/seed flows; the gate lives on the client.
-- =====================================================================

create table public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_name  text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index analytics_events_user_event_date_idx
  on public.analytics_events (user_id, event_name, created_at desc);

alter table public.analytics_events enable row level security;

create policy "users insert own analytics_events" on public.analytics_events
  for insert with check (auth.uid() = user_id);

create policy "users read own analytics_events" on public.analytics_events
  for select using (auth.uid() = user_id);
