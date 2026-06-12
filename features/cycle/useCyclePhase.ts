import { useProfile } from '@/features/profile/hooks'
import { useLastPeriodStart } from '@/features/progress/hooks'

import { cyclePhaseFromPeriod, DEFAULT_CYCLE_LENGTH, isCycleActive, type CyclePhase } from './phase'

/*
 * The user's current cycle phase + day-in-cycle, or null when there
 * is no phase to speak of: an inactive situation (pregnant /
 * postmenopause / not tracking), or no period date anchored yet.
 *
 * Single source of cycle-phase truth for any screen that wants to
 * adapt to it — e.g. the Comidas tab normalising luteal-phase
 * appetite instead of treating it as drift.
 */
export function useCyclePhase(): {
  day: number
  phase: CyclePhase
  length: number
  daysToNext: number
} | null {
  const { data: profile } = useProfile()
  const { data: lastPeriod } = useLastPeriodStart()

  // La regla de visibilidad vive en cycle-gate.ts (compartida con el
  // engine de Órbita y la Edge Function): nunca para hombres, ni para
  // mujeres sin menstruación activa.
  if (!isCycleActive(profile?.biological_sex, profile?.cycle_situation)) return null

  const length = profile?.cycle_length_days ?? DEFAULT_CYCLE_LENGTH
  const cp = cyclePhaseFromPeriod(lastPeriod, length)
  if (!cp) return null
  return { day: cp.day, phase: cp.phase, length, daysToNext: length - cp.day + 1 }
}
