/*
 * Tu Cielo Nutricional — protein-as-moon-phase mapping.
 *
 * Pure + deterministic so the phase, label and coach caption are
 * unit-testable instead of eyeballed in the simulator. The continuous
 * `moonIllumination` fraction drives the animated shadow mask in
 * NutritionMoon; the discrete `moonPhase` drives the words.
 *
 * Manifesto-safe BY CONSTRUCTION: every caption is framed as GROWTH
 * ("tu luna crece"), never as deficit, guilt or "te falta X". Reaching
 * or passing the reference is celebrated (luna llena), never "te
 * pasaste". This screen registers and reinforces — it never scores.
 */

export type MoonPhaseKey = 'nueva' | 'creciente' | 'cuarto' | 'gibosa' | 'llena'

export type MoonPhase = {
  key: MoonPhaseKey
  /** Canonical phase emoji — kept for completeness/tests; the UI shows
   *  the real crossfaded moon-phase images, not the glyph. */
  emoji: string
  label: string
  /** Coach voice (serif italic in the UI). Growth-framed, never guilt. */
  caption: string
}

/** Illuminated fraction = protein ÷ reference. `null` when there is no
 *  reference set (the moon then renders ambient, no %). Can exceed 1 —
 *  that's a full moon, a good thing, never an overflow to scold. */
export function moonIllumination(protein: number, reference: number | null): number | null {
  if (reference == null || reference <= 0) return null
  return Math.max(0, protein / reference)
}

/** Map an illumination fraction (0..1+) to its phase. Bands are centred
 *  on the canonical anchors 0 / 25 / 50 / 75 / 100 %. */
export function moonPhase(fraction: number): MoonPhase {
  const f = Math.max(0, fraction)
  if (f < 0.05) {
    return { key: 'nueva', emoji: '🌑', label: 'Luna Nueva', caption: 'Tu cielo está por nacer.' }
  }
  if (f < 0.375) {
    return {
      key: 'creciente',
      emoji: '🌒',
      label: 'Creciente',
      caption: 'Tu luna empieza a crecer.',
    }
  }
  if (f < 0.625) {
    return {
      key: 'cuarto',
      emoji: '🌓',
      label: 'Cuarto Creciente',
      caption: 'Tu luna va tomando luz.',
    }
  }
  if (f < 0.95) {
    return { key: 'gibosa', emoji: '🌔', label: 'Gibosa', caption: 'Tu luna sigue creciendo.' }
  }
  return { key: 'llena', emoji: '🌕', label: 'Luna Llena', caption: 'Tu luna está llena.' }
}

/**
 * Copy del hero: una frase de fase (cómo se SIENTE el avance) + una línea
 * HONESTA de progreso (cuánto falta, en gramos). El usuario pidió honestidad —
 * no una frase poética vaga. La frase celebra crecimiento; la honesta da el
 * número claro. Al alcanzar/pasar la referencia, la luna está llena (sin
 * "faltan", sin "te pasaste").
 */
export function moonProgressCopy(
  protein: number,
  reference: number | null,
): { phrase: string; honest: string | null } {
  if (reference == null || reference <= 0) {
    return { phrase: 'Tu luna de hoy se va dibujando.', honest: null }
  }
  const pct = Math.max(0, protein / reference)
  const remaining = Math.max(0, Math.round(reference - protein))

  // En CERO no hay honestidad que dar: "Faltan 160 g" a las 4pm sin nada
  // registrado se lee como montaña, no como invitación (target-user). El
  // faltante exacto vuelve con el primer gramo, cuando ya es progreso.
  if (protein <= 0) {
    return {
      phrase: 'Tu luna apenas despierta.',
      honest: 'Tu primera comida empieza a encenderla.',
    }
  }

  let phrase: string
  if (pct < 0.25) phrase = 'Tu luna apenas despierta.'
  else if (pct < 0.5) phrase = 'Tu luna va tomando luz.'
  else if (pct < 0.75) phrase = 'Ya puedes verla crecer.'
  else if (pct < 1) phrase = 'Está casi completa.'
  else phrase = 'Tu luna brilla completa.'

  // Honestidad: el faltante exacto. Al completar (o pasar) → no hay faltante;
  // la frase ya celebra la luna llena.
  const honest = remaining > 0 ? `Faltan ${remaining} g para completar tu luna.` : null

  return { phrase, honest }
}
