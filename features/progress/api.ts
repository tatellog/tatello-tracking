import { z } from 'zod'

import { BodyMeasurementSchema, type BodyMeasurement } from '@/features/brief/api'
import { supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'

const MeasurementListSchema = z.array(BodyMeasurementSchema)

/*
 * Bounded write schema for new body measurements. Mirrors the CHECK
 * constraints in 20260527120001_data_validation_checks.sql so the
 * client fails fast with a useful Spanish message instead of
 * surfacing a Postgres CHECK-violation error. Every field is
 * optional (a user may submit just a weight, or just a waist), but
 * at least one must be present — otherwise the row carries no
 * signal.
 */
const KG_MAX = 500
const CM_MAX = 300
const CM_MAX_LIMB = 200

export const NewMeasurementInputSchema = z
  .object({
    weight_kg: z
      .number()
      .positive('El peso debe ser mayor a 0')
      .lt(KG_MAX, `Máximo ${KG_MAX} kg`)
      .nullable()
      .optional(),
    waist_cm: z
      .number()
      .positive('La medida debe ser mayor a 0')
      .lt(CM_MAX, `Máximo ${CM_MAX} cm`)
      .nullable()
      .optional(),
    chest_cm: z
      .number()
      .positive('La medida debe ser mayor a 0')
      .lt(CM_MAX, `Máximo ${CM_MAX} cm`)
      .nullable()
      .optional(),
    hip_cm: z
      .number()
      .positive('La medida debe ser mayor a 0')
      .lt(CM_MAX, `Máximo ${CM_MAX} cm`)
      .nullable()
      .optional(),
    thigh_cm: z
      .number()
      .positive('La medida debe ser mayor a 0')
      .lt(CM_MAX_LIMB, `Máximo ${CM_MAX_LIMB} cm`)
      .nullable()
      .optional(),
    arm_cm: z
      .number()
      .positive('La medida debe ser mayor a 0')
      .lt(CM_MAX_LIMB, `Máximo ${CM_MAX_LIMB} cm`)
      .nullable()
      .optional(),
    measured_at: z.string().datetime().optional(),
  })
  .refine(
    (v) =>
      v.weight_kg != null ||
      v.waist_cm != null ||
      v.chest_cm != null ||
      v.hip_cm != null ||
      v.thigh_cm != null ||
      v.arm_cm != null,
    'Al menos una medida debe tener valor',
  )

export type NewMeasurementInput = z.infer<typeof NewMeasurementInputSchema>

/*
 * Cargar todas las medidas del usuario, opcionalmente acotadas a los
 * últimos `rangeDays` días. RLS asegura que sólo se devuelvan filas del
 * authenticated user; no pasamos user_id en el query.
 *
 * Devolvemos el array ordenado ascendente (más antigua primero) — así
 * el WeightChart no tiene que reordenar antes de dibujar la línea.
 */
export async function getMeasurements(rangeDays: number | null): Promise<BodyMeasurement[]> {
  let query = supabase
    .from('body_measurements')
    .select('*')
    .order('measured_at', { ascending: true })

  if (rangeDays != null) {
    const since = new Date()
    since.setDate(since.getDate() - rangeDays)
    query = query.gte('measured_at', since.toISOString())
  }

  const { data, error } = await query
  if (error) throw error
  return MeasurementListSchema.parse(data)
}

/* ─── progress photos ─────────────────────────────────────────────── */

export type ProgressPhoto = {
  id: string
  taken_at: string
  /** Bucket path — needed to remove the storage object on delete. */
  storage_path: string
  /** Signed URL into the private bucket; null if signing failed. */
  signed_url: string | null
}

export type BeforeAfter = {
  /** Earliest front photo — the "before". */
  before: ProgressPhoto | null
  /** Latest front photo — the "now". Null until there are 2+. */
  after: ProgressPhoto | null
  count: number
}

const PHOTO_URL_TTL = 60 * 60

/*
 * The before/after pair for the Progreso page. Uses the front-angle
 * photos only (the canonical comparison angle) and always spans the
 * full history — earliest vs latest — regardless of the page's range
 * selector. RLS scopes the table to the caller.
 */
export async function getBeforeAfterPhotos(): Promise<BeforeAfter> {
  const { data, error } = await supabase
    .from('photos')
    .select('id, taken_at, storage_path')
    .eq('angle', 'front')
    .order('taken_at', { ascending: true })
  if (error) throw error

  const rows = data ?? []
  const firstRow = rows[0]
  if (!firstRow) return { before: null, after: null, count: 0 }

  const sign = async (row: {
    id: string
    taken_at: string
    storage_path: string
  }): Promise<ProgressPhoto> => {
    const { data: signed, error: signErr } = await supabase.storage
      .from('progress-photos')
      .createSignedUrl(row.storage_path, PHOTO_URL_TTL)
    if (signErr || !signed?.signedUrl) {
      // Visibility: when signing silently fails the photo row still
      // exists but the frame falls back to the placeholder — the user
      // saw "subí fotos y no se ven". Log so we can diagnose path /
      // RLS / bucket config issues.
      console.warn('[progress] createSignedUrl failed', {
        storage_path: row.storage_path,
        error: signErr?.message ?? 'no signedUrl returned',
      })
    }
    return {
      id: row.id,
      taken_at: row.taken_at,
      storage_path: row.storage_path,
      signed_url: signed?.signedUrl ?? null,
    }
  }

  const lastRow = rows[rows.length - 1]
  if (rows.length === 1 || !lastRow) {
    return { before: await sign(firstRow), after: null, count: 1 }
  }
  const [before, after] = await Promise.all([sign(firstRow), sign(lastRow)])
  return { before, after, count: rows.length }
}

/*
 * Delete one progress photo — the row in `photos` plus its storage
 * object. RLS scopes both to the owner (auth.uid() = user_id on the
 * table; the {userId}/ folder gate on the bucket). The DB row is the
 * source of truth for the diptych, so we delete it FIRST; the storage
 * removal is best-effort cleanup (an orphaned object only leaks bytes,
 * never shows). After a delete the before/after pair recomputes itself
 * (the next-oldest front photo becomes the "antes").
 */
export async function deletePhoto(id: string, storagePath: string): Promise<void> {
  const { error } = await withTimeout(
    // Promise.resolve adopts the Postgrest thenable into a real Promise.
    Promise.resolve(supabase.from('photos').delete().eq('id', id)),
    15_000,
    'No se pudo eliminar la foto. Revisa tu conexión e intenta de nuevo.',
  )
  if (error) throw error
  // Best-effort storage cleanup — timeout-guarded so a stalled remove
  // can't hang the mutation; an orphaned object only leaks bytes.
  try {
    await withTimeout(supabase.storage.from('progress-photos').remove([storagePath]), 15_000)
  } catch {
    // Ignore — the row is gone, which is what the diptych reads.
  }
}

/* ─── extra reads for the Progress overview cards ────────────────── */

/** YYYY-MM-DD dates of every workout in the last `rangeDays`. */
export async function getRecentWorkoutDates(rangeDays: number): Promise<string[]> {
  const since = new Date()
  since.setDate(since.getDate() - rangeDays)
  const sinceIso = since.toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('workouts')
    .select('workout_date')
    .gte('workout_date', sinceIso)
    .order('workout_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => r.workout_date as string)
}

/** Sleep entries (hours per local date) over the window. The DB
 *  stores `duration_minutes`; we convert to hours at the boundary so
 *  the rest of Progress can think in human units. */
export type SleepEntry = { date: string; hours: number }
export async function getRecentSleepLogs(rangeDays: number): Promise<SleepEntry[]> {
  const since = new Date()
  since.setDate(since.getDate() - rangeDays)
  const sinceIso = since.toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('sleep_logs')
    .select('sleep_date, duration_minutes')
    .gte('sleep_date', sinceIso)
    .order('sleep_date', { ascending: true })
  if (error) throw error
  return (data ?? [])
    .filter((r) => r.duration_minutes != null)
    .map((r) => ({
      date: r.sleep_date as string,
      hours: (r.duration_minutes as number) / 60,
    }))
}

/** The most recent period_start date in `cycle_events`, or null. */
export async function getLastPeriodStart(): Promise<string | null> {
  const { data, error } = await supabase
    .from('cycle_events')
    .select('event_date')
    .eq('event_type', 'period_start')
    .order('event_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data?.event_date as string | undefined) ?? null
}
