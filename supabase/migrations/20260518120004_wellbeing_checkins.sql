-- =====================================================================
-- 2026-05-18 — wellbeing_checkins: energy / motivation / stress
--               (órbita engine, fase 2)
--
-- mood_checkins already captures a single coarse mood bucket. This is
-- its higher-resolution sibling: three independent numeric axes so the
-- órbita engine can correlate each one separately ("stress vs sleep",
-- "motivation vs streak"). A single mood enum cannot carry that.
--
-- One row IS one check-in moment — energy/motivation/stress are filled
-- together, not as three separate rows. Multiple check-ins per day are
-- allowed (the axes shift through the day), mirroring mood_checkins.
--
-- checked_at is the absolute instant; checkin_date is the LOCAL date,
-- client-passed — no generated, timezone-baking column. Each axis is
-- nullable so a partial check-in is allowed, but a row with all three
-- empty carries no signal and is rejected.
-- =====================================================================

create table public.wellbeing_checkins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  checked_at    timestamptz not null default now(),
  checkin_date  date not null,
  -- Each axis: 1 (low) … 5 (high).
  energy        smallint check (energy is null or (energy between 1 and 5)),
  motivation    smallint check (motivation is null or (motivation between 1 and 5)),
  stress        smallint check (stress is null or (stress between 1 and 5)),
  notes         text,
  created_at    timestamptz not null default now(),
  constraint wellbeing_checkins_has_value
    check (num_nonnulls(energy, motivation, stress) >= 1)
);

create index wellbeing_checkins_user_date_idx
  on public.wellbeing_checkins (user_id, checkin_date desc, checked_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.wellbeing_checkins enable row level security;

create policy "users read own wellbeing"   on public.wellbeing_checkins
  for select using (auth.uid() = user_id);
create policy "users insert own wellbeing" on public.wellbeing_checkins
  for insert with check (auth.uid() = user_id);
create policy "users update own wellbeing" on public.wellbeing_checkins
  for update using (auth.uid() = user_id);
create policy "users delete own wellbeing" on public.wellbeing_checkins
  for delete using (auth.uid() = user_id);
