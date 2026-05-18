import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { getTodaySignals } from './api'

/*
 * Today's órbita signals — the data behind the Día segment's orbital
 * diagram. Short staleTime: a meal/mood/sleep logged elsewhere should
 * surface here quickly. Returns null when nothing is logged today.
 */
export function useTodaySignals() {
  return useQuery({
    queryKey: queryKeys.orbita.today(),
    queryFn: getTodaySignals,
    staleTime: 60_000,
  })
}
