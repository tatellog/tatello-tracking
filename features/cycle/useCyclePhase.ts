import { type CycleSituation } from '@/features/profile/api'
import { useProfile } from '@/features/profile/hooks'
import { useLastPeriodStart } from '@/features/progress/hooks'

import {
  ACTIVE_CYCLE_SITUATIONS,
  cyclePhaseFromPeriod,
  DEFAULT_CYCLE_LENGTH,
  type CyclePhase,
} from './phase'

/*
 * The user's current cycle phase + day-in-cycle, or null when there
 * is no phase to speak of: an inactive situation (pregnant /
 * postmenopause / not tracking), or no period date anchored yet.
 *
 * Single source of cycle-phase truth for any screen that wants to
 * adapt to it — e.g. the Comidas tab normalising luteal-phase
 * appetite instead of treating it as drift.
 */
export function useCyclePhase(): { day: number; phase: CyclePhase } | null {
  const { data: profile } = useProfile()
  const { data: lastPeriod } = useLastPeriodStart()

  const situation = profile?.cycle_situation as CycleSituation | null | undefined
  if (!situation || !ACTIVE_CYCLE_SITUATIONS.includes(situation)) return null

  return cyclePhaseFromPeriod(lastPeriod, profile?.cycle_length_days ?? DEFAULT_CYCLE_LENGTH)
}
