/*
 * Health Connect (Android) — el ÚNICO archivo que conoce
 * react-native-health-connect. Espejo de `healthkit.ts` (spec wearables §8.1):
 * misma forma de lectura cruda (`Raw*` de logic.ts), así el sync, las tablas
 * y la regla "manual gana" son UNO para las dos plataformas.
 *
 * Diferencias honestas con HealthKit:
 *   · Tipos de entreno y etapas de sueño usan otros enums → se traducen aquí
 *     (hcExerciseToWorkoutType / hcSleepStageToHk en logic.ts).
 *   · El entreno de Health Connect no trae kcal propias; NO se leen las kcal
 *     activas del día para rellenarlas (spec §4: nunca eat-back).
 *   · No hay "despiértame cuando llegue un dato" como el background delivery
 *     de iOS: el aviso en Android sale de una tarea periódica
 *     (background-sync.ts). Por eso enable/subscribe aquí son no-ops.
 *   · Composición corporal: fuera mientras WEARABLE_BODY_COMPOSITION_ENABLED
 *     esté apagado (igual que en iOS no se pide).
 *
 * Import dinámico: el módulo nativo no existe en iOS ni en Expo Go.
 */
import Constants from 'expo-constants'
import { Platform } from 'react-native'

import {
  hcActivityName,
  hcExerciseToWorkoutType,
  hcSleepStageToHk,
  type RawBodyComposition,
  type RawBodyMass,
  type RawDailySteps,
  type RawDailyWater,
  type RawSleepSample,
  type RawWorkout,
} from './logic'

type HCModule = typeof import('react-native-health-connect')

const isExpoGo = Constants.executionEnvironment === 'storeClient'
const SDK_AVAILABLE = 3

/** Lo que Stelar lee (solo lectura). La báscula va aparte, como en iOS. */
const READ_TYPES = ['ExerciseSession', 'SleepSession', 'Steps', 'Hydration'] as const

let ready: Promise<HCModule | null> | null = null

async function hc(): Promise<HCModule | null> {
  if (Platform.OS !== 'android' || isExpoGo) return null
  if (!ready) {
    ready = (async () => {
      try {
        const mod = await import('react-native-health-connect')
        if ((await mod.getSdkStatus()) !== SDK_AVAILABLE) return null
        return (await mod.initialize()) ? mod : null
      } catch {
        return null
      }
    })()
  }
  return ready
}

const between = (from: Date, to: Date) => ({
  operator: 'between' as const,
  startTime: from.toISOString(),
  endTime: to.toISOString(),
})

/** ¿Este teléfono tiene Health Connect usable? (Android + instalado + build). */
export async function isHealthConnectAvailable(): Promise<boolean> {
  return (await hc()) != null
}

/** Pide lectura de entrenos, sueño, pasos y agua, más leer en SEGUNDO PLANO
 *  (lo usa el aviso "Entreno registrado"). Devuelve true si concedió algo. */
export async function requestHealthConnectAuthorization(): Promise<boolean> {
  const mod = await hc()
  if (!mod) return false
  try {
    const granted = await mod.requestPermission([
      ...READ_TYPES.map((recordType) => ({ accessType: 'read' as const, recordType })),
      { accessType: 'read', recordType: 'BackgroundAccessPermission' },
    ])
    return granted.length > 0
  } catch {
    return false
  }
}

/** Permiso de la báscula (peso), opt-in aparte como en iOS. */
export async function requestHealthConnectScaleAuthorization(): Promise<boolean> {
  const mod = await hc()
  if (!mod) return false
  try {
    const granted = await mod.requestPermission([{ accessType: 'read', recordType: 'Weight' }])
    return granted.some((p) => p.recordType === 'Weight')
  } catch {
    return false
  }
}

/** Lee todas las páginas de un tipo en el rango. */
async function readAll<T extends (typeof READ_TYPES)[number] | 'Weight'>(
  mod: HCModule,
  recordType: T,
  from: Date,
  to: Date,
) {
  const out: Awaited<ReturnType<HCModule['readRecords']>>['records'] = []
  let pageToken: string | undefined
  for (let i = 0; i < 20; i++) {
    const res = await mod.readRecords(recordType, {
      timeRangeFilter: between(from, to),
      ascendingOrder: true,
      pageSize: 500,
      pageToken,
    })
    out.push(...res.records)
    pageToken = res.pageToken || undefined
    if (!pageToken) break
  }
  return out
}

