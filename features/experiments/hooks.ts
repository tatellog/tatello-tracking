/*
 * Experiments (R5) · hooks de lectura (React Query · T-A3).
 *
 * El read-path del spine para la futura UI (D): el experimento activo y las
 * hipótesis con su status real. Solo lectura; el ciclo de vida (start/close) lo
 * escribe la edge `experiment-lifecycle` (A2). Sin uid → deshabilitados.
 */
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { fetchActiveExperiment, fetchHypotheses } from './api'

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
