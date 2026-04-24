import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { addMoodCheckin, type MoodValue } from './api'

/*
 * Save a mood check-in. Invalidates the brief so `latest_mood`
 * re-reads and the picker reflects the newly-selected state.
 *
 * There's no standalone moods query — the UI reads mood through
 * BriefContext.latest_mood, which keeps every mood-related screen
 * consistent without an extra round-trip.
 */
export function useAddMoodCheckin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (value: MoodValue) => addMoodCheckin(value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
    },
  })
}
