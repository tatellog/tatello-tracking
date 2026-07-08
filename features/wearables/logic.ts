/*
 * Wearables — lógica PURA de normalización (testeable, sin RN ni Supabase).
 *
 * Convierte lecturas crudas de HealthKit (y mañana Garmin) en filas para las
 * tablas de aterrizaje `wearable_*` (docs/wearables-integration-spec.md §2).
 * Agnóstica de fuente a propósito: cuando llegue Health Connect (Android) o
 * Garmin cloud, enchufan aquí sin refactor.
 *
 * Reglas que esta capa garantiza:
 *   · Día local SIEMPRE por timezone del perfil (misma convención que la
 *     view daily_signals) — nunca UTC.
 *   · Sueño = suma de etapas "asleep" (nunca inBed — infla 1-2 h) y se
 *     atribuye al día en que DESPERTÓ (convención sleep_date).
 *   · Valores clampeados a los CHECK de las tablas (atrapa basura antes de
 *     que el insert truene).
 */

export type WearableSource = 'apple_health' | 'garmin'

export type WearableWorkoutRow = {
  source: WearableSource
  external_id: string
  started_at: string
  ended_at: string
  workout_type: string | null
  duration_min: number | null
  energy_kcal: number | null
}

export type WearableSleepRow = {
  source: WearableSource
  external_id: string
  sleep_date: string
  bedtime_at: string | null
  wake_at: string | null
  asleep_minutes: number
}

export type WearableStepsRow = {
  source: WearableSource
  day_date: string
  steps: number
}

/** Lectura cruda de un workout, ya aplanada por el wrapper de la fuente. */
export type RawWorkout = {
  uuid: string
  /** HKWorkoutActivityType (número del enum de Apple). */
  activityType: number
  start: Date
  end: Date
  /** Duración en SEGUNDOS (unidad nativa de HK); null si no vino. */
  durationSec: number | null
  /** kcal del entreno (totalEnergyBurned del propio workout); null si no vino. */
  energyKcal: number | null
}

/** Muestra cruda de sueño (una etapa). `value` = CategoryValueSleepAnalysis. */
export type RawSleepSample = {
  uuid: string
  value: number
  start: Date
  end: Date
}

/** Bucket diario de pasos ya agregado por la fuente (pre-deduplicado). */
export type RawDailySteps = {
  start: Date
  steps: number
}

/** YYYY-MM-DD del instante `d` en la zona `tz` (en-CA formatea ISO nativo;
 *  mismo truco que lib/time.todayInTimezone). */
export function dayInTimezone(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)
}

/*
 * HKWorkoutActivityType → el vocabulario canónico de los chips de Hoy
 * (fuerza / cardio / caminata / otro — ver _shared/intelligence/workout-type).
 * Lo que no mapea limpio cae a 'otro', jamás a un tipo inventado.
 */
const HK_FUERZA = new Set([20, 50, 59]) // functional/traditional strength, core
const HK_CARDIO = new Set([11, 13, 16, 35, 37, 44, 46, 63, 64, 65, 73, 77, 78])
const HK_CAMINATA = new Set([24, 52]) // hiking, walking

export function hkActivityToWorkoutType(activityType: number): string {
  if (HK_FUERZA.has(activityType)) return 'fuerza'
  if (HK_CARDIO.has(activityType)) return 'cardio'
  if (HK_CAMINATA.has(activityType)) return 'caminata'
  return 'otro'
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n))

/** Un workout crudo → fila de wearable_workouts (sin user_id; lo pone api). */
export function normalizeWorkout(w: RawWorkout, source: WearableSource): WearableWorkoutRow {
  const durationMin =
    w.durationSec != null && w.durationSec > 0
      ? clamp(Math.round(w.durationSec / 60), 0, 1440)
      : null
  const energyKcal =
    w.energyKcal != null && w.energyKcal > 0 ? clamp(Math.round(w.energyKcal), 0, 5000) : null
  return {
    source,
    external_id: w.uuid,
    started_at: w.start.toISOString(),
    ended_at: w.end.toISOString(),
    workout_type: hkActivityToWorkoutType(w.activityType),
    duration_min: durationMin,
    energy_kcal: energyKcal,
  }
}

/* Etapas que cuentan como DORMIDA: asleepUnspecified(1), core(3), deep(4),
 * REM(5). inBed(0) y awake(2) quedan fuera — el error clásico que infla. */
const ASLEEP_VALUES = new Set([1, 3, 4, 5])

/**
 * Muestras de etapas de sueño → una fila por DÍA EN QUE DESPERTÓ (día local
 * del fin de cada etapa). `external_id` es estable por día (`sleep-<fecha>`):
 * cada re-sync upserta la misma fila y la noche se completa sola aunque el
 * dato llegue tarde (backfill solo suma, spec §2).
 */
export function sleepSamplesToRows(
  samples: readonly RawSleepSample[],
  tz: string,
  source: WearableSource,
): WearableSleepRow[] {
  const byDay = new Map<string, { minutes: number; bed: Date; wake: Date }>()
  for (const s of samples) {
    if (!ASLEEP_VALUES.has(s.value)) continue
    const ms = s.end.getTime() - s.start.getTime()
    if (ms <= 0) continue
    const day = dayInTimezone(s.end, tz)
    const prev = byDay.get(day)
    if (prev) {
      prev.minutes += ms / 60000
      if (s.start < prev.bed) prev.bed = s.start
      if (s.end > prev.wake) prev.wake = s.end
    } else {
      byDay.set(day, { minutes: ms / 60000, bed: s.start, wake: s.end })
    }
  }
  return [...byDay.entries()]
    .map(([day, agg]) => ({
      source,
      external_id: `sleep-${day}`,
      sleep_date: day,
      bedtime_at: agg.bed.toISOString(),
      wake_at: agg.wake.toISOString(),
      asleep_minutes: clamp(Math.round(agg.minutes), 0, 1440),
    }))
    .filter((r) => r.asleep_minutes > 0)
    .sort((a, b) => a.sleep_date.localeCompare(b.sleep_date))
}

/** Buckets diarios de pasos → filas de wearable_steps (identidad = el día). */
export function stepsToRows(
  buckets: readonly RawDailySteps[],
  tz: string,
  source: WearableSource,
): WearableStepsRow[] {
  const byDay = new Map<string, number>()
  for (const b of buckets) {
    const steps = Math.round(b.steps)
    if (steps <= 0) continue
    const day = dayInTimezone(b.start, tz)
    byDay.set(day, (byDay.get(day) ?? 0) + steps)
  }
  return [...byDay.entries()]
    .map(([day, steps]) => ({ source, day_date: day, steps: clamp(steps, 0, 200000) }))
    .sort((a, b) => a.day_date.localeCompare(b.day_date))
}
