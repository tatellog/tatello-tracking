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
export const PATTERN_MESSAGES: Record<PatternType, string> = {
  night_eating:
    'Noté que las noches piden más. ¿Algo pasa después de las 9? No hay que arreglarlo hoy · solo verlo.',
  abandonment: 'Volviste. Eso es lo que importa. Tu cielo te esperó.',
}
