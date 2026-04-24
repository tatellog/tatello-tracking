import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

const ONE_HOUR_MS = 60 * 60 * 1000
const STORAGE_KEY = 'tracking-app.home.last_open'

export type Cadence = 'cascade' | 'reduced'

/*
 * Decides which entrance animation to play when the Home mounts.
 *
 *   cascade  — first open of the hour. Runs the full ~2.3 s
 *              choreographed entrance (header → card → chain).
 *   reduced  — opened again within 60 min. Uniform 250 ms fade for
 *              every block, no delays. Keeps quick re-opens feeling
 *              instant rather than ceremonious.
 *
 * Returns null until the decision is made (AsyncStorage read
 * resolves). Callers should render a skeleton during that window
 * so the animation isn't partially applied mid-decision.
 */
export function useHomeCadence(): Cadence | null {
  const [cadence, setCadence] = useState<Cadence | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const last = await AsyncStorage.getItem(STORAGE_KEY)
        const now = Date.now()
        const recent = last != null && now - Number(last) < ONE_HOUR_MS
        if (active) setCadence(recent ? 'reduced' : 'cascade')
        // Fire-and-forget: the next open's decision uses this value.
        AsyncStorage.setItem(STORAGE_KEY, String(now)).catch(() => {})
      } catch {
        if (active) setCadence('cascade')
      }
    })()
    return () => {
      active = false
    }
  }, [])

  return cadence
}
