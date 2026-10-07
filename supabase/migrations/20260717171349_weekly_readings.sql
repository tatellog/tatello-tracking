-- Lectura Semanal (roadmap V-05) — EL loop de retorno: una lectura
-- determinística por usuaria+semana cerrada (gasto real + ritmo + palanca),
-- escrita on-read-miss por la edge `weekly-reading` con el JWT de la
-- usuaria (RLS-scoped, sin service role) y LEÍDA por el cliente.
--
-- Inmutable una vez emitida (lo histórico no recalcula): el writer solo
-- inserta si no existe; el cliente solo marca opened_at (métrica norte
-- "Insights Opened per Week").
--
-- Revertir:
--   drop table if exists public.weekly_readings;

create table if not exists public.weekly_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Lunes de la semana leída (cerrada).
  week_start date not null,
  grade text not null check (grade in ('completa', 'parcial')),
  -- La WeeklyReading completa (weekly-reading.ts): beats + datos + palanca.
  payload jsonb not null check (pg_column_size(payload) <= 16384),
  -- Cuándo la usuaria la abrió (null = generada, aún no leída).
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table public.weekly_readings enable row level security;

-- Lectura: solo la dueña de la fila. (drop previo = idempotencia; PG no
-- tiene CREATE POLICY IF NOT EXISTS.)
drop policy if exists "weekly_readings_select_own" on public.weekly_readings;
create policy "weekly_readings_select_own"
  on public.weekly_readings for select
  using (auth.uid() = user_id);

-- Escritura: la edge corre con el JWT de la usuaria, así que el insert
-- también es suyo. WITH CHECK ata la fila a su uid.
drop policy if exists "weekly_readings_insert_own" on public.weekly_readings;
create policy "weekly_readings_insert_own"
  on public.weekly_readings for insert
  with check (auth.uid() = user_id);

-- Update: solo para marcar opened_at (la lectura es inmutable; el cliente
-- no reescribe payload — la app no lo hace y el trigger de abajo lo frena).
drop policy if exists "weekly_readings_update_own" on public.weekly_readings;
create policy "weekly_readings_update_own"
  on public.weekly_readings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Inmutabilidad dura: una vez emitida, solo opened_at puede cambiar.
create or replace function public.fn_weekly_readings_freeze()
returns trigger
language plpgsql
-- search_path sellado (advisor 0011): la fn solo toca NEW/OLD.
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.week_start is distinct from old.week_start
    or new.grade is distinct from old.grade
    or new.payload is distinct from old.payload
    or new.created_at is distinct from old.created_at then
    raise exception 'weekly_readings es inmutable: solo opened_at puede cambiar';
  end if;
  return new;
end;
$$;

create or replace trigger freeze_weekly_readings_before_update
  before update on public.weekly_readings
  for each row execute function public.fn_weekly_readings_freeze();

create index if not exists weekly_readings_user_week_idx
  on public.weekly_readings (user_id, week_start desc);