export async function readHcWorkouts(from: Date, to: Date): Promise<RawWorkout[]> {
  const mod = await hc()
  if (!mod) return []
  try {
    const records = (await readAll(mod, 'ExerciseSession', from, to)) as {
      metadata?: { id?: string }
      startTime: string
      endTime: string
      exerciseType: number
    }[]
    return records.map((r) => {
      const start = new Date(r.startTime)
      const end = new Date(r.endTime)
      return {
        uuid: r.metadata?.id ?? `${r.startTime}-${r.exerciseType}`,
        activityType: -1,
        workoutType: hcExerciseToWorkoutType(r.exerciseType),
        activityName: hcActivityName(r.exerciseType),
        start,
        end,
        durationSec: Math.max(0, (end.getTime() - start.getTime()) / 1000),
        energyKcal: null,
      }
    })
  } catch {
    return []
  }
}

/** Sesiones de sueño → muestras con el valor de HealthKit (una por etapa; sin
 *  etapas, la sesión entera cuenta como "dormida"). */
export async function readHcSleepSamples(from: Date, to: Date): Promise<RawSleepSample[]> {
  const mod = await hc()
  if (!mod) return []
  try {
    const sessions = (await readAll(mod, 'SleepSession', from, to)) as {
      metadata?: { id?: string }
      startTime: string
      endTime: string
      stages?: { startTime: string; endTime: string; stage: number }[]
    }[]
    const out: RawSleepSample[] = []
    for (const s of sessions) {
      const id = s.metadata?.id ?? s.startTime
      if (!s.stages || s.stages.length === 0) {
        out.push({ uuid: id, value: 1, start: new Date(s.startTime), end: new Date(s.endTime) })
        continue
      }
      s.stages.forEach((st, i) => {
        const value = hcSleepStageToHk(st.stage)
        if (value == null) return
        out.push({
          uuid: `${id}-${i}`,
          value,
          start: new Date(st.startTime),
          end: new Date(st.endTime),
        })
      })
    }
    return out
  } catch {
    return []
  }
}

/** Pasos por día, ya agregados (Health Connect deduplica las fuentes). */
export async function readHcDailySteps(from: Date, to: Date): Promise<RawDailySteps[]> {
  const mod = await hc()
  if (!mod) return []
  try {
    const groups = await mod.aggregateGroupByPeriod({
      recordType: 'Steps',
      timeRangeFilter: between(from, to),
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    })
    return groups.map((g) => ({
      start: new Date(g.startTime),
      steps: (g.result as { COUNT_TOTAL?: number }).COUNT_TOTAL ?? 0,
    }))
  } catch {
    return []
  }
}

/** Agua por día en mL. */
export async function readHcDailyWater(from: Date, to: Date): Promise<RawDailyWater[]> {
  const mod = await hc()
  if (!mod) return []
  try {
    const groups = await mod.aggregateGroupByPeriod({
      recordType: 'Hydration',
      timeRangeFilter: between(from, to),
      timeRangeSlicer: { period: 'DAYS', length: 1 },
    })
    return groups.map((g) => ({
      start: new Date(g.startTime),
      ml:
        (g.result as { VOLUME_TOTAL?: { inMilliliters?: number } }).VOLUME_TOTAL?.inMilliliters ??
        0,
    }))
  } catch {
    return []
  }
}

export async function readHcBodyMass(from: Date, to: Date): Promise<RawBodyMass[]> {
  const mod = await hc()
  if (!mod) return []
  try {
    const records = (await readAll(mod, 'Weight', from, to)) as {
      time: string
      weight: { inKilograms: number }
    }[]
    return records.map((r) => ({ date: new Date(r.time), kg: r.weight.inKilograms }))
  } catch {
    return []
  }
}

/** Composición corporal: apagada como en iOS mientras el flag esté OFF. */
export async function readHcBodyComposition(_from: Date, _to: Date): Promise<RawBodyComposition[]> {
  return []
}
