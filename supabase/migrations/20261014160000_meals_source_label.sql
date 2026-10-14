-- =====================================================================
-- 2026-10-14 — meals.source admite 'label' (ST-004 · H6)
--
-- La app ya distingue de dónde sale una comida: a mano ('manual'), foto de
-- plato ('photo_ai'), texto ('text_ai') y ahora foto de ETIQUETA ('label').
-- Antes todo se guardaba 'manual'. Solo se amplía el check; sin columnas ni
-- policies nuevas (las de meals por auth.uid() = user_id siguen igual).
--
-- Revertir (las filas 'label' vuelven a 'manual' primero):
--   update public.meals set source = 'manual' where source = 'label';
--   alter table public.meals drop constraint if exists meals_source_check;
--   alter table public.meals add constraint meals_source_check
--     check (source in ('manual', 'photo_ai', 'text_ai'));
-- =====================================================================

alter table public.meals drop constraint if exists meals_source_check;
alter table public.meals add constraint meals_source_check
  check (source in ('manual', 'photo_ai', 'text_ai', 'label'));
