import { useMutation, useQueryClient } from '@tanstack/react-query'

import { briefKeys } from '@/features/brief/hooks'

import { markWorkoutToday, unmarkWorkoutToday } from './api'

/*
 * Single toggle mutation — the UI passes the desired next state
 * (`true` to mark, `false` to unmark). Keeps the component side
 * small: `onPress={() => toggle.mutate(!completed)}`.
 *
 * On success we invalidate the brief tree so the streak count and
 * today_workout_completed flag re-fetch. No dedicated streak query
 * exists — the streak lives inside BriefContext — so briefKeys.all
 * is the right (and only) invalidation target.
 */
export function useToggleWorkoutToday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (complete: boolean) => (complete ? markWorkoutToday() : unmarkWorkoutToday()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: briefKeys.all })
    },
  })
}
