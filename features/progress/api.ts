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
