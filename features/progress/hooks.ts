import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { requireUserId, supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'

import { getMeasurements } from './api'

/*
 * Lectura: useMeasurements(rangeDays) — null = todo el historial.
 *
 * Pasamos `rangeDays` como parte del queryKey, así cada rango cachea
 * por separado y switchear de '7d' a '30d' es instantáneo si ya se
 * fetcheó antes.
 */
export function useMeasurements(rangeDays: number | null) {
  return useQuery({
    queryKey: queryKeys.progress.measurements(rangeDays),
    queryFn: () => getMeasurements(rangeDays),
  })
}

/*
 * Escritura: useAddMeasurement.
 *
 * Después del insert, invalidamos:
 *   - queryKeys.progress.all (todos los rangos cacheados)
 *   - queryKeys.brief.all   (la home muestra delta peso/cintura)
 * El brief context se refresca al toque para que el delta del Home se
 * sincronice con la nueva medida sin esperar refetch manual.
 */
type NewMeasurement = {
  weight_kg?: number | null
  waist_cm?: number | null
  measured_at?: string
}

export function useAddMeasurement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewMeasurement) => {
      const userId = await requireUserId()
      const { error } = await supabase.from('body_measurements').insert({
        user_id: userId,
        weight_kg: input.weight_kg ?? null,
        waist_cm: input.waist_cm ?? null,
        measured_at: input.measured_at ?? new Date().toISOString(),
      })
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.progress.all })
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
    },
  })
}
