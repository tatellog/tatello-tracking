import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { getSleepLog, upsertSleepLog, type SleepDraft } from './api'

/*
 * Last night's sleep row for `date`. The Hoy-tab slide seeds its
 * editable draft from this once; afterwards the draft is the source
 * of truth and this only re-syncs on invalidation.
 */
export function useSleepLog(date: string) {
  return useQuery({
    queryKey: queryKeys.sleep.day(date),
    queryFn: () => getSleepLog(date),
  })
}

/*
 * Save the night's sleep. No optimistic cache write — the slide holds
 * the edited values in local state, so the UI is already current; we
 * only persist and then re-sync. Settling also refreshes the órbita
 * signals so the `sueño` dimension brightens on the Órbita tab.
 */
export function useUpsertSleep(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (draft: SleepDraft) => upsertSleepLog(date, draft),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sleep.day(date) })
      qc.invalidateQueries({ queryKey: queryKeys.orbit.today() })
    },
  })
}
