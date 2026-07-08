/*
 * Wearables — orquestación React (conexión + sync foreground-first).
 *
 * El sync es una PIPA DE ESCRITURA: lee HealthKit → normaliza (logic) →
 * upserta (api). Órbita, el multiring y el motor no importan nada de aquí;
 * siguen leyendo daily_signals (spec §2). Foreground-first con ventana de
 * re-consulta de 7 días en cada apertura: el dato tardío del reloj (el sueño
 * aterriza horas después) completa solo, sin background delivery (spec §5).
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { useSession } from '@/hooks/useSession'
import { track } from '@/lib/analytics'
import { queryKeys } from '@/lib/queryKeys'
import { userTimezone } from '@/lib/time'

import { upsertWearableSleep, upsertWearableSteps, upsertWearableWorkouts } from './api'
import {
  isHealthKitAvailable,
  readDailySteps,
  readSleepSamples,
  readWorkouts,
  requestHealthKitAuthorization,
} from './healthkit'
import { normalizeWorkout, sleepSamplesToRows, stepsToRows } from './logic'

/* Flag de conexión POR USUARIA (no por device): dos cuentas en el mismo
 * teléfono no heredan la conexión de la otra. */
const connectedKey = (userId: string) => `stelar.wearables.apple_health.connected:${userId}`
const lastSyncKey = (userId: string) => `stelar.wearables.apple_health.last_sync:${userId}`

/** Ventana de re-consulta en cada apertura (dato tardío + correcciones). */
const SYNC_WINDOW_DAYS = 7
/** Backfill inicial al conectar: valor inmediato sin pedir historia eterna. */
const INITIAL_WINDOW_DAYS = 30
/** No re-sincronizar más seguido que esto (cada foreground no es cada minuto). */
const MIN_SYNC_INTERVAL_MS = 15 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Corre UN sync completo (workouts + sueño + pasos) de los últimos
 * `windowDays`. Devuelve los conteos escritos, o null si el canal no está
 * disponible. Nunca lanza: un sync fallido jamás rompe la app.
 */
export async function syncAppleHealth(
  windowDays: number,
): Promise<{ workouts: number; sleepDays: number; stepDays: number } | null> {
  try {
    if (!(await isHealthKitAvailable())) return null
    const to = new Date()
    const from = new Date(to.getTime() - windowDays * DAY_MS)
    const tz = userTimezone()

    const [rawWorkouts, rawSleep, rawSteps] = await Promise.all([
      readWorkouts(from, to),
      readSleepSamples(from, to),
      readDailySteps(from, to),
    ])

    const [workouts, sleepDays, stepDays] = await Promise.all([
      upsertWearableWorkouts(rawWorkouts.map((w) => normalizeWorkout(w, 'apple_health'))),
      upsertWearableSleep(sleepSamplesToRows(rawSleep, tz, 'apple_health')),
      upsertWearableSteps(stepsToRows(rawSteps, tz, 'apple_health')),
    ])
    return { workouts, sleepDays, stepDays }
  } catch {
    return null
  }
}

/**
 * Estado + acciones de la conexión con Apple Health (la card "Conexiones" de
 * Ajustes). `connect` dispara el prompt del OS (el priming visual va ANTES,
 * en la pantalla que lo llama — lección de notificaciones) y corre el
 * backfill inicial. `disconnect` deja de sincronizar; lo ya escrito se queda
 * (es de ella; borrar historia sería castigo).
 */
export function useAppleHealthConnection(): {
  available: boolean | null
  connected: boolean | null
  lastSyncAt: string | null
  busy: boolean
  connect: () => Promise<boolean>
  disconnect: () => Promise<void>
} {
  const { session } = useSession()
  const userId = session?.user?.id ?? null
  const qc = useQueryClient()

  const [available, setAvailable] = useState<boolean | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ok = await isHealthKitAvailable()
      if (!cancelled) setAvailable(ok)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void (async () => {
      try {
        const [flag, last] = await Promise.all([
          AsyncStorage.getItem(connectedKey(userId)),
          AsyncStorage.getItem(lastSyncKey(userId)),
        ])
        if (!cancelled) {
          setConnected(flag === 'true')
          setLastSyncAt(last)
        }
      } catch {
        if (!cancelled) setConnected(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const connect = useCallback(async (): Promise<boolean> => {
    if (!userId || busy) return false
    setBusy(true)
    try {
      const granted = await requestHealthKitAuthorization()
      // iOS no revela "denegado" en lectura: granted=false solo pasa si el
      // flujo tronó. Conectamos igual y el vacío honesto vive en la UI.
      if (!granted) {
        track('wearable_connect_failed', { source: 'apple_health' })
        return false
      }
      await AsyncStorage.setItem(connectedKey(userId), 'true').catch(() => {})
      setConnected(true)
      track('wearable_connected', { source: 'apple_health' })

      const counts = await syncAppleHealth(INITIAL_WINDOW_DAYS)
      if (counts) {
        const now = new Date().toISOString()
        await AsyncStorage.setItem(lastSyncKey(userId), now).catch(() => {})
        setLastSyncAt(now)
        track('wearable_sync', { source: 'apple_health', initial: true, ...counts })
        if (counts.workouts + counts.sleepDays > 0) {
          void qc.invalidateQueries({ queryKey: queryKeys.orbit.all })
        }
      }
      return true
    } finally {
      setBusy(false)
    }
  }, [userId, busy, qc])

  const disconnect = useCallback(async (): Promise<void> => {
    if (!userId) return
    await AsyncStorage.setItem(connectedKey(userId), 'false').catch(() => {})
    setConnected(false)
    track('wearable_disconnected', { source: 'apple_health' })
  }, [userId])

  return { available, connected, lastSyncAt, busy, connect, disconnect }
}

/**
 * El sync de fondo del canal: al montar y en cada vuelta a foreground, si la
 * usuaria conectó Apple Health, re-consulta la ventana de 7 días (throttled a
 * 15 min). Montar UNA vez en el layout de tabs, junto a los otros syncs.
 */
export function useAppleHealthSync(): void {
  const { session } = useSession()
  const userId = session?.user?.id ?? null
  const qc = useQueryClient()
  const syncing = useRef(false)

  const maybeSync = useCallback(async () => {
    if (!userId || syncing.current) return
    syncing.current = true
    try {
      const flag = await AsyncStorage.getItem(connectedKey(userId)).catch(() => null)
      if (flag !== 'true') return
      const last = await AsyncStorage.getItem(lastSyncKey(userId)).catch(() => null)
      if (last && Date.now() - new Date(last).getTime() < MIN_SYNC_INTERVAL_MS) return

      const counts = await syncAppleHealth(SYNC_WINDOW_DAYS)
      if (!counts) return
      await AsyncStorage.setItem(lastSyncKey(userId), new Date().toISOString()).catch(() => {})
      track('wearable_sync', { source: 'apple_health', initial: false, ...counts })
      if (counts.workouts + counts.sleepDays > 0) {
        void qc.invalidateQueries({ queryKey: queryKeys.orbit.all })
      }
    } finally {
      syncing.current = false
    }
  }, [userId, qc])

  useEffect(() => {
    void maybeSync()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void maybeSync()
    })
    return () => sub.remove()
  }, [maybeSync])
}
