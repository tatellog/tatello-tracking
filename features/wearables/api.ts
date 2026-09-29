/*
 * Wearables — capa de datos (Zod + Supabase). Upserts idempotentes a las
 * tablas crudas `wearable_*`: re-sincronizar NUNCA duplica (UNIQUE por
 * user+source+external_id / día). La view daily_signals hace el merge
 * "manual gana" sola; aquí solo se escribe.
 */
import { z } from 'zod'

import { requireUserId, supabase } from '@/lib/supabase'

import type {
  WearableBodyCompositionRow,
  WearableSleepRow,
  WearableStepsRow,
  WearableWaterRow,
  WearableWeightRow,
  WearableWorkoutRow,
} from './logic'

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const workoutRowSchema = z.object({
  source: z.enum(['apple_health', 'garmin']),
  external_id: z.string().min(1).max(256),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  workout_type: z.string().max(64).nullable(),
  duration_min: z.number().int().min(0).max(1440).nullable(),
  energy_kcal: z.number().int().min(0).max(5000).nullable(),
})

const sleepRowSchema = z.object({
  source: z.enum(['apple_health', 'garmin']),
  external_id: z.string().min(1).max(256),
  sleep_date: isoDay,
  bedtime_at: z.string().datetime().nullable(),
  wake_at: z.string().datetime().nullable(),
  asleep_minutes: z.number().int().min(0).max(1440),
  deep_minutes: z.number().int().min(0).max(1440).nullable(),
  core_minutes: z.number().int().min(0).max(1440).nullable(),
  rem_minutes: z.number().int().min(0).max(1440).nullable(),
  awake_minutes: z.number().int().min(0).max(1440).nullable(),
})

const stepsRowSchema = z.object({
  source: z.enum(['apple_health', 'garmin']),
  day_date: isoDay,
  steps: z.number().int().min(0).max(200000),
})

const waterRowSchema = z.object({
  source: z.enum(['apple_health', 'garmin']),
  day_date: isoDay,
  water_ml: z.number().int().min(0).max(10000),
})

const weightRowSchema = z.object({
  source: z.enum(['apple_health', 'garmin']),
  day_date: isoDay,
  measured_at: z.string().datetime(),
  weight_kg: z.number().min(20).max(400),
})

const latestWeightSchema = z.object({
  measured_at: z.string(),
  weight_kg: z.number(),
  day_date: isoDay,
})

export type LatestWearableWeight = z.infer<typeof latestWeightSchema>
/** Un punto de la báscula para la serie fusionada de Progreso. */
export type WearableWeightPoint = LatestWearableWeight

const bodyCompositionRowSchema = z
  .object({
    source: z.enum(['apple_health', 'garmin']),
    day_date: isoDay,
    body_fat_pct: z.number().min(0).max(100).nullable(),
    lean_body_mass_kg: z.number().min(0).max(300).nullable(),
    bmi: z.number().min(0).max(100).nullable(),
  })
  // Espeja el CHECK de la tabla: una fila sin ningún valor no aporta señal.
  .refine((r) => r.body_fat_pct != null || r.lean_body_mass_kg != null || r.bmi != null, {
    message: 'body composition row has no value',
  })

/** Upsert de workouts del reloj. Devuelve cuántas filas se escribieron. */
export async function upsertWearableWorkouts(rows: WearableWorkoutRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const userId = await requireUserId()
  const parsed = z.array(workoutRowSchema).parse(rows)
  const { error } = await supabase.from('wearable_workouts').upsert(
    parsed.map((r) => ({ ...r, user_id: userId })),
    { onConflict: 'user_id,source,external_id' },
  )
  if (error) throw error
  return parsed.length
}

/** Upsert del sueño del reloj (una fila por día en que despertó). */
export async function upsertWearableSleep(rows: WearableSleepRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const userId = await requireUserId()
  const parsed = z.array(sleepRowSchema).parse(rows)
  const { error } = await supabase.from('wearable_sleep').upsert(
    parsed.map((r) => ({ ...r, user_id: userId })),
    { onConflict: 'user_id,source,external_id' },
  )
  if (error) throw error
  return parsed.length
}

/** Una noche del reloj tal como la lee la pantalla de detalle de sueño. */
const sleepNightSchema = z.object({
  sleep_date: isoDay,
  bedtime_at: z.string().nullable(),
  wake_at: z.string().nullable(),
  asleep_minutes: z.number().int(),
  deep_minutes: z.number().int().nullable(),
  core_minutes: z.number().int().nullable(),
  rem_minutes: z.number().int().nullable(),
  awake_minutes: z.number().int().nullable(),
})
export type SleepNight = z.infer<typeof sleepNightSchema>

/** Las noches del reloj en [fromDay, toDay] (días en que despertó), asc. */
export async function getWearableSleepNights(
  fromDay: string,
  toDay: string,
): Promise<SleepNight[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('wearable_sleep')
    .select(
      'sleep_date, bedtime_at, wake_at, asleep_minutes, deep_minutes, core_minutes, rem_minutes, awake_minutes',
    )
    .eq('user_id', userId)
    .gte('sleep_date', fromDay)
    .lte('sleep_date', toDay)
    .order('sleep_date', { ascending: true })
  if (error) throw error
  return z.array(sleepNightSchema).parse(data ?? [])
}

