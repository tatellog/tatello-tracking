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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

import { useSession } from '@/hooks/useSession'
import { track } from '@/lib/analytics'
import { queryKeys } from '@/lib/queryKeys'
import { userTimezone } from '@/lib/time'

import {
  getLatestWearableWeight,
  getWearableWeights,
  upsertWearableBodyComposition,
  upsertWearableSleep,
  upsertWearableSteps,
  upsertWearableWater,
  upsertWearableWeight,
  upsertWearableWorkouts,
} from './api'
import {
  isHealthKitAvailable,
  readBodyComposition,
  readBodyMass,
  readDailySteps,
  readDailyWater,
  readSleepSamples,
  readWorkouts,
  requestHealthKitAuthorization,
  requestScaleAuthorization,
} from './healthkit'
import {
  bodyCompositionToRows,
  bodyMassToRows,
  normalizeWorkout,
  sleepSamplesToRows,
  stepsToRows,
  waterToRows,
} from './logic'

/* Flag de conexión POR USUARIA (no por device): dos cuentas en el mismo
 * teléfono no heredan la conexión de la otra. */
const connectedKey = (userId: string) => `stelar.wearables.apple_health.connected:${userId}`
const lastSyncKey = (userId: string) => `stelar.wearables.apple_health.last_sync:${userId}`
/* Báscula (spec §9): opt-in aparte del canal, con su propio permiso de Salud. */
const scaleEnabledKey = (userId: string) => `stelar.wearables.scale.enabled:${userId}`
/* Última lectura de la báscula que la usuaria YA VIO (para el punto del ícono). */
const scaleSeenKey = (userId: string) => `stelar.wearables.scale.seen_at:${userId}`

