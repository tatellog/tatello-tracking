import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

// The daily water goal — set in litres, drunk in fixed 250 ml glasses, so
// the number of glasses = goal / 250 (2 L → 8, 3 L → 12). Stored LOCALLY
// for now (no DB round-trip); promote to a profiles column when we're
// ready to push schema. The consumed count still lives in `water_intake`.
const KEY = '@app:water_goal_ml'

export const GLASS_ML = 250
const DEFAULT_GOAL_ML = 2000
export const MIN_GOAL_ML = 1000
export const MAX_GOAL_ML = 4000
export const GOAL_STEP_ML = 250

export function useWaterGoal(): { goalMl: number; updateGoal: (ml: number) => void } {
  const [goalMl, setGoalMl] = useState(DEFAULT_GOAL_ML)

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const n = raw ? Number(raw) : NaN
        if (Number.isFinite(n) && n >= MIN_GOAL_ML && n <= MAX_GOAL_ML) setGoalMl(n)
      })
      .catch(() => {})
  }, [])

  const updateGoal = (ml: number) => {
    const clamped = Math.min(MAX_GOAL_ML, Math.max(MIN_GOAL_ML, ml))
    setGoalMl(clamped)
    AsyncStorage.setItem(KEY, String(clamped)).catch(() => {})
  }

  return { goalMl, updateGoal }
}

/** Litres as a short label: 750 → "0.75", 2000 → "2". */
export function mlToLitresLabel(ml: number): string {
  return String(Math.round((ml / 1000) * 100) / 100)
}
