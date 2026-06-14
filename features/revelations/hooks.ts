import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { listRevelations } from './api'

/*
 * Historia — el timeline de todas las revelaciones mostradas. La UI de
 * Historia está faseada (spec, Decisión #4), pero el hook ya existe para
 * que las tres tiers escriban y leer el log sea trivial cuando se construya.
 */
export function useRevelationHistory(limit = 50) {
  return useQuery({
    queryKey: queryKeys.revelations.history(),
    queryFn: () => listRevelations(limit),
    staleTime: 5 * 60 * 1000,
  })
}
