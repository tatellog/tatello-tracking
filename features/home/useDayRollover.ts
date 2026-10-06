import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState } from 'react-native'

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
 *
 * También revisa AL MONTAR y al VOLVER la app al frente (6 oct 2026): iOS
 * pausa el intervalo en segundo plano, así que al abrir la app pasada la
 * medianoche Hoy seguía hasta un minuto con el día viejo, y una comida
 * registrada en ese lapso caía en el día nuevo sin verse.
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
    tick()
    const id = setInterval(tick, ONE_MINUTE_MS)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick()
    })
    return () => {
      clearInterval(id)
      sub.remove()
    }
  }, [currentDate, qc])
}
