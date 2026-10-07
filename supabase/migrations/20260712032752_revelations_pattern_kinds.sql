-- Memoria de patrones · Fase 1 — Órbita Mes archiva sus patrones en el log
-- unificado `revelations` (tier='pattern') para que se vuelvan Historia aunque
-- salgan de la ventana rodante de ~31 días. docs/orbita-pattern-memory-spec.md.
--
-- Solo agrega KINDS nuevos al CHECK (superset del actual → ADITIVA: todas las
-- filas existentes siguen válidas). NO toca RLS ni el tier ('pattern' ya existe).
-- Un tier='pattern' ya aparece como marcador en "Tu constancia" (marksFromEvents
-- pinta transformation/return/pattern) → la superficie elegida, sin UI nueva.
--
-- Kinds nuevos (mapean 1:1 con detectores de _shared/intelligence, patrones que
-- POTENCIAN — Reliquias, no obstáculos):
--   rescue        — la dimensión que sostiene tu déficit (Ancla)
--   rising_signal — un cambio que emerge (Señal Naciente)
-- Los obstáculos (el día que rompe) NO se archivan por ahora: un marcador de
-- "día malo" en el calendario roza la culpa (manifiesto). Si se decide después,
-- se agrega su kind en otra migración.
--
-- La de-dup NO es "una vez por siempre" (a diferencia de milestones): un patrón
-- puede reaparecer tras 14 días de reposo. Por eso NO se crea índice único — el
-- writer maneja el reposo. Rate-limit y reposo viven en el writer, no en la DB.
--
-- Revertir (borrar filas con kinds nuevos primero para que el CHECK viejo valide):
--   delete from public.revelations where kind in ('rescue','rising_signal');
--   alter table public.revelations drop constraint if exists revelations_kind_check;
--   alter table public.revelations add constraint revelations_kind_check check (
--     kind in ('25','50','75','100','return','night_eating','protein_consistent',
--       'training_consistent','sleep_consistent','first_deficit','deficit_month',
--       'first_weight','first_workout'));

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
      -- pattern · memoria de Órbita Mes (Fase 1)
      'rescue', 'rising_signal',
      -- milestone (R3 · hitos de primera vez)
      'first_deficit', 'deficit_month', 'first_weight', 'first_workout'
    )
  );
