/*
 * Wearables — capa de datos (Zod + Supabase). Upserts idempotentes a las
 * tablas crudas `wearable_*`: re-sincronizar NUNCA duplica (UNIQUE por
 * user+source+external_id / día). La view daily_signals hace el merge
 * "manual gana" sola; aquí solo se escribe.
 */
import { z } from 'zod'

import { requireUserId, supabase } from '@/lib/supabase'

import type { WearableSleepRow, WearableStepsRow, WearableWorkoutRow } from './logic'

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
})

const stepsRowSchema = z.object({
  source: z.enum(['apple_health', 'garmin']),
  day_date: isoDay,
  steps: z.number().int().min(0).max(200000),
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
