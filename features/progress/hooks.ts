import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { track } from '@/lib/analytics'
import { requireUserId, supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'

import { todayInTimezone } from '@/lib/time'

import {
  deletePhoto,
  getAllWorkoutDates,
  getBeforeAfterPhotos,
  getLastPeriodStart,
  getMeasurements,
  getMonthWorkoutDates,
  getRecentSleepLogs,
  getRecentWorkoutDates,
  getTotalTrainedDays,
  NewMeasurementInputSchema,
  type NewMeasurementInput,
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
export function useMeasurements(rangeDays: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.progress.measurements(rangeDays),
    queryFn: () => (SKIP_AUTH ? buildMockMeasurements(rangeDays) : getMeasurements(rangeDays)),
    enabled,
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

/* Delete one progress photo (row + storage object). Invalidates the
 * before/after pair so the diptych recomputes — the next-oldest front
 * photo becomes the "antes" on its own. */
export function useDeletePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, storagePath }: { id: string; storagePath: string }) =>
      deletePhoto(id, storagePath),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.photos.all })
      qc.invalidateQueries({ queryKey: queryKeys.progress.all })
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
    },
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

/** All-time distinct trained-day count — the "N días entrenados" stat. */
export function useTotalTrainedDays() {
  return useQuery({
    queryKey: ['progress', 'trainedTotal'] as const,
    queryFn: getTotalTrainedDays,
    staleTime: 60_000,
  })
}

/** Every trained day, all-time — powers the browsable Progreso
 *  calendar (month navigation is a client-side slice). */
export function useAllWorkoutDates() {
  return useQuery({
    queryKey: ['progress', 'allWorkouts'] as const,
    queryFn: getAllWorkoutDates,
    staleTime: 60_000,
  })
}

/** Workout dates in the current calendar month — feeds the month-based
 *  constellation. Keyed by month so it re-caches on the 1st. */
export function useMonthWorkoutDates() {
  const monthStart = `${todayInTimezone().slice(0, 7)}-01`
  return useQuery({
    queryKey: ['progress', 'monthWorkouts', monthStart] as const,
    queryFn: () => getMonthWorkoutDates(monthStart),
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
    mutationFn: async (input: NewMeasurementInput) => {
      const userId = await requireUserId()
      const parsed = NewMeasurementInputSchema.parse(input)
      const { error } = await supabase.from('body_measurements').insert({
        user_id: userId,
        weight_kg: parsed.weight_kg ?? null,
        waist_cm: parsed.waist_cm ?? null,
        chest_cm: parsed.chest_cm ?? null,
        hip_cm: parsed.hip_cm ?? null,
        thigh_cm: parsed.thigh_cm ?? null,
        arm_cm: parsed.arm_cm ?? null,
        measured_at: parsed.measured_at ?? new Date().toISOString(),
      })
      if (error) throw error
      if (parsed.weight_kg != null) track('weight_logged')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.progress.all })
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
    },
  })
}
