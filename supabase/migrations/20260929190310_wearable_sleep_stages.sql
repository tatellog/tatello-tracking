-- =====================================================================
-- wearable_sleep · etapas de la noche (detalle de sueño en Hoy)
--
-- Salud entrega la noche por etapas (profundo, ligero/core, REM, despierta).
-- Hasta hoy se sumaban en asleep_minutes y se descartaban; estas columnas
-- guardan el desglose para la pantalla de detalle. Nullables: NULL = la
-- fuente no dio etapas (solo "dormida" sin detalle) o noche previa a esta
-- migración. asleep_minutes sigue siendo el total canónico (daily_signals
-- no cambia).
--
-- Tabla existente con RLS y policies auth.uid() = user_id: sin cambios de
-- seguridad.
--
-- Revertir:
--   alter table public.wearable_sleep
--     drop column if exists deep_minutes,
--     drop column if exists core_minutes,
--     drop column if exists rem_minutes,
--     drop column if exists awake_minutes;
-- =====================================================================

alter table public.wearable_sleep
  add column if not exists deep_minutes integer
    check (deep_minutes is null or (deep_minutes >= 0 and deep_minutes <= 1440)),
  add column if not exists core_minutes integer
    check (core_minutes is null or (core_minutes >= 0 and core_minutes <= 1440)),
  add column if not exists rem_minutes integer
    check (rem_minutes is null or (rem_minutes >= 0 and rem_minutes <= 1440)),
  add column if not exists awake_minutes integer
    check (awake_minutes is null or (awake_minutes >= 0 and awake_minutes <= 1440));
