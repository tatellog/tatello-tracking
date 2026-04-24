-- =====================================================================
-- Sprint 1 — initial schema
--
-- 5 tables: profiles, workouts, body_measurements, photos, briefs.
-- Each owned by an auth.users row. workout_date is derived in the user's
-- local timezone (America/Mexico_City for now; change in a follow-up
-- migration if that moves). A trigger on auth.users auto-creates the
-- profile row at signup so the client never has to upsert it manually.
-- =====================================================================

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  goal          text check (goal in ('recomposition', 'lose_fat', 'gain_muscle', 'maintain')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  -- workout_date is the calendar day in local time. Storing it lets us
  -- index cheaply for "did user train on date X" lookups and streak walks.
  workout_date  date generated always as ((completed_at at time zone 'America/Mexico_City')::date) stored,
  type          text,
  notes         text,
  created_at    timestamptz not null default now()
);

create unique index workouts_user_date_unique on public.workouts (user_id, workout_date);
create index        workouts_user_date_idx     on public.workouts (user_id, workout_date desc);

create table public.body_measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  measured_at  timestamptz not null default now(),
  weight_kg    numeric(5,2),
  waist_cm     numeric(5,2),
  chest_cm     numeric(5,2),
  hip_cm       numeric(5,2),
  thigh_cm     numeric(5,2),
  arm_cm       numeric(5,2),
  created_at   timestamptz not null default now()
);

create index body_measurements_user_date_idx
  on public.body_measurements (user_id, measured_at desc);

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  taken_at      timestamptz not null default now(),
  storage_path  text not null,
  angle         text check (angle in ('front', 'side', 'back')),
  created_at    timestamptz not null default now()
);

create index photos_user_date_idx on public.photos (user_id, taken_at desc);

create table public.briefs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  brief_date    date not null,
  content       jsonb not null,
  generated_at  timestamptz not null default now()
);

create unique index briefs_user_date_unique on public.briefs (user_id, brief_date);

-- Auto-create a profile row whenever a new auth user signs up. Runs as
-- security definer + pinned search_path so it can't be hijacked through
-- a malicious function named `profiles` in another schema.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
