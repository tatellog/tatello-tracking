import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { getTodaySignals, hasAnySignals } from './api'

/*
 * Today's órbita signals — the data behind the Día segment's orbital
 * diagram. Short staleTime: a meal/mood/sleep logged elsewhere should
 * surface here quickly. Returns null when nothing is logged today.
 */
export function useTodaySignals() {
  return useQuery({
    queryKey: queryKeys.orbit.today(),
    queryFn: getTodaySignals,
    staleTime: 60_000,
  })
}

/*
 * Has the user ever logged anything? Drives the empty-state path in
 * Día / Semana / Mes — false → render placeholder, true → render the
 * full segment. Longer staleTime than the today query: this only
 * flips from false→true once per user, ever, so we don't need to
 * re-check on every focus.
 */
export function useHasAnySignals() {
  return useQuery({
    queryKey: queryKeys.orbit.hasAny(),
    queryFn: hasAnySignals,
    staleTime: 1000 * 60 * 5,
  })
}
