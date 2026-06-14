/*
 * Pattern detection — pure functions. No DB, no React. Each
 * detector takes the data it needs and returns whether the pattern
 * is present.
 *
 * Empathy guard: these detectors describe BEHAVIOUR, not diagnosis.
 * Never name a pattern with a clinical term in the codebase
 * ('binge', 'disorder', 'TCA') — the pattern keys map 1:1 to
 * messages.ts and surface to the user as observation, not verdict.
 *
 * TODO (deferred — see PRODUCT_MANIFESTO.md "Línea roja"):
 *   • Severe-restriction detector (≥ 4 weeks low intake) — route
 *     through a separate referral surface, not through the coach
 *     line in this file. This MVP intentionally has none.
 */

export const PATTERN_TYPES = [
  'night_eating',
  'abandonment',
  // Patrones positivos (T3) — celebran constancia. El conteo va al frente,
  // enmarcado "hacia arriba" (behavioral-specialist + spec Decisión #8).
  'protein_consistent',
  'training_consistent',
  'sleep_consistent',
] as const
export type PatternType = (typeof PATTERN_TYPES)[number]

/** Slim meal shape the night-eating detector needs. */
export type MealForDetect = { consumed_at: string }

const DAY_MS = 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * DAY_MS
// 22:00 (no 21:00) y 5 DÍAS distintos (no 2 comidas): el PRD sube el listón
// para que deje de marcar ruido normal (dos cenas tardías le pasan a
// cualquiera) y solo dispare ante un patrón genuino. 5/7 es el techo sano del
// noticing (behavioral-specialist) — más allá de eso es señal de derivación.
const NIGHT_HOUR = 22
const NIGHT_THRESHOLD_DAYS = 5

/** Clave de día local YYYY-MM-DD (los componentes locales, como getHours). */
function localDayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const ABANDONMENT_GAP_DAYS = 3

/** Días DISTINTOS (últimos 7) con al menos una comida registrada a las 22:00
 *  o más tarde (hora local). Cuenta días, no comidas — dos snacks una misma
 *  noche no inflan el conteo. El número alimenta el copy con conteos. */
export function nightEatingDayCount(
  meals: readonly MealForDetect[],
  now: Date = new Date(),
): number {
  const cutoff = now.getTime() - SEVEN_DAYS_MS
  const days = new Set<string>()
  for (const m of meals) {
    const d = new Date(m.consumed_at)
    if (d.getTime() < cutoff) continue
    if (d.getHours() >= NIGHT_HOUR) days.add(localDayKey(d))
  }
  return days.size
}

/** Fires si hubo comida después de las 22:00 en ≥ 5 días distintos (de 7). */
export function detectNightEating(
  meals: readonly MealForDetect[],
  now: Date = new Date(),
): boolean {
  return nightEatingDayCount(meals, now) >= NIGHT_THRESHOLD_DAYS
}

/** Fires the day the user returns after a ≥ 3-day gap. Input is a
 *  list of YYYY-MM-DD strings (distinct active days). Internal
 *  sort means callers don't need to pre-order. */
export function detectAbandonment(activeDays: readonly string[]): boolean {
  if (activeDays.length < 2) return false
  const sorted = [...activeDays].sort()
  const last = sorted[sorted.length - 1]!
  const prev = sorted[sorted.length - 2]!
  const gapDays = (new Date(last).getTime() - new Date(prev).getTime()) / DAY_MS
  return gapDays >= ABANDONMENT_GAP_DAYS
}
