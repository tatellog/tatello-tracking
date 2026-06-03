import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

import { todayInTimezone } from '@/lib/time'

import type { DailySignals } from './api'
import {
  DAILY_READING_VARIANTS,
  dailyReadingCategory,
  REPEATABLE_READINGS,
  type DailyReadingCategory,
} from './logic'

/*
 * The Día's daily reading — picks today's category (deterministic), then
 * applies a cooldown so it never becomes noise:
 *   - Stable within the day (no flicker on re-render).
 *   - A low-value category that would repeat the next day is silenced
 *     (returns null) — "una lectura que aparece menos, pesa más". The
 *     high-value ones (REPEATABLE_READINGS) always show.
 *   - Rotates variants so the exact same line doesn't reappear.
 * Returns null while loading or when silenced.
 */
const KEY = '@app:daily_reading'

type Snap = { date: string; category: DailyReadingCategory; line: string | null }

export function useDailyReading(args: {
  signals: DailySignals | null
  ready: boolean
  isPrePeriod: boolean
  proteinTarget: number | null
  calorieTarget: number | null
}): string | null {
  const { signals, ready, isPrePeriod, proteinTarget, calorieTarget } = args
  const [line, setLine] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    const today = todayInTimezone()
    const category = dailyReadingCategory(signals, { isPrePeriod, proteinTarget, calorieTarget })
    let alive = true
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!alive) return
        const snap = raw ? (JSON.parse(raw) as Snap) : null
        // Already decided today — keep it stable, don't recompute.
        if (snap && snap.date === today && snap.category === category) {
          setLine(snap.line)
          return
        }
        let next: string | null
        if (snap && snap.category === category && !REPEATABLE_READINGS.includes(category)) {
          // Same low-value reading as last time → stay quiet today.
          next = null
        } else {
          const variants = DAILY_READING_VARIANTS[category]
          const fresh = variants.filter((v) => v !== snap?.line)
          const pool = fresh.length > 0 ? fresh : variants
          next = pool[Math.floor(Math.random() * pool.length)] ?? pool[0] ?? null
        }
        setLine(next)
        void AsyncStorage.setItem(KEY, JSON.stringify({ date: today, category, line: next }))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [ready, signals, isPrePeriod, proteinTarget, calorieTarget])

  return line
}
