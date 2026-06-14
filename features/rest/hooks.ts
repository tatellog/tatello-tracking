import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { getRestDay, markRestDay, unmarkRestDay } from './api'

export function useRestToday(date: string) {
  return useQuery({
    queryKey: queryKeys.rest.day(date),
    queryFn: () => getRestDay(date),
  })
}

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

/**
 * Versión por-fecha-dinámica de useSetRestToday — el día es un argumento de
 * la mutación, no del hook, así un solo hook sirve para cualquier día que el
 * usuario seleccione en el calendario (backfill de descanso). Optimista sobre
 * `rest.day(date)` e invalida la vista `daily_signals` (orbit history) para que
 * el status del calendario converja con el server.
 */
export function useSetRestForDate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, rested }: { date: string; rested: boolean }) =>
      rested ? markRestDay(date) : unmarkRestDay(date),
    onMutate: async ({ date, rested }) => {
      await qc.cancelQueries({ queryKey: queryKeys.rest.day(date) })
      const prev = qc.getQueryData<boolean>(queryKeys.rest.day(date))
      qc.setQueryData(queryKeys.rest.day(date), rested)
      return { prev, date }
    },
    onError: (_err, _vars, context) => {
      if (context?.date) qc.setQueryData(queryKeys.rest.day(context.date), context.prev ?? false)
    },
    onSettled: (_data, _err, { date }) => {
      qc.invalidateQueries({ queryKey: queryKeys.rest.day(date) })
      // daily_signals (la fuente de `rested` del calendario) se deriva en
      // Postgres; refetch para que el strip refleje el cambio real.
      qc.invalidateQueries({ queryKey: queryKeys.orbit.all })
    },
  })
}
