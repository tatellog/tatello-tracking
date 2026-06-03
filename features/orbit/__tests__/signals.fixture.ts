/* Shared fixtures for the Semana logic + pattern tests. NOT a test file
 * (no `.test.` suffix), so jest's testMatch skips it. */
import type { DailySignals } from '../api'

/** A full `daily_signals` row — every column null except `day` and the
 *  overrides. The view is all-nullable, so this mirrors a real row. */
export function mkSig(day: string, o: Partial<DailySignals> = {}): DailySignals {
  return {
    user_id: 'test-user',
    day,
    calories: null,
    energy: null,
    meal_count: null,
    mood: null,
    motivation: null,
    on_period: null,
    protein_g: null,
    rested: null,
    sleep_minutes: null,
    sleep_quality: null,
    stress: null,
    trained: null,
    water_glasses: null,
    weight_kg: null,
    wellbeing_checkins: null,
    workout_type: null,
    ...o,
  }
}

/** A broadly-lit day → brightness ≈ 0.84. */
export const STRONG: Partial<DailySignals> = {
  trained: true,
  energy: 5,
  sleep_minutes: 450,
  sleep_quality: 5,
  mood: 'good',
  stress: 1,
  motivation: 5,
  meal_count: 3,
}

/** A middling day → brightness ≈ 0.58. */
export const MODERATE: Partial<DailySignals> = {
  energy: 4,
  sleep_minutes: 450,
  mood: 'neutral',
  stress: 3,
  motivation: 3,
  meal_count: 2,
}

/** A quiet, low day → brightness ≈ 0.27. */
export const LOW: Partial<DailySignals> = {
  energy: 1,
  sleep_minutes: 300,
  mood: 'bad',
  stress: 5,
  motivation: 1,
  meal_count: 1,
}

/** `YYYY-MM-DD`, n days after `base` (UTC, timezone-independent). */
export function addDays(base: string, n: number): string {
  const d = new Date(`${base}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Monday-first weekday index (0=L … 6=D) of a date string. */
export function monIdxUTC(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
}

/** Build `days` consecutive rows from `base`, choosing each day's signal
 *  by its Monday-first weekday + offset. Return null from `pick` to skip
 *  a day (no row, like an unlogged day). */
export function buildHistory(
  base: string,
  days: number,
  pick: (monIdx: number, i: number) => Partial<DailySignals> | null,
): DailySignals[] {
  const out: DailySignals[] = []
  for (let i = 0; i < days; i++) {
    const day = addDays(base, i)
    const o = pick(monIdxUTC(day), i)
    if (o) out.push(mkSig(day, o))
  }
  return out
}
