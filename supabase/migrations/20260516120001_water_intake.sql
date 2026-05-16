-- =====================================================================
-- 2026-05-16 — water_intake: daily glasses of water
--
-- One row per user per day. The Hoy-tab "Agua de hoy" slide reads and
-- upserts the row keyed by (user_id, intake_date) — the same local
-- date the brief already computes, passed by the client. PK on that
-- pair makes the upsert fall out naturally.
--
-- No history beyond the per-day row: when a day passes, its row just
-- stops being read. `glasses` is capped at a sane upper bound so a
-- runaway tap can't write an absurd value.
-- =====================================================================

create table public.water_intake (
  user_id      uuid not null references auth.users(id) on delete cascade,
  intake_date  date not null,
  glasses      int  not null default 0 check (glasses >= 0 and glasses <= 30),
  updated_at   timestamptz not null default now(),
  primary key (user_id, intake_date)
);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.water_intake enable row level security;

create policy "users read own water"   on public.water_intake
  for select using (auth.uid() = user_id);
create policy "users insert own water" on public.water_intake
  for insert with check (auth.uid() = user_id);
create policy "users update own water" on public.water_intake
  for update using (auth.uid() = user_id);
