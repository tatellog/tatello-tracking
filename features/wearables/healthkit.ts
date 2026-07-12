/*
 * HealthKit — el ÚNICO archivo que conoce @kingstinct/react-native-healthkit
 * (Dependency Inversion: si la lib cambia, solo se toca esto). Devuelve
 * lecturas crudas planas (Raw*) que logic.ts normaliza.
 *
 * Import DINÁMICO siempre: el módulo nativo (Nitro) no existe en Expo Go ni
 * en Android; importarlo a nivel de módulo reventaría el eval. Mismo patrón
 * que expo-notifications en features/notifications/scheduler.ts.
 *
 * Permisos: SOLO workouts + sueño + pasos. NUNCA Active Energy diaria — la
 * kcal del entreno viene DENTRO de cada workout (totalEnergyBurned) y el
 * eat-back queda bloqueado por arquitectura (spec §4).
 */
import Constants from 'expo-constants'
import { Platform } from 'react-native'

import { WEARABLE_BODY_COMPOSITION_ENABLED } from '@/lib/featureFlags'

import type {
  BodyCompositionMetric,
  RawBodyComposition,
  RawDailySteps,
  RawSleepSample,
  RawWorkout,
} from './logic'

// Expo Go (storeClient) NO trae el módulo nativo Nitro de HealthKit. Importar
// `@kingstinct/react-native-healthkit` allí evalúa react-native-nitro-modules,
// que TIRA en su top-level ("Failed to get NitroModules") — y en el New
// Architecture ese throw ESCAPA del try-catch del import dinámico (Uncaught).
// Detectamos Expo Go y ni lo intentamos (mismo patrón que features/notifications).
const isExpoGo = Constants.executionEnvironment === 'storeClient'

const READ_TYPES_BASE = [
  'HKWorkoutTypeIdentifier',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierStepCount',
] as const

// Composición corporal: solo se piden si el flag está ON (no expandir el permiso
// de HealthKit mientras no haya UI que muestre el dato).
const READ_TYPES_WITH_COMPOSITION = [
  ...READ_TYPES_BASE,
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierBodyMassIndex',
] as const

const READ_TYPES = WEARABLE_BODY_COMPOSITION_ENABLED ? READ_TYPES_WITH_COMPOSITION : READ_TYPES_BASE

// Identificador HK → métrica canónica de composición. La conversión de UNIDAD
// (fracción→pct, kg, índice) se hace al leer para que logic reciba lo canónico.
const COMPOSITION_TYPES: { id: string; metric: BodyCompositionMetric; unit: string }[] = [
  { id: 'HKQuantityTypeIdentifierBodyFatPercentage', metric: 'body_fat_pct', unit: '%' },
  { id: 'HKQuantityTypeIdentifierLeanBodyMass', metric: 'lean_body_mass_kg', unit: 'kg' },
  { id: 'HKQuantityTypeIdentifierBodyMassIndex', metric: 'bmi', unit: 'count' },
]

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit')

async function hk(): Promise<HealthKitModule | null> {
  if (Platform.OS !== 'ios' || isExpoGo) return null
  try {
    return await import('@kingstinct/react-native-healthkit')
  } catch {
    // Build sin el módulo nativo: el canal simplemente no existe.
    return null
  }
}

/** ¿Este build puede hablar con HealthKit? (iOS + módulo nativo presente). */
export async function isHealthKitAvailable(): Promise<boolean> {
  const mod = await hk()
  if (!mod) return false
  try {
    return mod.isHealthDataAvailable()
  } catch {
    return false
  }
}

/**
 * Dispara el prompt de permisos del OS (solo lectura, solo los 3 tipos).
 * OJO honestidad de iOS: que resuelva true NO significa que concedió — Apple
 * no distingue "denegado" de "sin datos" en lectura. El estado real se
 * descubre leyendo (spec §4: la UX del vacío es amable, nunca culpa).
 */
export async function requestHealthKitAuthorization(): Promise<boolean> {
  const mod = await hk()
  if (!mod) return false
  try {
    return await mod.requestAuthorization({ toRead: READ_TYPES })
  } catch {
    return false
  }
}

