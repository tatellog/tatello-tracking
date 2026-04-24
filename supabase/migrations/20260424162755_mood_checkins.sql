-- =====================================================================
-- Sprint 2 — mood_checkins
--
-- How the user is feeling right now. Three bucketed values keep the
-- API honest (no free-form "sorta meh"), but multiple rows per day
-- are allowed — mood changes during the day and we want each change
-- captured for future pattern analysis.
-- =====================================================================

create table public.mood_checkins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  value         text not null check (value in ('good', 'neutral', 'struggle')),
  checked_at    timestamptz not null default now(),
  checkin_date  date generated always as ((checked_at at time zone 'America/Mexico_City')::date) stored,
  created_at    timestamptz not null default now()
);

create index mood_checkins_user_date_idx
  on public.mood_checkins (user_id, checkin_date desc);

alter table public.mood_checkins enable row level security;

create policy "users read own moods"   on public.mood_checkins
  for select using (auth.uid() = user_id);
create policy "users insert own moods" on public.mood_checkins
  for insert with check (auth.uid() = user_id);
create policy "users update own moods" on public.mood_checkins
  for update using (auth.uid() = user_id);
create policy "users delete own moods" on public.mood_checkins
  for delete using (auth.uid() = user_id);
