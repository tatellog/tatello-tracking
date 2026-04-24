-- =====================================================================
-- Sprint 1 — RLS policies
--
-- Every table is private to its owner: select/insert/update/delete all
-- gated on auth.uid() = <owner column>. profiles uses `id` directly
-- (it's the same uuid as the auth user); the rest use `user_id`.
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.workouts          enable row level security;
alter table public.body_measurements enable row level security;
alter table public.photos            enable row level security;
alter table public.briefs            enable row level security;

-- ─── profiles ────────────────────────────────────────────────────────
create policy "users read own profile"   on public.profiles
  for select using (auth.uid() = id);
create policy "users update own profile" on public.profiles
  for update using (auth.uid() = id);

-- No insert policy: profiles are created by the handle_new_user trigger
-- (security definer) at signup. No delete policy: deleting a profile
-- would strand workouts/measurements; use auth.users cascade instead.

-- ─── workouts ────────────────────────────────────────────────────────
create policy "users read own workouts"   on public.workouts
  for select using (auth.uid() = user_id);
create policy "users insert own workouts" on public.workouts
  for insert with check (auth.uid() = user_id);
create policy "users update own workouts" on public.workouts
  for update using (auth.uid() = user_id);
create policy "users delete own workouts" on public.workouts
  for delete using (auth.uid() = user_id);

-- ─── body_measurements ───────────────────────────────────────────────
create policy "users read own measurements"   on public.body_measurements
  for select using (auth.uid() = user_id);
create policy "users insert own measurements" on public.body_measurements
  for insert with check (auth.uid() = user_id);
create policy "users update own measurements" on public.body_measurements
  for update using (auth.uid() = user_id);
create policy "users delete own measurements" on public.body_measurements
  for delete using (auth.uid() = user_id);

-- ─── photos ──────────────────────────────────────────────────────────
create policy "users read own photos"   on public.photos
  for select using (auth.uid() = user_id);
create policy "users insert own photos" on public.photos
  for insert with check (auth.uid() = user_id);
create policy "users update own photos" on public.photos
  for update using (auth.uid() = user_id);
create policy "users delete own photos" on public.photos
  for delete using (auth.uid() = user_id);

-- ─── briefs ──────────────────────────────────────────────────────────
create policy "users read own briefs"   on public.briefs
  for select using (auth.uid() = user_id);
create policy "users insert own briefs" on public.briefs
  for insert with check (auth.uid() = user_id);
create policy "users update own briefs" on public.briefs
  for update using (auth.uid() = user_id);
create policy "users delete own briefs" on public.briefs
  for delete using (auth.uid() = user_id);
