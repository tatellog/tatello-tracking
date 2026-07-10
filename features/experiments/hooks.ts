/*
 * Experiments (R5) · hooks de lectura (React Query · T-A3).
 *
 * El read-path del spine para la futura UI (D): el experimento activo y las
 * hipótesis con su status real. Solo lectura; el ciclo de vida (start/close) lo
 * escribe la edge `experiment-lifecycle` (A2). Sin uid → deshabilitados.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import { todayInTimezone } from '@/lib/time'

import { fetchActiveExperiment, fetchHypotheses, fetchLatestExperiment } from './api'

type Period = 'day' | 'week' | 'month' | 'last30'

/** El experimento ACTIVO de la usuaria (o null). ≤1 por diseño. */
export function useActiveExperiment(uid: string | null) {
  return useQuery({
    queryKey: uid ? queryKeys.experiments.active(uid) : ['experiments', 'active', 'off'],
    queryFn: fetchActiveExperiment,
    enabled: uid != null,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/** El experimento MÁS RECIENTE (cualquier status): activo, o el recién cerrado
 *  con su resultado. Leerlo de la DB hace el resultado robusto a remounts. */
export function useLatestExperiment(uid: string | null) {
  return useQuery({
    queryKey: uid ? queryKeys.experiments.latest(uid) : ['experiments', 'latest', 'off'],
    queryFn: fetchLatestExperiment,
    enabled: uid != null,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  })
}

/** Las hipótesis de un periodo con su status real (para saber cuáles siguen
 *  'open' y pueden volverse experimento). */
export function useHypotheses(params: {
  uid: string | null
  period: Period
  periodStart: string
  periodEnd: string
}) {
  const { uid, period, periodStart, periodEnd } = params
  return useQuery({
    queryKey: uid
      ? queryKeys.hypotheses.forPeriod(uid, period, periodStart, periodEnd)
      : ['hypotheses', 'off'],
    queryFn: () => fetchHypotheses(period, periodStart, periodEnd),
    enabled: uid != null,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

/* ── Mutations del ciclo de vida (edge experiment-lifecycle · UI D) ────────── */

/** Invoca una acción del edge. Devuelve el body; lanza con el error cálido. */
async function callLifecycle(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('experiment-lifecycle', { body })
  if (error) throw error
  if (data && (data as { error?: string }).error) throw new Error((data as { error: string }).error)
  return data
}

/** Tras mutar, refresca el activo + las hipótesis (su status cambió). */
function useLifecycleInvalidation(uid: string | null) {
  const qc = useQueryClient()
  return () => {
    if (!uid) return
    // Prefijo 'experiments' → refresca active + latest de una.
    void qc.invalidateQueries({ queryKey: queryKeys.experiments.all })
    void qc.invalidateQueries({ queryKey: queryKeys.hypotheses.all })
  }
}

/** Arranca un experimento desde una hipótesis (su uuid de la tabla). */
export function useStartExperiment(uid: string | null) {
  const invalidate = useLifecycleInvalidation(uid)
  return useMutation({
    mutationFn: (hypothesisId: string) =>
      callLifecycle({ action: 'start', hypothesisId, today: todayInTimezone() }),
    onSuccess: invalidate,
  })
}

/** Cierra un experimento: el motor mide y escribe el resultado. */
export function useCloseExperiment(uid: string | null) {
  const invalidate = useLifecycleInvalidation(uid)
  return useMutation({
    mutationFn: (experimentId: string) =>
      callLifecycle({ action: 'close', experimentId, today: todayInTimezone() }),
    onSuccess: invalidate,
  })
}

/** Cancela un experimento en curso (reversible: sin resultado, hipótesis vuelve). */
export function useCancelExperiment(uid: string | null) {
  const invalidate = useLifecycleInvalidation(uid)
  return useMutation({
    mutationFn: (experimentId: string) => callLifecycle({ action: 'cancel', experimentId }),
    onSuccess: invalidate,
  })
}
