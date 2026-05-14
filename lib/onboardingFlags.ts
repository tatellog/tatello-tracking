import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

const VISITED_DAY_ONE_KEY = '@app:visited_day_one'
const FRICTIONS_KEY = '@app:onboarding_frictions'
const SKIP_WEIGHT_KEY = '@app:onboarding_skip_weight'

// The Día 1 flag persists in AsyncStorage but AsyncStorage doesn't
// notify on writes. The pub/sub layer below keeps useVisitedDayOne
// in sync after markVisitedDayOne — without it the route guard reads
// a stale `false` and bounces the user back into /onboarding/day-one.

let cachedValue: boolean | null = null
let inFlight: Promise<boolean> | null = null
const listeners = new Set<(value: boolean | null) => void>()

function notify(value: boolean | null) {
  cachedValue = value
  listeners.forEach((listen) => listen(value))
}

async function ensureLoaded(): Promise<boolean> {
  if (cachedValue !== null) return cachedValue
  if (!inFlight) {
    inFlight = AsyncStorage.getItem(VISITED_DAY_ONE_KEY).then((raw) => {
      const next = raw === 'true'
      cachedValue = next
      inFlight = null
      return next
    })
  }
  return inFlight
}

export async function markVisitedDayOne() {
  await AsyncStorage.setItem(VISITED_DAY_ONE_KEY, 'true')
  notify(true)
}

export async function clearVisitedDayOne() {
  await AsyncStorage.removeItem(VISITED_DAY_ONE_KEY)
  notify(false)
}

export async function readVisitedDayOne(): Promise<boolean> {
  return ensureLoaded()
}

// Captured during onboarding but no column for them on `profiles` yet —
// stored locally until the schema grows the fields.
export async function saveFrictions(frictions: readonly string[]): Promise<void> {
  await AsyncStorage.setItem(FRICTIONS_KEY, JSON.stringify(frictions))
}

export async function readFrictions(): Promise<readonly string[]> {
  const raw = await AsyncStorage.getItem(FRICTIONS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export async function saveSkipWeight(skip: boolean): Promise<void> {
  await AsyncStorage.setItem(SKIP_WEIGHT_KEY, skip ? 'true' : 'false')
}

export async function readSkipWeight(): Promise<boolean> {
  return (await AsyncStorage.getItem(SKIP_WEIGHT_KEY)) === 'true'
}

export function useVisitedDayOne(): boolean | null {
  const [visited, setVisited] = useState<boolean | null>(cachedValue)

  useEffect(() => {
    listeners.add(setVisited)
    if (cachedValue === null) {
      ensureLoaded()
        .then((value) => setVisited(value))
        .catch(() => setVisited(false))
    }
    return () => {
      listeners.delete(setVisited)
    }
  }, [])

  return visited
}
