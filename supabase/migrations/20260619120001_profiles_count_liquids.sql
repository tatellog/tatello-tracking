-- =====================================================================
-- 2026-06-19 — profiles.count_liquids_from_meals
--
-- Toggle de Ajustes: "Contar líquidos registrados como hidratación".
-- ON por defecto — Stelar detecta bebidas en las comidas y propone
-- sumarlas al agua del día (siempre con confirmación, ver meal_hydration).
-- Cuando está OFF, el flujo de registro de comida no ofrece la detección.
--
-- No necesita policy nueva: profiles ya tiene RLS por auth.uid() = id.
--
-- Reversa: alter table public.profiles drop column count_liquids_from_meals;
-- =====================================================================

alter table public.profiles
  add column if not exists count_liquids_from_meals boolean not null default true;
