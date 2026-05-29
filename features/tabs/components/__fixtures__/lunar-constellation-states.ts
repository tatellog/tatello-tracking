/*
 * Shared fixtures for the LunarConstellation refactor safety net.
 * Used by both the Jest snapshot test and the dev-only
 * `/refactor-test` screen, so visual diffs and snapshot diffs run
 * against literally the same inputs.
 *
 * Lifetime: lives for the duration of the strangler-fig refactor.
 * Delete this folder + the test + the screen once F24 lands and the
 * old file has been replaced by the re-export.
 */

import type { ZodiacSign } from '../../zodiac/types'

export type ConstellationState = {
  /** Stable ID used as the deep-link segment and as the snapshot
   *  key — keep in sync with the file names used by visual-diff.sh. */
  id: string
  sign: ZodiacSign
  /** Human-readable label for the visual screen. */
  label: string
  stateName: 'empty' | 'partial' | 'halfway' | 'complete'
  trained: readonly boolean[]
  todayIdx: number
  committed: boolean
}

const SIGNS: readonly ZodiacSign[] = [
  'aries',
  'tauro',
  'geminis',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'escorpio',
  'sagitario',
  'capricornio',
  'acuario',
  'piscis',
]

function makeTrained(count: number): readonly boolean[] {
  return Array.from({ length: 28 }, (_, i) => i < count)
}

type Template = Omit<ConstellationState, 'id' | 'sign' | 'label'>

// Four states cover the meaningful branches of the render tree:
//   • empty     — nothing lit, first "next" star visible (placeholder layer).
//   • partial   — 7 lit + next visible (mid-figure, lit + next coexist).
//   • halfway   — 14 lit + committed (no next affordance, lit cluster aura).
//   • complete  — 28 lit (CompletionRings + COMPLETO cap).
//
// Stretch: extending this set is the cheapest way to catch regressions
// the existing 4 states miss. Add a new template here, regenerate
// snapshots + baseline screenshots.
const STATE_TEMPLATES: readonly Template[] = [
  { stateName: 'empty', trained: makeTrained(0), todayIdx: 0, committed: false },
  { stateName: 'partial', trained: makeTrained(7), todayIdx: 7, committed: false },
  { stateName: 'halfway', trained: makeTrained(14), todayIdx: 13, committed: true },
  { stateName: 'complete', trained: makeTrained(28), todayIdx: 27, committed: true },
] as const

export const LUNAR_CONSTELLATION_STATES: readonly ConstellationState[] = SIGNS.flatMap(
  (sign): ConstellationState[] =>
    STATE_TEMPLATES.map((tpl) => ({
      ...tpl,
      sign,
      id: `${sign}-${tpl.stateName}`,
      label: `${sign} · ${tpl.stateName}`,
    })),
)

export function findState(id: string): ConstellationState | undefined {
  return LUNAR_CONSTELLATION_STATES.find((s) => s.id === id)
}
