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

export const PATTERN_TYPES = ['night_eating', 'abandonment'] as const
export type PatternType = (typeof PATTERN_TYPES)[number]

/** Slim meal shape the night-eating detector needs. */
export type MealForDetect = { consumed_at: string }

const DAY_MS = 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * DAY_MS
const NIGHT_HOUR = 21
const NIGHT_THRESHOLD = 2
const ABANDONMENT_GAP_DAYS = 3

/** Fires if the user logged ≥ 2 meals after 21:00 (local hour, per
 *  the timestamp's local components) in the last 7 days. */
export function detectNightEating(
  meals: readonly MealForDetect[],
  now: Date = new Date(),
): boolean {
  const cutoff = now.getTime() - SEVEN_DAYS_MS
  let count = 0
  for (const m of meals) {
    const d = new Date(m.consumed_at)
    if (d.getTime() < cutoff) continue
    if (d.getHours() >= NIGHT_HOUR) {
      count += 1
      if (count >= NIGHT_THRESHOLD) return true
    }
  }
  return false
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
