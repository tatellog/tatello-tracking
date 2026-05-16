import { z } from 'zod'

import { BodyMeasurementSchema, type BodyMeasurement } from '@/features/brief/api'
import { supabase } from '@/lib/supabase'

const MeasurementListSchema = z.array(BodyMeasurementSchema)

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
    const { data: signed } = await supabase.storage
      .from('progress-photos')
      .createSignedUrl(row.storage_path, PHOTO_URL_TTL)
    return { id: row.id, taken_at: row.taken_at, signed_url: signed?.signedUrl ?? null }
  }

  const lastRow = rows[rows.length - 1]
  if (rows.length === 1 || !lastRow) {
    return { before: await sign(firstRow), after: null, count: 1 }
  }
  const [before, after] = await Promise.all([sign(firstRow), sign(lastRow)])
  return { before, after, count: rows.length }
}
