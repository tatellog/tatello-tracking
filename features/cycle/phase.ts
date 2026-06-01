import { type CycleSituation } from '@/features/profile/api'

export type CyclePhase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lutea'

/** Visible phase labels in lenguaje de EXPERIENCIA — never the clinical
 *  terms ("lútea"/"folicular" read as a pregnancy app, off-limits per
 *  cycle-voice-spec). Single source for every surface that shows a phase
 *  to the user (Progreso CycleCard, the Hoy slider). The engine keeps the
 *  clinical keys internally. */
export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Tu período',
  folicular: 'Primera mitad',
  ovulatoria: 'Mitad del ciclo',
  lutea: 'Semana antes',
}

// Cycle situations that have an active monthly cycle. Pregnant /
// postmenopause / not-tracking have no phase.
export const ACTIVE_CYCLE_SITUATIONS: readonly CycleSituation[] = [
  'menstruates',
  'contraception',
  'irregular',
]

export const DEFAULT_CYCLE_LENGTH = 28
const DAY_MS = 24 * 60 * 60 * 1000

/*
 * Rough phase split — the same conventional bands a paper chart
 * uses. We're not predicting ovulation precisely, just naming where
 * the user sits in the arc:
 *   Menstrual  — days 1–5
 *   Folicular  — day 6 → just before the ovulatory window
 *   Ovulatoria — a 4-day window centred near mid-cycle
 *   Lútea      — the rest, until the next period
 */
export function phaseForDay(day: number, length: number): CyclePhase {
  if (day <= 5) return 'menstrual'
  const ovStart = Math.floor(length / 2) - 2
  const ovEnd = ovStart + 4
  if (day < ovStart) return 'folicular'
  if (day <= ovEnd) return 'ovulatoria'
  return 'lutea'
}

/*
 * Current day-in-cycle + phase, derived from the last period_start
 * date. Wraps into the current cycle in case several cycles passed
 * without a fresh start being logged. Returns null when there's no
 * anchor date to compute from.
 */
export function cyclePhaseFromPeriod(
  lastPeriodIso: string | null | undefined,
  cycleLength: number,
): { day: number; phase: CyclePhase } | null {
  if (!lastPeriodIso) return null
  const startMs = new Date(lastPeriodIso).getTime()
  if (Number.isNaN(startMs)) return null
  const elapsed = Math.floor((Date.now() - startMs) / DAY_MS)
  const day = (((elapsed % cycleLength) + cycleLength) % cycleLength) + 1
  return { day, phase: phaseForDay(day, cycleLength) }
}