/** Upsert de pasos diarios (ingest-only: el motor los leerá cuando toque). */
export async function upsertWearableSteps(rows: WearableStepsRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const userId = await requireUserId()
  const parsed = z.array(stepsRowSchema).parse(rows)
  const { error } = await supabase.from('wearable_steps').upsert(
    parsed.map((r) => ({ ...r, user_id: userId })),
    { onConflict: 'user_id,source,day_date' },
  )
  if (error) throw error
  return parsed.length
}

/** Upsert del agua bebida por día (mL) que Salud trae de apps o del reloj. */
export async function upsertWearableWater(rows: WearableWaterRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const userId = await requireUserId()
  const parsed = z.array(waterRowSchema).parse(rows)
  const { error } = await supabase.from('wearable_water').upsert(
    parsed.map((r) => ({ ...r, user_id: userId })),
    { onConflict: 'user_id,source,day_date' },
  )
  if (error) throw error
  return parsed.length
}

/** Upsert del peso de la báscula (una fila por día · última lectura del día). */
export async function upsertWearableWeight(rows: WearableWeightRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const userId = await requireUserId()
  const parsed = z.array(weightRowSchema).parse(rows)
  const { error } = await supabase.from('wearable_weight').upsert(
    parsed.map((r) => ({ ...r, user_id: userId })),
    { onConflict: 'user_id,source,day_date' },
  )
  if (error) throw error
  return parsed.length
}

/** La lectura más reciente de la báscula (para el ícono de Hoy y la pantalla
 *  "Tu báscula"). Null si nunca llegó nada. */
export async function getLatestWearableWeight(): Promise<LatestWearableWeight | null> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('wearable_weight')
    .select('measured_at, weight_kg, day_date')
    .eq('user_id', userId)
    .order('measured_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? latestWeightSchema.parse(data) : null
}

/** Toda la serie de la báscula (asc por día) — la tendencia de Progreso la
 *  fusiona con lo manual (manual gana el día, la báscula rellena). */
export async function getWearableWeights(): Promise<WearableWeightPoint[]> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('wearable_weight')
    .select('measured_at, weight_kg, day_date')
    .eq('user_id', userId)
    .order('measured_at', { ascending: true })
  if (error) throw error
  return z.array(latestWeightSchema).parse(data ?? [])
}

/** Upsert de composición corporal (una fila por día · snapshot de la báscula). */
export async function upsertWearableBodyComposition(
  rows: WearableBodyCompositionRow[],
): Promise<number> {
  if (rows.length === 0) return 0
  const userId = await requireUserId()
  const parsed = z.array(bodyCompositionRowSchema).parse(rows)
  const { error } = await supabase.from('wearable_body_composition').upsert(
    parsed.map((r) => ({ ...r, user_id: userId })),
    { onConflict: 'user_id,source,day_date' },
  )
  if (error) throw error
  return parsed.length
}

/* ── Lo que trajo Salud en un rango (pantalla "Tu smartwatch") ─────────── */

const summaryWorkoutSchema = z.object({
  started_at: z.string(),
  ended_at: z.string(),
  workout_type: z.string().nullable(),
  duration_min: z.number().nullable(),
  energy_kcal: z.number().nullable(),
})
const summaryStepsSchema = z.object({ day_date: isoDay, steps: z.number() })
const summaryWaterSchema = z.object({ day_date: isoDay, water_ml: z.number() })

export type HealthWorkout = z.infer<typeof summaryWorkoutSchema>
export type HealthSummary = {
  /** Cada sesión, asc por inicio (el check-in de Hoy solo muestra el total). */
  workouts: HealthWorkout[]
  steps: z.infer<typeof summaryStepsSchema>[]
  water: z.infer<typeof summaryWaterSchema>[]
}

/** Entrenos, pasos y agua de Salud en [fromDay, toDay] (días locales). Los
 *  entrenos se traen con un día de colchón por lado (instantes UTC); la
 *  lógica pura los asigna a su día local con la zona de la usuaria. */
export async function getHealthSummary(fromDay: string, toDay: string): Promise<HealthSummary> {
  const userId = await requireUserId()
  const pad = (iso: string, n: number) => {
    const d = new Date(`${iso}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() + n)
    return d.toISOString()
  }
  const fromStartUtc = pad(fromDay, -1)
  const toEndUtc = pad(toDay, 2)
  const [w, st, wa] = await Promise.all([
    supabase
      .from('wearable_workouts')
      .select('started_at, ended_at, workout_type, duration_min, energy_kcal')
      .eq('user_id', userId)
      .gte('started_at', fromStartUtc)
      .lt('started_at', toEndUtc)
      .order('started_at', { ascending: true }),
    supabase
      .from('wearable_steps')
      .select('day_date, steps')
      .eq('user_id', userId)
      .gte('day_date', fromDay)
      .lte('day_date', toDay)
      .order('day_date', { ascending: true }),
    supabase
      .from('wearable_water')
      .select('day_date, water_ml')
      .eq('user_id', userId)
      .gte('day_date', fromDay)
      .lte('day_date', toDay)
      .order('day_date', { ascending: true }),
  ])
  if (w.error) throw w.error
  if (st.error) throw st.error
  if (wa.error) throw wa.error
  return {
    workouts: z.array(summaryWorkoutSchema).parse(w.data ?? []),
    steps: z.array(summaryStepsSchema).parse(st.data ?? []),
    water: z.array(summaryWaterSchema).parse(wa.data ?? []),
  }
}
