-- Recuperada del historial remoto (supabase_migrations.schema_migrations, 7 oct
-- 2026): se aplicó en producción sin archivo en el repo.

-- Sella el search_path del trigger de inmutabilidad (advisor 0011): la fn
-- solo toca NEW/OLD, no resuelve nombres, así que el path vacío es seguro.
alter function public.fn_weekly_readings_freeze() set search_path = '';
