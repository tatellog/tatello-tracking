-- =====================================================================
-- 2026-05-28 — error_logs: client-side crash log
--
-- Populated by components/ErrorBoundary.tsx when any descendant
-- throws. user_id ties the row to the affected user; screen tells
-- us where the crash happened. Append-only — no UPDATE / DELETE
-- policies. user_id is NOT NULL because the boundary skips the
-- insert when there's no session (pre-auth crashes have no owner
-- to RLS-scope to, and we'd rather drop those than create RLS
-- holes for anonymous inserts).
-- =====================================================================

create table public.error_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  error_message  text not null,
  stack          text,
  screen         text,
  created_at     timestamptz not null default now()
);

create index error_logs_user_date_idx
  on public.error_logs (user_id, created_at desc);

alter table public.error_logs enable row level security;

create policy "users insert own error_logs" on public.error_logs
  for insert with check (auth.uid() = user_id);

create policy "users read own error_logs" on public.error_logs
  for select using (auth.uid() = user_id);