/** Workouts crudos del rango, aplanados (uuid, tipo, fechas, duración, kcal). */
export async function readWorkouts(from: Date, to: Date): Promise<RawWorkout[]> {
  const mod = await hk()
  if (!mod) return []
  try {
    const workouts = await mod.queryWorkoutSamples({
      filter: { date: { startDate: from, endDate: to } },
      limit: 0,
      ascending: true,
    })
    return workouts.map((w) => ({
      uuid: w.uuid,
      activityType: w.workoutActivityType as number,
      start: new Date(w.startDate),
      end: new Date(w.endDate),
      // HK entrega duration en segundos; defensivo por si la unidad cambia.
      durationSec:
        w.duration != null
          ? w.duration.unit === 'min'
            ? w.duration.quantity * 60
            : w.duration.quantity
          : null,
      energyKcal: w.totalEnergyBurned?.quantity ?? null,
    }))
  } catch {
    return []
  }
}

/** Etapas de sueño crudas del rango (logic filtra inBed/awake y agrupa). */
export async function readSleepSamples(from: Date, to: Date): Promise<RawSleepSample[]> {
  const mod = await hk()
  if (!mod) return []
  try {
    const samples = await mod.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      filter: { date: { startDate: from, endDate: to } },
      limit: 0,
      ascending: true,
    })
    return samples.map((s) => ({
      uuid: s.uuid,
      value: s.value as number,
      start: new Date(s.startDate),
      end: new Date(s.endDate),
    }))
  } catch {
    return []
  }
}

/** Pasos por día del rango — agregados PRE-DEDUPLICADOS por Apple
 *  (HKStatisticsCollection suma iPhone+Watch sin doble conteo; jamás sumar
 *  samples a mano — lección MFP, spec §5). */
export async function readDailySteps(from: Date, to: Date): Promise<RawDailySteps[]> {
  const mod = await hk()
  if (!mod) return []
  try {
    const anchor = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0)
    const stats = await mod.queryStatisticsCollectionForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      anchor,
      { day: 1 },
      { filter: { date: { startDate: from, endDate: to } }, unit: 'count' },
    )
    const out: RawDailySteps[] = []
    for (const s of stats) {
      const steps = s.sumQuantity?.quantity
      if (steps == null || steps <= 0 || s.startDate == null) continue
      out.push({ start: new Date(s.startDate), steps })
    }
    return out
  } catch {
    return []
  }
}

/**
 * Composición corporal cruda del rango (% grasa, masa magra, IMC). Gateado por
 * el flag: con OFF ni siquiera consulta (y el permiso nunca se pidió). % grasa:
 * HealthKit guarda el porcentaje como FRACCIÓN (0.25 = 25%); se normaliza a
 * 0-100 de forma defensiva (si ya viene >1, se asume pct). logic agrupa por día.
 */
export async function readBodyComposition(from: Date, to: Date): Promise<RawBodyComposition[]> {
  if (!WEARABLE_BODY_COMPOSITION_ENABLED) return []
  const mod = await hk()
  if (!mod) return []
  const out: RawBodyComposition[] = []
  for (const t of COMPOSITION_TYPES) {
    try {
      const samples = await mod.queryQuantitySamples(
        t.id as Parameters<typeof mod.queryQuantitySamples>[0],
        {
          filter: { date: { startDate: from, endDate: to } },
          limit: 0,
          ascending: true,
          unit: t.unit,
        },
      )
      for (const s of samples) {
        const raw = s.quantity
        if (raw == null || !Number.isFinite(raw) || raw <= 0 || s.startDate == null) continue
        // % grasa llega como fracción (0-1); a pct. Defensivo si ya viene 0-100.
        const value = t.metric === 'body_fat_pct' && raw <= 1 ? raw * 100 : raw
        out.push({ metric: t.metric, value, date: new Date(s.startDate) })
      }
    } catch {
      // Un tipo sin permiso/datos no tumba a los demás.
      continue
    }
  }
  return out
}
