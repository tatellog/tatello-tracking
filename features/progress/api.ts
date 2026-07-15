import { z } from 'zod'

import { BodyMeasurementSchema, type BodyMeasurement } from '@/features/brief/api'
import { requireUserId, supabase } from '@/lib/supabase'
import { withTimeout } from '@/lib/withTimeout'

import type { Milestone } from './milestones'

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
 * photos only (the canonical comparison angle) and spans the full
 * history — earliest vs latest — regardless of the page's range
 * selector. RLS scopes the table to the caller.
 *
 * `sinceIso` (capítulos · decisión benchmark + target-user): cuando una foto
 * nueva llega tras un gap largo, abre un CAPÍTULO — el par se deriva solo de
 * las fotos desde esa fecha, para que la foto nueva sea el punto de partida
 * de hoy y no el "después" automático contra el mejor momento de 2024. Si el
 * capítulo quedó vacío (se borró su foto), cae al historial completo.
 */
export async function getBeforeAfterPhotos(sinceIso?: string | null): Promise<BeforeAfter> {
  const { data, error } = await supabase
    .from('photos')
    .select('id, taken_at, storage_path')
    .eq('angle', 'front')
    .order('taken_at', { ascending: true })
  if (error) throw error

  let rows = data ?? []
  if (sinceIso) {
    const chapter = rows.filter((r) => r.taken_at >= sinceIso)
    if (chapter.length > 0) rows = chapter
  }
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

/* ─── Body · check-ins manuales (F0 · Progress 3.0) ────────────────── */

/** Rango numérico opcional (espeja los CHECK de la migración: la app falla
 *  rápido en español en vez de un error de Postgres). */
const bounded = (min: number, max: number, label: string) =>
  z
    .number()
    .min(min, `${label}: mínimo ${min}`)
    .max(max, `${label}: máximo ${max}`)
    .nullable()
    .optional()

/** Un check-in de composición (registro del coach o captura manual). Todas las
 *  métricas opcionales — capturas lo que tengas; la DB exige al menos una. */
export const BodyCheckinInputSchema = z.object({
  measured_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato AAAA-MM-DD'),
  source: z.enum(['manual', 'coach']).default('manual'),
  weight_kg: bounded(20.1, 399, 'Peso'),
  bmi: bounded(5, 100, 'IMC'),
  bmr_kcal: bounded(500, 6000, 'TMB'),
  water_pct: bounded(0, 100, 'Agua'),
  bone_mass_kg: bounded(0, 20, 'Masa ósea'),
  metabolic_age: bounded(10, 120, 'Edad metabólica'),
  visceral_fat_index: bounded(0, 60, 'Visceral'),
  muscle_kg: bounded(0, 100, 'Músculo'),
  muscle_arm_right_kg: bounded(0, 20, 'Brazo der'),
  muscle_arm_left_kg: bounded(0, 20, 'Brazo izq'),
  muscle_trunk_kg: bounded(0, 60, 'Tronco'),
  muscle_leg_right_kg: bounded(0, 30, 'Pierna der'),
  muscle_leg_left_kg: bounded(0, 30, 'Pierna izq'),
  body_fat_pct: bounded(0, 100, 'Grasa'),
  fat_arm_right_pct: bounded(0, 100, 'Grasa brazo der'),
  fat_arm_left_pct: bounded(0, 100, 'Grasa brazo izq'),
  fat_trunk_pct: bounded(0, 100, 'Grasa tronco'),
  fat_leg_right_pct: bounded(0, 100, 'Grasa pierna der'),
  fat_leg_left_pct: bounded(0, 100, 'Grasa pierna izq'),
  // Medidas de cinta (Epic 08 · rediseño Nueva medición): espejan los CHECK
  // de la migración 20260714220000.
  neck_cm: bounded(10.1, 99.9, 'Cuello'),
  chest_cm: bounded(30.1, 249.9, 'Pecho'),
  waist_cm: bounded(30.1, 249.9, 'Cintura'),
  abdomen_cm: bounded(30.1, 249.9, 'Abdomen'),
  hips_cm: bounded(30.1, 249.9, 'Caderas'),
  arm_right_cm: bounded(10.1, 99.9, 'Brazo der'),
  arm_left_cm: bounded(10.1, 99.9, 'Brazo izq'),
  thigh_right_cm: bounded(20.1, 149.9, 'Muslo der'),
  thigh_left_cm: bounded(20.1, 149.9, 'Muslo izq'),
  calf_right_cm: bounded(10.1, 99.9, 'Pantorrilla der'),
  calf_left_cm: bounded(10.1, 99.9, 'Pantorrilla izq'),
  notes: z.string().max(500).nullable().optional(),
})
export type BodyCheckinInput = z.infer<typeof BodyCheckinInputSchema>

export const BodyCheckinSchema = BodyCheckinInputSchema.extend({
  id: z.string(),
})
export type BodyCheckin = z.infer<typeof BodyCheckinSchema>

/** Guarda (o actualiza) un check-in. Upsert por (usuaria, día, fuente):
 *  re-capturar el mismo día edita, no duplica. */
export async function upsertBodyCheckin(input: BodyCheckinInput): Promise<void> {
  const userId = await requireUserId()
  const parsed = BodyCheckinInputSchema.parse(input)
  const { error } = await supabase
    .from('body_checkins')
    .upsert({ user_id: userId, ...parsed }, { onConflict: 'user_id,measured_on,source' })
  if (error) throw error
}

/** Todos los check-ins, ascendentes por fecha (RLS scopea a la usuaria). */
export async function getBodyCheckins(): Promise<BodyCheckin[]> {
  const { data, error } = await supabase
    .from('body_checkins')
    .select('*')
    .order('measured_on', { ascending: true })
  if (error) throw error
  return z.array(BodyCheckinSchema).parse(data ?? [])
}

/* ─── Body (Epic 02): composición corporal + timeline de fotos ────── */

/** Snapshot de composición de un día (de la báscula/HealthKit vía ingesta
 *  wearable). Solo las métricas que la ingesta trae HOY: grasa, masa magra,
 *  IMC. Agua/visceral/edad metabólica/TMB llegarán con futuras fuentes. */
export const BodyCompositionSchema = z.object({
  day_date: z.string(),
  body_fat_pct: z.number().nullable(),
  lean_body_mass_kg: z.number().nullable(),
  bmi: z.number().nullable(),
})
export type BodyComposition = z.infer<typeof BodyCompositionSchema>

/** Composición corporal ascendente por día (RLS scopea a la usuaria). Con
 *  varias fuentes el upsert es por (source, día); aquí se aplana por día
 *  tomando la fila más reciente. */
export async function getBodyComposition(rangeDays: number | null): Promise<BodyComposition[]> {
  let query = supabase
    .from('wearable_body_composition')
    .select('day_date, body_fat_pct, lean_body_mass_kg, bmi, updated_at')
    .order('day_date', { ascending: true })
  if (rangeDays != null) {
    const since = new Date()
    since.setDate(since.getDate() - rangeDays)
    query = query.gte('day_date', since.toISOString().slice(0, 10))
  }
  const { data, error } = await query
  if (error) throw error
  // Una fila por día: la última actualizada gana (fuentes múltiples).
  const byDay = new Map<string, BodyComposition>()
  for (const row of data ?? []) {
    byDay.set(row.day_date as string, BodyCompositionSchema.parse(row))
  }
  return [...byDay.values()]
}

export type PhotoAngle = 'front' | 'back' | 'side_left' | 'side_right'

/** Una foto del timeline (con URL firmada; null si falló la firma). */
export type TimelinePhoto = {
  id: string
  taken_at: string
  angle: PhotoAngle
  signed_url: string | null
}

/** TODAS las fotos de progreso (4 ángulos) con URLs firmadas EN LOTE (una
 *  llamada de storage, no una por foto). Alimenta el comparador por fechas. */
export async function getPhotoTimeline(): Promise<TimelinePhoto[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('id, taken_at, angle, storage_path')
    .order('taken_at', { ascending: true })
  if (error) throw error
  const rows = (data ?? []).filter(
    (r): r is typeof r & { angle: PhotoAngle } =>
      r.angle === 'front' ||
      r.angle === 'back' ||
      r.angle === 'side_left' ||
      r.angle === 'side_right',
  )
  if (rows.length === 0) return []
  const { data: signed, error: signErr } = await supabase.storage
    .from('progress-photos')
    .createSignedUrls(
      rows.map((r) => r.storage_path as string),
      PHOTO_URL_TTL,
    )
  if (signErr) console.warn('[progress] createSignedUrls failed', signErr.message)
  return rows.map((r, i) => ({
    id: r.id as string,
    taken_at: r.taken_at as string,
    angle: r.angle,
    signed_url: signed?.[i]?.signedUrl ?? null,
  }))
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

/** Total distinct days trained, all-time. `workouts` has a UNIQUE
 *  (user_id, workout_date), so a row count = a trained-day count. */
export async function getTotalTrainedDays(): Promise<number> {
  const { count, error } = await supabase
    .from('workouts')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

/** Every workout date (YYYY-MM-DD), all-time, ascending. Powers the
 *  browsable Progreso calendar: navigating months is then a pure
 *  client-side slice with no per-month refetch. The set is small (one
 *  row per trained day), so loading the whole history is cheap. */
export async function getAllWorkoutDates(): Promise<string[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('workout_date')
    .order('workout_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => r.workout_date as string)
}

/** YYYY-MM-DD workout dates from `monthStart` (the 1st of the current
 *  calendar month) onward — feeds the month-based constellation. */
export async function getMonthWorkoutDates(monthStart: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('workout_date')
    .gte('workout_date', monthStart)
    .order('workout_date', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => r.workout_date as string)
}

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

/**
 * Persiste hitos de Historia en `revelations` (tier='milestone'), idempotente:
 * el índice único parcial (user_id, kind) where tier='milestone' garantiza uno
 * por usuaria; un duplicado lanza 23505 y se traga como no-op (mismo patrón que
 * recordRevelation). Inserta uno por uno porque un INSERT en lote fallaría entero
 * al primer conflicto. La fecha real del hito va en metadata.on (shown_at es
 * cuándo se registró; la Historia ordena/etiqueta por metadata.on).
 */
export async function recordMilestones(milestones: readonly Milestone[]): Promise<void> {
  if (milestones.length === 0) return
  const userId = await requireUserId()
  for (const m of milestones) {
    const { error } = await supabase.from('revelations').insert({
      user_id: userId,
      tier: 'milestone',
      kind: m.kind,
      title: m.title,
      metadata: { on: m.date },
    })
    if (error && error.code !== '23505') throw error
  }
}
