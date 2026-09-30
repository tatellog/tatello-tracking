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
import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'

import { useSession } from '@/hooks/useSession'
import { track } from '@/lib/analytics'
import { queryKeys } from '@/lib/queryKeys'
import { todayInTimezone, userTimezone } from '@/lib/time'

import {
  getLatestWearableWeight,
  getHealthSummary,
  getWearableSleepNights,
  getWearableWeights,
  upsertWearableBodyComposition,
  upsertWearableSleep,
  upsertWearableSteps,
  upsertWearableWater,
  upsertWearableWeight,
  upsertWearableWorkouts,
} from './api'
import {
  disableHealthBackgroundDelivery,
  enableHealthBackgroundDelivery,
  isHealthKitAvailable,
  subscribeHealthChanges,
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
  dedupeWorkouts,
  normalizeWorkout,
  sleepSamplesToRows,
  stepsToRows,
  syncIntervalMs,
  waterToRows,
} from './logic'

/* Flag de conexión POR USUARIA (no por device): dos cuentas en el mismo
 * teléfono no heredan la conexión de la otra. */
const connectedKey = (userId: string) => `stelar.wearables.apple_health.connected:${userId}`
const lastSyncKey = (userId: string) => `stelar.wearables.apple_health.last_sync:${userId}`
/* Último día con sueño del reloj (para re-consultar seguido en la mañana). */
const lastSleepDayKey = (userId: string) => `stelar.wearables.apple_health.sleep_day:${userId}`
/* Background delivery ya configurado en este teléfono (se configura una vez;
 * el lado nativo lo persiste y lo re-registra en cada arranque). */
const BACKGROUND_KEY = 'stelar.wearables.apple_health.background:v1'
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
  /** Día más reciente con sueño en Salud (YYYY-MM-DD), o null. */
  lastSleepDay: string | null
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

    const sleepRows = sleepSamplesToRows(rawSleep, tz, 'apple_health')
    const lastSleepDay = sleepRows.reduce<string | null>(
      (max, r) => (max == null || r.sleep_date > max ? r.sleep_date : max),
      null,
    )

    const [workouts, sleepDays, stepDays, waterDays, weightDays, bodyDays] = await Promise.all([
      upsertWearableWorkouts(
        dedupeWorkouts(rawWorkouts.map((w) => normalizeWorkout(w, 'apple_health'))),
      ),
      upsertWearableSleep(sleepRows),
      upsertWearableSteps(stepsToRows(rawSteps, tz, 'apple_health')),
      upsertWearableWater(waterToRows(rawWater, tz, 'apple_health')),
      upsertWearableWeight(bodyMassToRows(rawWeight, tz, 'apple_health')),
      upsertWearableBodyComposition(bodyCompositionToRows(rawBody, tz, 'apple_health')),
    ])
    return { workouts, sleepDays, stepDays, waterDays, weightDays, bodyDays, lastSleepDay }
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
      void ensureBackgroundDelivery()

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
    await AsyncStorage.removeItem(BACKGROUND_KEY).catch(() => {})
    void disableHealthBackgroundDelivery()
  }, [userId])

  return { available, connected, lastSyncAt, busy, connect, disconnect }
}

/** Enciende el background delivery una vez por teléfono (idempotente). */
async function ensureBackgroundDelivery(): Promise<void> {
  const done = await AsyncStorage.getItem(BACKGROUND_KEY).catch(() => null)
  if (done === 'true') return
  if (await enableHealthBackgroundDelivery()) {
    await AsyncStorage.setItem(BACKGROUND_KEY, 'true').catch(() => {})
  }
}

/* Un solo sync a la vez en toda la app (el de fondo y el pull de Hoy). */
let syncInFlight: Promise<boolean> | null = null

function localHour(tz: string): number {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date())
  return Number(h) % 24
}

/**
 * Re-consulta la ventana de 7 días si la usuaria conectó Apple Health. Sin
 * `force` respeta el intervalo (15 min, o 2 min en la mañana mientras el
 * sueño de anoche no llega). Devuelve true si corrió un sync.
 */
async function runAppleHealthSync(
  userId: string,
  qc: ReturnType<typeof useQueryClient>,
  force: boolean,
): Promise<boolean> {
  if (syncInFlight) return syncInFlight
  syncInFlight = (async () => {
    const flag = await AsyncStorage.getItem(connectedKey(userId)).catch(() => null)
    if (flag !== 'true') return false
    if (!force) {
      const [last, sleepDay] = await Promise.all([
        AsyncStorage.getItem(lastSyncKey(userId)).catch(() => null),
        AsyncStorage.getItem(lastSleepDayKey(userId)).catch(() => null),
      ])
      const tz = userTimezone()
      const interval = syncIntervalMs({
        localHour: localHour(tz),
        today: todayInTimezone(tz),
        lastSleepDay: sleepDay,
      })
      if (last && Date.now() - new Date(last).getTime() < interval) return false
    }

    const counts = await syncAppleHealth(SYNC_WINDOW_DAYS, {
      scale: await isScaleEnabled(userId),
    })
    if (!counts) return false
    const { lastSleepDay, ...tracked } = counts
    await AsyncStorage.setItem(lastSyncKey(userId), new Date().toISOString()).catch(() => {})
    if (lastSleepDay) {
      await AsyncStorage.setItem(lastSleepDayKey(userId), lastSleepDay).catch(() => {})
    }
    track('wearable_sync', { source: 'apple_health', initial: false, forced: force, ...tracked })
    if (counts.workouts + counts.sleepDays + counts.waterDays + counts.weightDays > 0) {
      void qc.invalidateQueries({ queryKey: queryKeys.orbit.all })
    }
    if (
      counts.workouts + counts.weightDays + counts.sleepDays + counts.stepDays + counts.waterDays >
      0
    ) {
      void qc.invalidateQueries({ queryKey: queryKeys.wearables.all })
    }
    if (counts.weightDays > 0) {
      void qc.invalidateQueries({ queryKey: queryKeys.progress.all })
    }
    return true
  })().finally(() => {
    syncInFlight = null
  })
  return syncInFlight
}

