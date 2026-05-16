-- =====================================================================
-- 2026-05-16 — rest_days: a logged "I rested today" acknowledgment
--
-- One row per user per day. A row's mere existence means the user
-- chose "Hoy descansé" for that date — there is no payload. The Hoy
-- tab reads today's row to swap the workout CTA for a supportive,
-- evidence-based message instead of leaving an un-pressed CTA that
-- reads as guilt.
--
-- Deliberately decoupled from `workouts` and from the brief RPC: a
-- rest day does NOT light a constellation star, does NOT count toward
-- the 28-day cycle, and does NOT touch the streak. Its only job is to
-- stop the app from guilting you on a day you didn't train. So it is
-- a standalone per-day flag, read on its own — the mirror of
-- `water_intake`.
-- =====================================================================

create table public.rest_days (
  user_id    uuid not null references auth.users(id) on delete cascade,
  rest_date  date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, rest_date)
);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.rest_days enable row level security;

create policy "users read own rest"   on public.rest_days
  for select using (auth.uid() = user_id);
create policy "users insert own rest" on public.rest_days
  for insert with check (auth.uid() = user_id);
create policy "users delete own rest" on public.rest_days
  for delete using (auth.uid() = user_id);
