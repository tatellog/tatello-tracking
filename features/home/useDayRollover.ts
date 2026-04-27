import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { queryKeys } from '@/lib/queryKeys'

const ONE_MINUTE_MS = 60 * 1000

function todayLocalIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/*
 * Watches for midnight-rollover while the app is open. Once a minute
 * we compare the local-zoned 'YYYY-MM-DD' against the brief's
 * `currentDate` (server-computed in user tz, surfaced as ctx.date).
 * On mismatch we invalidate the brief query so today's tile state,
 * grid, and streak counter all rewind together — no stale "Hoy"
 * lingering past midnight.
 *
 * Cheap: a single setInterval, no tick on every render. Cleaned up
 * on unmount so HMR / nav transitions don't leak timers.
 */
export function useDayRollover(currentDate: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!currentDate) return
    const tick = () => {
      if (todayLocalIso() !== currentDate) {
        qc.invalidateQueries({ queryKey: queryKeys.brief.all })
      }
    }
    const id = setInterval(tick, ONE_MINUTE_MS)
    return () => clearInterval(id)
  }, [currentDate, qc])
}
