import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { getTodayWellbeing, saveWellbeing, type WellbeingDraft } from './api'

/*
 * Today's wellbeing check-in for `date`. The Hoy-tab slide seeds its
 * editable draft from this once; afterwards the draft is the source
 * of truth and this only re-syncs on invalidation.
 */
export function useTodayWellbeing(date: string) {
  return useQuery({
    queryKey: queryKeys.wellbeing.day(date),
    queryFn: () => getTodayWellbeing(date),
  })
}

/*
 * Save the day's check-in. The slide debounces taps and tracks the
 * row id locally, so this is a plain mutation — no optimistic write.
 * Settling refreshes the órbita signals (the energía + mente
 * dimensions read from this check-in).
 */
export function useSaveWellbeing(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, draft }: { id: string | null; draft: WellbeingDraft }) =>
      saveWellbeing(date, id, draft),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wellbeing.day(date) })
      qc.invalidateQueries({ queryKey: queryKeys.orbita.today() })
    },
  })
}
