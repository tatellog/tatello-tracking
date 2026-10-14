-- =====================================================================
-- 2026-10-14 — profiles.analytics_opt_out (ST-008)
--
-- Interruptor de Ajustes para dejar de compartir el uso de la app
-- (analytics_events). Activa por defecto (decisión dueña 14 oct 2026:
-- la política de privacidad ya la declara); se guarda en el perfil para
-- que valga en todos los dispositivos. lib/analytics.ts track() la lee
-- antes de enviar cualquier evento.
--
-- Sin policy nueva: profiles ya filtra select/update por auth.uid() = id.
--
-- Revertir: alter table public.profiles drop column if exists analytics_opt_out;
-- =====================================================================

alter table public.profiles
  add column if not exists analytics_opt_out boolean not null default false;

comment on column public.profiles.analytics_opt_out is
  'true = la usuaria apagó la analítica de uso en Ajustes; track() no envía nada.';