/**
 * El sync de fondo del canal: al montar y en cada vuelta a foreground, si la
 * usuaria conectó Apple Health, re-consulta la ventana de 7 días (throttled,
 * ver `syncIntervalMs`). Montar UNA vez en el layout de tabs.
 */
export function useAppleHealthSync(): void {
  const { session } = useSession()
  const userId = session?.user?.id ?? null
  const qc = useQueryClient()

  useEffect(() => {
    if (!userId) return
    // iOS despertó la app en segundo plano porque Salud recibió sueño o un
    // entreno (background delivery): hay dato nuevo seguro, se lee sin
    // esperar el intervalo. En un arranque normal, el throttle de siempre.
    const wokenByHealth = AppState.currentState === 'background'
    void (async () => {
      const connected = await AsyncStorage.getItem(connectedKey(userId)).catch(() => null)
      if (connected === 'true') await ensureBackgroundDelivery()
      await runAppleHealthSync(userId, qc, wokenByHealth)
      if (wokenByHealth) track('wearable_background_wake', { source: 'apple_health' })
    })()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runAppleHealthSync(userId, qc, false)
    })
    // Con la app abierta, Salud avisa en cuanto llega sueño o un entreno
    // (Garmin Connect suele escribir minutos después del sync de apertura):
    // se lee en ese momento, sin esperar el intervalo. Debounce: Garmin
    // escribe en ráfaga (entreno + energía + sueño) y basta un sync.
    let debounce: ReturnType<typeof setTimeout> | null = null
    let stop: (() => void) | null = null
    let alive = true
    void subscribeHealthChanges(() => {
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        debounce = null
        void runAppleHealthSync(userId, qc, true).then((ran) => {
          if (ran) track('wearable_live_sync', { source: 'apple_health' })
        })
      }, 4_000)
    }).then((unsub) => {
      if (alive) stop = unsub
      else unsub()
    })
    return () => {
      alive = false
      sub.remove()
      if (debounce) clearTimeout(debounce)
      stop?.()
    }
  }, [userId, qc])
}

/**
 * Sync manual (el pull de Hoy): lee Salud AHORA, sin esperar el intervalo.
 * No-op si el canal no está conectado.
 */
export function useAppleHealthSyncNow(): () => Promise<void> {
  const { session } = useSession()
  const userId = session?.user?.id ?? null
  const qc = useQueryClient()
  return async () => {
    if (!userId) return
    await runAppleHealthSync(userId, qc, true)
  }
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
      void ensureBackgroundDelivery()
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

/*
 * Cuándo sincronizó el reloj por última vez (para la firma "desde tu reloj ·
 * hace 2 h" bajo las filas de Hoy). Se relee en cada vuelta a foreground,
 * que es cuando el sync de fondo lo actualiza.
 */
export function useWearableLastSync(): string | null {
  const { session } = useSession()
  const userId = session?.user?.id ?? null
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setLastSyncAt(null)
      return
    }
    let cancelled = false
    const read = () => {
      void AsyncStorage.getItem(lastSyncKey(userId))
        .then((v) => {
          if (!cancelled) setLastSyncAt(v)
        })
        .catch(() => {})
    }
    read()
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') read()
    })
    return () => {
      cancelled = true
      sub.remove()
    }
  }, [userId])

  return lastSyncAt
}

/** Las noches del reloj en [fromDay, toDay] (pantalla de detalle de sueño). */
export function useWearableSleepNights(fromDay: string, toDay: string) {
  const { session } = useSession()
  const userId = session?.user?.id ?? ''
  return useQuery({
    queryKey: queryKeys.wearables.sleepNights(userId, fromDay, toDay),
    queryFn: () => getWearableSleepNights(fromDay, toDay),
    enabled: userId !== '',
    staleTime: 60_000,
  })
}

/** Entrenos, pasos y agua de Salud en [fromDay, toDay] (pantalla "Tu smartwatch"). */
export function useHealthSummary(fromDay: string, toDay: string) {
  const { session } = useSession()
  const userId = session?.user?.id ?? ''
  return useQuery({
    queryKey: queryKeys.wearables.summary(userId, fromDay, toDay),
    queryFn: () => getHealthSummary(fromDay, toDay),
    enabled: userId !== '',
    staleTime: 60_000,
  })
}
