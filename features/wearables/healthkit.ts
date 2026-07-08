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
import { Platform } from 'react-native'

import type { RawDailySteps, RawSleepSample, RawWorkout } from './logic'

const READ_TYPES = [
  'HKWorkoutTypeIdentifier',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierStepCount',
] as const

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit')

async function hk(): Promise<HealthKitModule | null> {
  if (Platform.OS !== 'ios') return null
  try {
    return await import('@kingstinct/react-native-healthkit')
  } catch {
    // Expo Go / build sin el módulo nativo: el canal simplemente no existe.
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
