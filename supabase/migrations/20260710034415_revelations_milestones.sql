-- Epic 03 · F-R3 · T-R3.1 — hitos ("Historia") en el log `revelations`.
--
-- R3 (Progress) reusa el log unificado de Revelaciones en vez de crear un
-- timeline paralelo. Se agrega un tier NUEVO `milestone` con hitos de "primera
-- vez" determinísticos (primer déficit, un mes en déficit, primer pesaje, primer
-- entreno). Los detecta un motor puro (_shared/intelligence/milestones.ts) y los
-- escribe un writer GATEADO (flag MILESTONES_ENABLED, hoy OFF).
--
-- SEGURIDAD / gating: los dos consumidores en vivo de `revelations` ignoran los
-- tiers desconocidos POR CONSTRUCCIÓN — `selectRevelation` (ceremonias de Hoy)
-- computa T1/T2/T3 desde señales en vivo (no lee filas guardadas para elegir), y
-- `marksFromEvents` (calendario) solo pinta transformation/return/pattern. Un
-- `tier='milestone'` aparece SOLO en `listRevelations` (la futura Historia). Cero
-- impacto en las 6 usuarias.
--
-- El CHECK nuevo es SUPERSET del viejo → todas las filas existentes siguen
-- válidas. ADITIVA. Revertir:
--   drop index if exists public.revelations_milestone_once_idx;
--   alter table public.revelations drop constraint if exists revelations_tier_check;
--   alter table public.revelations add constraint revelations_tier_check
--     check (tier in ('transformation','return','pattern'));
--   (idem revelations_kind_check con el set viejo)

alter table public.revelations drop constraint if exists revelations_tier_check;
alter table public.revelations
  add constraint revelations_tier_check
  check (tier in ('transformation', 'return', 'pattern', 'milestone'));

alter table public.revelations drop constraint if exists revelations_kind_check;
alter table public.revelations
  add constraint revelations_kind_check
  check (
    kind in (
      -- transformation
      '25', '50', '75', '100',
      -- return
      'return',
      -- pattern
      'night_eating', 'protein_consistent', 'training_consistent', 'sleep_consistent',
      -- milestone (R3 · hitos de primera vez)
      'first_deficit', 'deficit_month', 'first_weight', 'first_workout'
    )
  );

-- Cada hito se registra UNA vez por usuaria (como los umbrales de transformación).
-- El writer inserta con on conflict do nothing → duplicado = no-op silencioso.
create unique index if not exists revelations_milestone_once_idx
  on public.revelations (user_id, kind)
  where tier = 'milestone';
