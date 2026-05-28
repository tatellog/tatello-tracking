-- =====================================================================
-- 2026-05-28 — beta_feedback: in-app feedback capture for beta cohort
--
-- Populated by components/BetaFeedbackSheet.tsx — a discreet button
-- visible only to is_beta users. The screen field carries the
-- expo-router pathname captured at open time so we can read "where
-- was she when she said this" without asking.
--
-- CHECK on message length: at least 1 char, max 2000 (~half-page).
-- Anything longer is probably an accidental paste; the input itself
-- caps at the same bound.
-- =====================================================================

create table public.beta_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  message     text not null check (length(message) > 0 and length(message) <= 2000),
  screen      text,
  created_at  timestamptz not null default now()
);

create index beta_feedback_user_date_idx
  on public.beta_feedback (user_id, created_at desc);

alter table public.beta_feedback enable row level security;

create policy "users read own beta_feedback" on public.beta_feedback
  for select using (auth.uid() = user_id);

create policy "users insert own beta_feedback" on public.beta_feedback
  for insert with check (auth.uid() = user_id);
