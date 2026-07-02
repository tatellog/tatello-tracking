-- =====================================================================
-- 2026-07-01 — daily_notes: la nota libre del check-in de "Cómo amaneciste"
--
-- Reemplaza el detalle de energía/motivación/calma (3 ejes) por una NOTA de
-- texto libre en la tarjeta de ánimo de Hoy. Una nota por día por usuaria
-- (PK compuesta user_id + note_date → upsert on conflict). `note_date` es el
-- día LOCAL de la usuaria (lo manda el cliente, como checkin_date en
-- mood_checkins), no UTC.
--
-- RLS: dueña por auth.uid() = user_id (select/insert/update/delete). FK a
-- auth.users con on delete cascade. Trigger de updated_at con función propia
-- (el proyecto NO tiene la extensión moddatetime; ver meal_hydration). CHECK de
-- longitud para atrapar basura sin juzgar.
--
-- Revertir: drop table public.daily_notes;
-- =====================================================================

create table if not exists public.daily_notes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  note_date  date not null,
  note       text not null check (char_length(note) >= 1 and char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, note_date)
);

alter table public.daily_notes enable row level security;

-- Idempotente para re-runs (local reset): PG no soporta CREATE POLICY IF NOT
-- EXISTS, así que drop-if-exists + create.
drop policy if exists "daily_notes_select_own" on public.daily_notes;
create policy "daily_notes_select_own" on public.daily_notes
  for select using (auth.uid() = user_id);
drop policy if exists "daily_notes_insert_own" on public.daily_notes;
create policy "daily_notes_insert_own" on public.daily_notes
  for insert with check (auth.uid() = user_id);
drop policy if exists "daily_notes_update_own" on public.daily_notes;
create policy "daily_notes_update_own" on public.daily_notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "daily_notes_delete_own" on public.daily_notes;
create policy "daily_notes_delete_own" on public.daily_notes
  for delete using (auth.uid() = user_id);

-- Función propia de updated_at (el repo no usa la extensión moddatetime).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_daily_notes_updated_at on public.daily_notes;
create trigger set_daily_notes_updated_at
  before update on public.daily_notes
  for each row execute function public.set_updated_at();
