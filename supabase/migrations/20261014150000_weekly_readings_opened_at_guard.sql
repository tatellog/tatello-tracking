-- =====================================================================
-- 2026-10-14 — weekly_readings: opened_at solo se marca una vez (ST-010)
--
-- La policy de update deja a la usuaria escribir su propia fila, y el
-- trigger de inmutabilidad solo protegía payload/grade/semana: opened_at
-- (la métrica "Insights Opened per Week") se podía volver a null o poner
-- en cualquier fecha. Ahora:
--   · insert: opened_at nace null (la lectura se genera sin abrir).
--   · update: opened_at solo pasa de null a "ahora" (lo fija el servidor,
--     no el valor que mande el cliente) y ya no cambia.
-- Sin policy nueva: las de select/insert/update por auth.uid() siguen igual.
-- Limitación: el trigger de insert aplica también a service role; un backfill
-- o seed no puede insertar lecturas ya abiertas (se marcan con un update).
--
-- Revertir: volver a crear fn_weekly_readings_freeze como en
-- 20260717171349_weekly_readings.sql (con search_path vacío) y
--   drop trigger if exists reset_weekly_readings_opened_before_insert on public.weekly_readings;
--   drop function if exists public.fn_weekly_readings_opened_null();
-- =====================================================================

create or replace function public.fn_weekly_readings_freeze()
returns trigger
language plpgsql
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
  if old.opened_at is not null then
    -- Ya abierta: la marca no se mueve ni se borra.
    new.opened_at := old.opened_at;
  elsif new.opened_at is not null then
    -- Primera apertura: la hora la pone el servidor.
    new.opened_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.fn_weekly_readings_opened_null()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.opened_at := null;
  return new;
end;
$$;

drop trigger if exists reset_weekly_readings_opened_before_insert on public.weekly_readings;
create trigger reset_weekly_readings_opened_before_insert
  before insert on public.weekly_readings
  for each row execute function public.fn_weekly_readings_opened_null();
