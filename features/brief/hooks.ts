import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { fetchBriefContext, type BriefContext } from './api'

/*
 * Query keys live in lib/queryKeys. This file just wires the
 * brief's fetch function into TanStack Query under the standard
 * key. Mutations that touch the brief invalidate queryKeys.brief.all
 * directly — there's no need to route through this file.
 */
export function useBriefContext(date?: string) {
  return useQuery<BriefContext>({
    queryKey: date ? queryKeys.brief.byDate(date) : queryKeys.brief.all,
    queryFn: () => fetchBriefContext(date),
  })
}
