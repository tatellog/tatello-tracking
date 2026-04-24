import { useMemo } from 'react'

import { dayOfWeekEs, formatBriefTime, formatIsoDate } from '@/features/brief/format'
import type { BriefData } from '@/features/brief/types'
import { mockBriefData } from '@/mocks/briefData'

/*
 * The brief is a snapshot of 'when you opened it'. We capture `now` once per
 * mount (via `useMemo` with no deps) so the timestamp doesn't re-tick while
 * the screen is open — it should read as a stable editorial header, not a
 * live clock.
 */
export function useBriefData(): BriefData {
  const now = useMemo(() => new Date(), [])
  return {
    ...mockBriefData,
    date: formatIsoDate(now),
    dayOfWeek: dayOfWeekEs(now),
    time: formatBriefTime(now),
  }
}
