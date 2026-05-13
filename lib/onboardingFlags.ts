import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useState } from 'react'

const VISITED_DAY_ONE_KEY = '@app:visited_day_one'
const FRICTIONS_KEY = '@app:onboarding_frictions'
const SKIP_WEIGHT_KEY = '@app:onboarding_skip_weight'

/*
 * Tiny AsyncStorage flag that records whether the user has cleared
 * the Día 1 ceremony. The Bloque F route guard reads this to decide
 * whether to bounce a freshly-onboarded user back to /onboarding/day-one
 * the next time they open the app — so the celebration can't be
 * accidentally skipped by closing the app between Done and Home.
 *
 * AsyncStorage doesn't notify of writes, so we layer a small pub/sub
 * on top: mark / clear update the in-memory cache and broadcast to
 * every active useVisitedDayOne subscriber. Without this, the route
 * guard would read a stale `false` after markVisitedDayOne and bounce
 * the user right back to /onboarding/day-one — the exact loop we ran
 * into when Día 1's "Entrar a la app" CTA didn't actually exit.
 */

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

/*
 * Wipe the flag — called from sign-out so the next user's first
 * /(tabs) entry triggers Día 1 again.
 */
export async function clearVisitedDayOne() {
  await AsyncStorage.removeItem(VISITED_DAY_ONE_KEY)
  notify(false)
}

export async function readVisitedDayOne(): Promise<boolean> {
  return ensureLoaded()
}

/*
 * Norte onboarding — datos que el wizard captura pero que aún no
 * tienen columna propia en `profiles`:
 *
 *   • frictions: array de strings (lo que se le ha atravesado al
 *     usuario en otras apps). Entrena al coach. Hoy lo persistimos
 *     local; cuando el backend acepte el campo, este helper se
 *     reemplaza por una mutación de profile.
 *   • skipWeight: bandera indicando que el usuario no tenía báscula
 *     al onboarding. El brief la lee para mostrar "registra tu peso"
 *     como prompt en vez de tratar el null como dato faltante.
 */
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
