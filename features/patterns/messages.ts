import type { PatternType } from './logic'

/*
 * Coach messages for each detected pattern. Voice is Cormorant
 * italic (the coach voice), warm, empathic, never corrective —
 * see PRODUCT_MANIFESTO.md "Voz de la marca". The card that
 * renders these (PatternObservation.tsx) applies the typography;
 * the strings here stay plain text.
 *
 * Rules:
 *   • No clinical vocabulary (atracón, trastorno, disorder, TCA).
 *   • No imperatives ("debes…", "tienes que…").
 *   • Observation, not verdict.
 */
// Copy BASE (sin conteo). El reveal del orquestador usa la versión CON
// conteo de `features/revelations/logic.ts` → patternRevelationCopy; estas
// quedan como base / fallback de las superficies legacy.
export const PATTERN_MESSAGES: Record<PatternType, string> = {
  night_eating: 'Las noches piden más esta semana. No hay que arreglarlo hoy · solo verlo.',
  abandonment: 'Volviste. Eso es lo que importa. Tu cielo te esperó.',
  protein_consistent: 'La proteína apareció de forma constante esta semana.',
  training_consistent: 'Esta semana encontraste un ritmo de movimiento.',
  sleep_consistent: 'Tu sueño fue más estable esta semana.',
}
