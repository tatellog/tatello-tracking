-- =====================================================================
-- Sprint 2.5 — meals + macro_targets
--
-- macro_targets: one row per user, their daily goals. PK = user_id
-- so upsert semantics fall out naturally. No history tracking — when
-- the user revises goals, the old target is gone; that's the
-- intended product behaviour.
--
-- meals: append-only ledger of consumed meals. Source column
-- distinguishes manual logs from Sprint 3's photo/text IA entries,
-- and ai_raw_response stores the model's full output for future
-- audit/reprocessing. meal_date is a generated column so day-level
-- aggregates are index-cheap without the client ever computing a
-- local date.
-- =====================================================================

create table public.macro_targets (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  protein_g   int not null check (protein_g > 0 and protein_g < 1000),
  calories    int not null check (calories > 0 and calories < 10000),
  updated_at  timestamptz not null default now()
);

create table public.meals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  consumed_at         timestamptz not null default now(),
  meal_date           date generated always as ((consumed_at at time zone public.user_timezone())::date) stored,
  name                text not null,
  protein_g           numeric(6,1) not null check (protein_g >= 0),
  calories            int not null check (calories >= 0),
  -- Sprint 3 fields (photo + IA flow). Nullable now; populated later.
  photo_storage_path  text,
  source              text not null default 'manual'
                      check (source in ('manual', 'photo_ai', 'text_ai')),
  ai_raw_response     jsonb,
  notes               text,
  created_at          timestamptz not null default now()
);

create index meals_user_date_idx
  on public.meals (user_id, meal_date desc, consumed_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.macro_targets enable row level security;
alter table public.meals         enable row level security;

create policy "users read own targets"   on public.macro_targets
  for select using (auth.uid() = user_id);
create policy "users insert own targets" on public.macro_targets
  for insert with check (auth.uid() = user_id);
create policy "users update own targets" on public.macro_targets
  for update using (auth.uid() = user_id);

create policy "users read own meals"   on public.meals
  for select using (auth.uid() = user_id);
create policy "users insert own meals" on public.meals
  for insert with check (auth.uid() = user_id);
create policy "users update own meals" on public.meals
  for update using (auth.uid() = user_id);
create policy "users delete own meals" on public.meals
  for delete using (auth.uid() = user_id);
