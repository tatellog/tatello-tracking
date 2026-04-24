import { useMutation, useQueryClient } from '@tanstack/react-query'

import { patchBriefCache, restoreBriefCache } from '@/lib/briefCache'
import { queryKeys } from '@/lib/queryKeys'

import { markWorkoutToday, unmarkWorkoutToday } from './api'

/*
 * Toggle today's workout. The UI passes the desired next state
 * (`true` to mark, `false` to unmark).
 *
 * Optimistic: flips today_workout_completed immediately and nudges
 * streak_days by ±1 so the button/card/rings respond the instant
 * the tap lands. The streak bump is an estimate — the server's
 * get_current_streak RPC may disagree in weird tz edge cases; the
 * refetch on settle reconciles either way. Rollback snapshots the
 * previous state so any error restores the pre-tap picture.
 *
 * Enables the 'tap + undo toast' pattern in SealDayButton: users
 * see the commit land before the network round-trip; if they
 * undo within 5 s we flip back just as fast.
 */
export function useToggleWorkoutToday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (complete: boolean) => (complete ? markWorkoutToday() : unmarkWorkoutToday()),
    onMutate: async (complete) => {
      await qc.cancelQueries({ queryKey: queryKeys.brief.all })
      return patchBriefCache(qc, (ctx) => ({
        ...ctx,
        today_workout_completed: complete,
        streak_days: complete ? ctx.streak_days + 1 : Math.max(0, ctx.streak_days - 1),
      }))
    },
    onError: (_err, _vars, context) => restoreBriefCache(qc, context),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
    },
  })
}
