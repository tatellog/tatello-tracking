import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { getWaterGlasses, setWaterGlasses } from './api'

export function useWaterToday(date: string) {
  return useQuery({
    queryKey: queryKeys.water.day(date),
    queryFn: () => getWaterGlasses(date),
  })
}

/*
 * Set the day's glass count — optimistic. The droplet UI flips
 * instantly off the cached value; the upsert settles in the
 * background. On error the cached count rolls back.
 */
export function useSetWater(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (glasses: number) => setWaterGlasses(date, glasses),
    onMutate: async (glasses) => {
      await qc.cancelQueries({ queryKey: queryKeys.water.day(date) })
      const prev = qc.getQueryData<number>(queryKeys.water.day(date))
      qc.setQueryData(queryKeys.water.day(date), glasses)
      return { prev }
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(queryKeys.water.day(date), context?.prev ?? 0)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.water.day(date) })
    },
  })
}
