import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { getRestDay, markRestDay, unmarkRestDay } from './api'

/** Whether a rest day is logged for `date` — drives the Hoy CTA swap. */
export function useRestToday(date: string) {
  return useQuery({
    queryKey: queryKeys.rest.day(date),
    queryFn: () => getRestDay(date),
  })
}

/*
 * Set the day's rest flag — optimistic. The CTA flips to the rest
 * message (or back) the instant the tap lands; the insert/delete
 * settles in the background and rolls back on error.
 */
export function useSetRestToday(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rested: boolean) => (rested ? markRestDay(date) : unmarkRestDay(date)),
    onMutate: async (rested) => {
      await qc.cancelQueries({ queryKey: queryKeys.rest.day(date) })
      const prev = qc.getQueryData<boolean>(queryKeys.rest.day(date))
      qc.setQueryData(queryKeys.rest.day(date), rested)
      return { prev }
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(queryKeys.rest.day(date), context?.prev ?? false)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.rest.day(date) })
    },
  })
}
