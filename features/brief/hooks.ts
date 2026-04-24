import { useQuery } from '@tanstack/react-query'

import { fetchBriefContext, type BriefContext } from './api'

/*
 * Query key convention for the brief:
 *   ['brief']           → today
 *   ['brief', '2026-04-23'] → specific day (for history views later)
 *
 * Streak and measurement mutations that affect the brief's content
 * invalidate ['brief'] — a single prefix invalidation catches every
 * cached day in one shot.
 */
export const briefKeys = {
  all: ['brief'] as const,
  byDate: (date: string) => ['brief', date] as const,
}

export function useBriefContext(date?: string) {
  return useQuery<BriefContext>({
    queryKey: date ? briefKeys.byDate(date) : briefKeys.all,
    queryFn: () => fetchBriefContext(date),
  })
}
