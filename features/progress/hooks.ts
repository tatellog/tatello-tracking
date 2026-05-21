import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { requireUserId, supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'

import {
  getBeforeAfterPhotos,
  getLastPeriodStart,
  getMeasurements,
  getRecentSleepLogs,
  getRecentWorkoutDates,
} from './api'
import { buildMockMeasurements } from './mock'

const SKIP_AUTH = process.env.EXPO_PUBLIC_SKIP_AUTH === 'true'

/*
 * Lectura: useMeasurements(rangeDays) — null = todo el historial.
 *
 * Pasamos `rangeDays` como parte del queryKey, así cada rango cachea
 * por separado y switchear de '7d' a '30d' es instantáneo si ya se
 * fetcheó antes.
 *
 * En modo SKIP_AUTH (dev iteration sin sesión), devolvemos un set
 * mockeado para que la gráfica tenga datos visibles. En producción
 * ese branch es tree-shakeado.
 */
export function useMeasurements(rangeDays: number | null) {
  return useQuery({
    queryKey: queryKeys.progress.measurements(rangeDays),
    queryFn: () => (SKIP_AUTH ? buildMockMeasurements(rangeDays) : getMeasurements(rangeDays)),
  })
}

/*
 * Lectura: useBeforeAfterPhotos — el par antes/ahora (frontal) para la
 * página de Progreso. Refresca al volver al tab + al recuperar foco
 * para que una foto recién subida desde otra surface (onboarding /
 * settings) aparezca sin esperar el invalidate.
 */
export function useBeforeAfterPhotos() {
  return useQuery({
    queryKey: queryKeys.photos.beforeAfter(),
    queryFn: getBeforeAfterPhotos,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
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

/*
 * Reads for the Progress overview cards. Each query is keyed by the
 * window length so flips between 7d/30d/60d cache independently. The
 * Progress tab usually wants 60 days (covers the 30-day comparativa
 * + the 28-day movement constellation in one fetch).
 */
export function useRecentWorkoutDates(rangeDays: number) {
  return useQuery({
    queryKey: ['progress', 'workouts', rangeDays] as const,
    queryFn: () => getRecentWorkoutDates(rangeDays),
    staleTime: 60_000,
  })
}

export function useRecentSleepLogs(rangeDays: number) {
  return useQuery({
    queryKey: ['progress', 'sleep', rangeDays] as const,
    queryFn: () => getRecentSleepLogs(rangeDays),
    staleTime: 60_000,
  })
}

export function useLastPeriodStart() {
  return useQuery({
    queryKey: ['progress', 'cycle', 'last-period'] as const,
    queryFn: getLastPeriodStart,
    staleTime: 5 * 60_000,
  })
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
