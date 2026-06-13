import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useSyncExternalStore } from 'react'

// The daily water goal — set in litres, drunk in fixed 250 ml glasses, so
// the number of glasses = goal / 250 (2 L → 8, 3 L → 12). Stored LOCALLY
// for now (no DB round-trip); promote to a profiles column when we're
// ready to push schema. The consumed count still lives in `water_intake`.
//
// Shared external store (not per-hook useState): the goal is edited from
// BOTH Settings ("Tu ritual de agua") and the QuickLog stepper. With
// per-instance state, changing it in one surface left the other stale
// until remount; useSyncExternalStore keeps every caller on one value.
const KEY = '@app:water_goal_ml'

export const GLASS_ML = 250
const DEFAULT_GOAL_ML = 2000
export const MIN_GOAL_ML = 1000
export const MAX_GOAL_ML = 4000
export const GOAL_STEP_ML = 250

const clampGoal = (ml: number): number => Math.min(MAX_GOAL_ML, Math.max(MIN_GOAL_ML, ml))

let goalCache = DEFAULT_GOAL_ML
let hydrated = false
// Una edición del usuario gana sobre la hidratación: si toca antes de que
// el read de AsyncStorage resuelva, no lo pisamos con el valor viejo.
let touched = false
const listeners = new Set<() => void>()

function setGoalInternal(ml: number) {
  const next = clampGoal(ml)
  if (next === goalCache) return
  goalCache = next
  for (const l of listeners) l()
}

function hydrateOnce() {
  if (hydrated) return
  hydrated = true
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (touched) return
      const n = raw ? Number(raw) : NaN
      if (Number.isFinite(n) && n >= MIN_GOAL_ML && n <= MAX_GOAL_ML) setGoalInternal(n)
    })
    .catch(() => {})
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function useWaterGoal(): { goalMl: number; updateGoal: (ml: number) => void } {
  const goalMl = useSyncExternalStore(
    subscribe,
    () => goalCache,
    () => goalCache,
  )

  useEffect(() => {
    hydrateOnce()
  }, [])

  const updateGoal = (ml: number) => {
    const clamped = clampGoal(ml)
    touched = true
    setGoalInternal(clamped)
    AsyncStorage.setItem(KEY, String(clamped)).catch(() => {})
  }

  return { goalMl, updateGoal }
}

/** Litres as a short label: 750 → "0.75", 2000 → "2". */
export function mlToLitresLabel(ml: number): string {
  return String(Math.round((ml / 1000) * 100) / 100)
}