async function isScaleEnabled(userId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(scaleEnabledKey(userId)).catch(() => null)) === 'true'
}

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
  opts: { scale?: boolean } = {},
): Promise<{
  workouts: number
  sleepDays: number
  stepDays: number
  waterDays: number
  weightDays: number
  bodyDays: number
} | null> {
  try {
    if (!(await isHealthKitAvailable())) return null
    const to = new Date()
    const from = new Date(to.getTime() - windowDays * DAY_MS)
    const tz = userTimezone()

    // readBodyComposition ya se auto-gatea por WEARABLE_BODY_COMPOSITION_ENABLED
    // (devuelve [] con el flag OFF → no lee ni pide permiso). El peso de la
    // báscula solo se lee con el opt-in encendido (spec §9).
    const [rawWorkouts, rawSleep, rawSteps, rawWater, rawWeight, rawBody] = await Promise.all([
      readWorkouts(from, to),
      readSleepSamples(from, to),
      readDailySteps(from, to),
      readDailyWater(from, to),
      opts.scale ? readBodyMass(from, to) : Promise.resolve([]),
      readBodyComposition(from, to),
    ])

    const [workouts, sleepDays, stepDays, waterDays, weightDays, bodyDays] = await Promise.all([
      upsertWearableWorkouts(rawWorkouts.map((w) => normalizeWorkout(w, 'apple_health'))),
      upsertWearableSleep(sleepSamplesToRows(rawSleep, tz, 'apple_health')),
      upsertWearableSteps(stepsToRows(rawSteps, tz, 'apple_health')),
      upsertWearableWater(waterToRows(rawWater, tz, 'apple_health')),
      upsertWearableWeight(bodyMassToRows(rawWeight, tz, 'apple_health')),
      upsertWearableBodyComposition(bodyCompositionToRows(rawBody, tz, 'apple_health')),
    ])
    return { workouts, sleepDays, stepDays, waterDays, weightDays, bodyDays }
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

      const counts = await syncAppleHealth(INITIAL_WINDOW_DAYS, {
        scale: await isScaleEnabled(userId),
      })
      if (counts) {
        const now = new Date().toISOString()
        await AsyncStorage.setItem(lastSyncKey(userId), now).catch(() => {})
        setLastSyncAt(now)
        track('wearable_sync', { source: 'apple_health', initial: true, ...counts })
        if (counts.workouts + counts.sleepDays + counts.waterDays + counts.weightDays > 0) {
          void qc.invalidateQueries({ queryKey: queryKeys.orbit.all })
        }
        if (counts.weightDays > 0) {
          void qc.invalidateQueries({ queryKey: queryKeys.wearables.all })
          void qc.invalidateQueries({ queryKey: queryKeys.progress.all })
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

      const counts = await syncAppleHealth(SYNC_WINDOW_DAYS, {
        scale: await isScaleEnabled(userId),
      })
      if (!counts) return
      await AsyncStorage.setItem(lastSyncKey(userId), new Date().toISOString()).catch(() => {})
      track('wearable_sync', { source: 'apple_health', initial: false, ...counts })
      if (counts.workouts + counts.sleepDays + counts.waterDays + counts.weightDays > 0) {
        void qc.invalidateQueries({ queryKey: queryKeys.orbit.all })
      }
      if (counts.weightDays > 0) {
        void qc.invalidateQueries({ queryKey: queryKeys.wearables.all })
        void qc.invalidateQueries({ queryKey: queryKeys.progress.all })
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

/* ── Invitación contextual (spec §5 · "la que convierte") ─────────────────── */

const inviteDismissedKey = (userId: string) => `stelar.wearables.invite_dismissed:${userId}`

/**
 * La invitación contextual a conectar el reloj, en el lugar que automatiza
 * (el check-in de Hoy). Se muestra solo cuando el canal EXISTE en este build
 * (HealthKit disponible), la usuaria NO lo conectó y no dijo "Ahora no". Un
 * "Ahora no" es definitivo (sin re-asks); Ajustes → Conexiones sigue ahí.
 */
export function useWearableInvite(): {
  show: boolean
  dismiss: () => void
} {
  const { session } = useSession()
  const userId = session?.user?.id ?? null
  const { available, connected } = useAppleHealthConnection()
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void AsyncStorage.getItem(inviteDismissedKey(userId))
      .then((v) => {
        if (!cancelled) setDismissed(v === 'true')
      })
      .catch(() => {
        if (!cancelled) setDismissed(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const dismiss = useCallback(() => {
    if (!userId) return
    setDismissed(true)
    void AsyncStorage.setItem(inviteDismissedKey(userId), 'true').catch(() => {})
    track('wearable_invite_dismissed', { source: 'apple_health' })
  }, [userId])

  return {
    show: available === true && connected === false && dismissed === false,
    dismiss,
  }
}

/* ── Báscula (spec §9 · decisión dueña: opt-in, ícono en Hoy con punto) ──── */

/**
 * Opt-in de la báscula. `enable` pide el permiso de peso de Salud (aparte del
 * canal) y corre un backfill de 30 días; `disable` deja de leer, lo escrito se
 * queda. Requiere Apple Health conectado: sin canal no hay báscula.
 */
export function useScaleConnection(): {
  available: boolean | null
  enabled: boolean | null
  busy: boolean
  enable: () => Promise<boolean>
  disable: () => Promise<void>
} {
  const { session } = useSession()
  const userId = session?.user?.id ?? null
  const qc = useQueryClient()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void isHealthKitAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void isScaleEnabled(userId).then((on) => {
      if (!cancelled) setEnabled(on)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const enable = useCallback(async (): Promise<boolean> => {
    if (!userId || busy) return false
    setBusy(true)
    try {
      const granted = await requestScaleAuthorization()
      if (!granted) {
        track('scale_enable_failed', { source: 'apple_health' })
        return false
      }
      await AsyncStorage.setItem(scaleEnabledKey(userId), 'true').catch(() => {})
      // El canal queda conectado también (la báscula vive dentro de Salud).
      await AsyncStorage.setItem(connectedKey(userId), 'true').catch(() => {})
      setEnabled(true)
      track('scale_enabled', { source: 'apple_health' })
      const counts = await syncAppleHealth(INITIAL_WINDOW_DAYS, { scale: true })
      if (counts) {
        track('wearable_sync', { source: 'apple_health', initial: true, ...counts })
        void qc.invalidateQueries({ queryKey: queryKeys.wearables.all })
        void qc.invalidateQueries({ queryKey: queryKeys.progress.all })
        void qc.invalidateQueries({ queryKey: queryKeys.orbit.all })
      }
      return true
    } finally {
      setBusy(false)
    }
  }, [userId, busy, qc])

  const disable = useCallback(async (): Promise<void> => {
    if (!userId) return
    await AsyncStorage.setItem(scaleEnabledKey(userId), 'false').catch(() => {})
    setEnabled(false)
    track('scale_disabled', { source: 'apple_health' })
  }, [userId])

  return { available, enabled, busy, enable, disable }
}

/** La lectura más reciente de la báscula (null si nunca llegó nada). */
export function useLatestWearableWeight(enabled = true) {
  const { session } = useSession()
  const userId = session?.user?.id ?? ''
  return useQuery({
    queryKey: queryKeys.wearables.latestWeight(userId),
    queryFn: getLatestWearableWeight,
    enabled: enabled && userId !== '',
    staleTime: 60_000,
  })
}

/** Toda la serie de la báscula. Vacía (no error) si el opt-in nunca se encendió. */
export function useWearableWeights() {
  const { session } = useSession()
  const userId = session?.user?.id ?? ''
  return useQuery({
    queryKey: queryKeys.wearables.weights(userId),
    queryFn: getWearableWeights,
    enabled: userId !== '',
    staleTime: 5 * 60_000,
  })
}

/**
 * El punto del ícono de la báscula en Hoy: hay una lectura que la usuaria aún
 * no vio. `markSeen` lo apaga (se llama al abrir "Tu báscula"). El ícono
 * NUNCA muestra el número (manifiesto: el peso no vive en Hoy).
 */
export function useScaleBadge(): { hasNew: boolean; markSeen: () => void } {
  const { session } = useSession()
  const userId = session?.user?.id ?? null
  const latest = useLatestWearableWeight(userId != null)
  const [seenAt, setSeenAt] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void AsyncStorage.getItem(scaleSeenKey(userId))
      .then((v) => {
        if (!cancelled) setSeenAt(v ?? '')
      })
      .catch(() => {
        if (!cancelled) setSeenAt('')
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const latestAt = latest.data?.measured_at ?? null
  const hasNew = latestAt != null && seenAt != null && latestAt > seenAt

  const markSeen = useCallback(() => {
    if (!userId || !latestAt) return
    setSeenAt(latestAt)
    void AsyncStorage.setItem(scaleSeenKey(userId), latestAt).catch(() => {})
  }, [userId, latestAt])

  return { hasNew, markSeen }
}
