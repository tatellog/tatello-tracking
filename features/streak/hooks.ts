import { useMutation, useQueryClient } from '@tanstack/react-query'

import { patchBriefCache, restoreBriefCache } from '@/lib/briefCache'
import { queryKeys } from '@/lib/queryKeys'

import { markWorkoutToday, unmarkWorkoutToday } from './api'

/*
 * Toggle today's workout. The UI passes the desired next state
 * (`true` to mark, `false` to unmark).
 *
 * Optimistic: flips today_workout_completed immediately and nudges
 * streak_days by ±1 so the bar/card/rings respond the instant the
 * tap lands. The streak bump is an estimate — the server's
 * get_current_streak RPC may disagree in weird tz edge cases; the
 * refetch on settle reconciles either way. Rollback snapshots the
 * previous state so any error restores the pre-tap picture.
 *
 * Powers WorkoutCheckinBar's tap-to-seal and the long-press undo
 * on the completed surface — both flows share this single mutation.
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
        today_workout_at: complete ? new Date().toISOString() : null,
        streak_days: complete ? ctx.streak_days + 1 : Math.max(0, ctx.streak_days - 1),
      }))
    },
    onError: (_err, _vars, context) => restoreBriefCache(qc, context),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
    },
  })
}
