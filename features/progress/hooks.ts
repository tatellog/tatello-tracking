import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useMacroTargets } from '@/features/macros/hooks'
import { useSignalsHistory } from '@/features/orbit/hooks'
import { track } from '@/lib/analytics'
import { MILESTONES_ENABLED } from '@/lib/featureFlags'
import { requireUserId, supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'

import { todayInTimezone } from '@/lib/time'

import {
  deletePhoto,
  getAllWorkoutDates,
  getBeforeAfterPhotos,
  getBodyComposition,
  getLastPeriodStart,
  getMeasurements,
  getMonthWorkoutDates,
  getPhotoTimeline,
  getRecentSleepLogs,
  getRecentWorkoutDates,
  getTotalTrainedDays,
  NewMeasurementInputSchema,
  recordMilestones,
  type NewMeasurementInput,
} from './api'
import { PROGRESS_COMPARE_WINDOW_DAYS } from './constants'
import { generateProgressInsights, type ProgressInsight, type WeightSample } from './insights'
import { compareHistory, photoDatesFor, smoothWeightPoints, toWeightPoints } from './logic'
import { detectMilestones } from './milestones'
import { buildMockMeasurements } from './mock'
import { type HistorySummary, toProgressState, type ProgressState } from './types'

// Ventana amplia = "todo el historial" (los hitos son la PRIMERA vez). La app es
// reciente; 400 días cubre a cualquier usuaria de la beta.
const MILESTONE_WINDOW_DAYS = 400

/**
 * Sync de hitos de Historia (R3 · T-R3.3), GATEADO por MILESTONES_ENABLED (hoy
 * OFF) y aún SIN montar en ninguna pantalla. Detecta los hitos de primera vez
 * desde el historial y los persiste en `revelations` (idempotente). Cuando exista
 * la UI de Historia se monta ahí; ahí conviene además gatear el fetch por el flag.
 */
export function useMilestoneSync() {
  const { data: history } = useSignalsHistory(MILESTONE_WINDOW_DAYS)
  const targets = useMacroTargets().data
  useEffect(() => {
    if (!MILESTONES_ENABLED || !history || history.length === 0) return
    const milestones = detectMilestones({
      signals: history,
      calorieTarget: targets?.calories ?? null,
    })
    if (milestones.length > 0) void recordMilestones(milestones)
  }, [history, targets?.calories])
}

/**
 * Epic 01 · Historia — "¿cómo cambiaron mis hábitos?" (30v30). Compone las
 * lecturas (señales + medidas + metas) y corre el Comparison Engine puro,
 * devolviendo un `ProgressState<HistorySummary>` para que la UI no combine
 * isLoading/data/error a mano. Determinístico (el motor recibe `today`).
 */
export function useHistory(
  windowDays = PROGRESS_COMPARE_WINDOW_DAYS,
): ProgressState<HistorySummary> {
  const signals = useSignalsHistory(windowDays * 2 + 5)
  const measurements = useMeasurements(null)
  const targets = useMacroTargets().data
  const today = todayInTimezone()

  const summary = useMemo<HistorySummary | undefined>(() => {
    if (!signals.data) return undefined
    return compareHistory(signals.data, measurements.data ?? [], {
      today,
      calorieTarget: targets?.calories ?? null,
      proteinTarget: targets?.protein_g ?? null,
      windowDays,
    })
  }, [signals.data, measurements.data, targets?.calories, targets?.protein_g, today, windowDays])

  return toProgressState(
    { isPending: signals.isPending, isError: signals.isError, error: signals.error, data: summary },
    // Vacío = usuaria nueva sin nada que comparar (todas las métricas en 0/0).
    (s) => s.metrics.every((m) => m.current === 0 && m.previous === 0),
  )
}

/**
 * Epic 03 · Progress Insight Engine — los cambios importantes detectados
 * (recomposición, proteína+músculo, tendencia, evidencia fotográfica), TODO
 * determinístico. El peso entra SUAVIZADO (media móvil 7d) para que el ruido de
 * báscula no fabrique ni esconda una tendencia. `ProgressState`: empty = sin
 * insights dignos todavía (silencio honesto, no cascarones).
 */
export function useProgressInsights(): ProgressState<ProgressInsight[]> {
  const measurements = useMeasurements(null)
  const composition = useBodyComposition(null)
  const signals = useSignalsHistory(60)
  const targets = useMacroTargets().data
  const photos = usePhotoTimeline()
  const today = todayInTimezone()

  const insights = useMemo<ProgressInsight[] | undefined>(() => {
    if (!measurements.data || !signals.data) return undefined
    const weights: WeightSample[] = smoothWeightPoints(toWeightPoints(measurements.data)).map(
      (p) => ({ day: new Date(p.t).toISOString().slice(0, 10), kg: p.weight }),
    )
    const photoDays = [
      ...new Set(
        ['front', 'back', 'side_left', 'side_right'].flatMap((a) =>
          photoDatesFor(photos.data ?? [], a as never),
        ),
      ),
    ].sort()
    return generateProgressInsights({
      today,
      weights,
      composition: (composition.data ?? []).map((c) => ({
        day: c.day_date,
        fatPct: c.body_fat_pct,
        leanKg: c.lean_body_mass_kg,
      })),
      signals: signals.data,
      proteinTarget: targets?.protein_g ?? null,
      photoDays,
    })
  }, [measurements.data, composition.data, signals.data, targets?.protein_g, photos.data, today])

  return toProgressState(
    {
      isPending: measurements.isPending || signals.isPending,
      isError: measurements.isError,
      error: measurements.error,
      data: insights,
    },
    (list) => list.length === 0,
  )
}

/** Body (Epic 02): composición corporal de la ingesta wearable. Vacía mientras
 *  la ingesta esté apagada — las cards se auto-ocultan sin datos. */
export function useBodyComposition(rangeDays: number | null = null) {
  return useQuery({
    queryKey: queryKeys.progress.bodyComposition(rangeDays),
    queryFn: () => getBodyComposition(rangeDays),
    staleTime: 5 * 60_000,
  })
}

/** Body (Epic 02): todas las fotos (4 ángulos) con URLs firmadas — el
 *  comparador por fechas. */
export function usePhotoTimeline() {
  return useQuery({
    queryKey: queryKeys.progress.photoTimeline(),
    queryFn: getPhotoTimeline,
    staleTime: 5 * 60_000,
  })
}

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
 * página de Progreso. Una foto recién subida desde otra surface
 * (onboarding / settings) aparece vía el invalidate de useTakePhoto;
 * el foco de la app cubre el caso de volver desde background.
 */
export function useBeforeAfterPhotos() {
  return useQuery({
    queryKey: queryKeys.photos.beforeAfter(),
    queryFn: getBeforeAfterPhotos,
    // No refetchOnMount:'always' — tabs never unmount, so it only fired on
    // cold start. In-app uploads (useTakePhoto) invalidate photos.all with
    // refetchType:'all', which is what actually makes a fresh photo appear.
    // refetchOnWindowFocus covers the app-foreground case.
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
    queryKey: queryKeys.progress.recentWorkouts(rangeDays),
    queryFn: () => getRecentWorkoutDates(rangeDays),
    staleTime: 60_000,
  })
}

/** All-time distinct trained-day count — the "N días entrenados" stat. */
export function useTotalTrainedDays() {
  return useQuery({
    queryKey: queryKeys.progress.trainedTotal(),
    queryFn: getTotalTrainedDays,
    staleTime: 60_000,
  })
}

/** Every trained day, all-time — powers the browsable Progreso
 *  calendar (month navigation is a client-side slice). */
export function useAllWorkoutDates() {
  return useQuery({
    queryKey: queryKeys.progress.allWorkouts(),
    queryFn: getAllWorkoutDates,
    staleTime: 60_000,
  })
}

/** Workout dates in the current calendar month — feeds the month-based
 *  constellation. Keyed by month so it re-caches on the 1st. */
export function useMonthWorkoutDates() {
  const monthStart = `${todayInTimezone().slice(0, 7)}-01`
  return useQuery({
    queryKey: queryKeys.progress.monthWorkouts(monthStart),
    queryFn: () => getMonthWorkoutDates(monthStart),
    staleTime: 60_000,
  })
}

export function useRecentSleepLogs(rangeDays: number) {
  return useQuery({
    queryKey: queryKeys.progress.sleep(rangeDays),
    queryFn: () => getRecentSleepLogs(rangeDays),
    staleTime: 60_000,
  })
}

export function useLastPeriodStart() {
  return useQuery({
    queryKey: queryKeys.progress.lastPeriod(),
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
