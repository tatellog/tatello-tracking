-- =====================================================================
-- 2026-05-28 — detected_patterns: empathic observation log
--
-- Populated by features/patterns/hooks.ts when a detector fires.
-- One row per detection. The shown_to_user flag flips when the
-- user dismisses the card so the same pattern isn't re-surfaced
-- back-to-back. Rate-limit is enforced client-side: max one row
-- per user per day (the hook checks before inserting).
--
-- IMPORTANT: this table is OBSERVATIONAL, not diagnostic. Pattern
-- names map to messages in features/patterns/messages.ts written
-- in the coach's empathic voice — see PRODUCT_MANIFESTO.md
-- "feature core" + "línea roja".
-- =====================================================================

create table public.detected_patterns (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  pattern_type   text not null,
  detected_at    timestamptz not null default now(),
  shown_to_user  boolean not null default false,
  metadata       jsonb not null default '{}'::jsonb
);

create index detected_patterns_user_date_idx
  on public.detected_patterns (user_id, detected_at desc);

alter table public.detected_patterns enable row level security;

create policy "users read own detected_patterns" on public.detected_patterns
  for select using (auth.uid() = user_id);

create policy "users insert own detected_patterns" on public.detected_patterns
  for insert with check (auth.uid() = user_id);

create policy "users update own detected_patterns" on public.detected_patterns
  for update using (auth.uid() = user_id);
