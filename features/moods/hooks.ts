import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { addMoodCheckin, getDailyNote, upsertDailyNote, type MoodValue } from './api'

/** Key de la nota del día (contenida; no toca el brief). */
const dailyNoteKey = (date: string): readonly ['daily-notes', string] => ['daily-notes', date]

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
    mutationFn: ({ value, date }: { value: MoodValue; date?: string }) =>
      addMoodCheckin(value, date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
      // Órbita lee el mood del día desde daily_signals → refrescar para que la
      // señal 'animo' deje de faltar tras registrarla.
      qc.invalidateQueries({ queryKey: queryKeys.orbit.all })
    },
  })
}

/** La nota libre del día ("Cómo amaneciste"). */
export function useDailyNote(date: string) {
  return useQuery({
    queryKey: dailyNoteKey(date),
    queryFn: () => getDailyNote(date),
  })
}

/** Guarda la nota del día (upsert; vacía = borra). Invalida solo su propia key. */
export function useUpsertDailyNote(date: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (note: string) => upsertDailyNote(note, date),
    onSuccess: () => qc.invalidateQueries({ queryKey: dailyNoteKey(date) }),
  })
}
