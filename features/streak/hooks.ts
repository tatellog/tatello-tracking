import { useMutation, useQueryClient } from '@tanstack/react-query'

import { patchBriefCache, restoreBriefCache } from '@/lib/briefCache'
import { queryKeys } from '@/lib/queryKeys'
import { todayInTimezone } from '@/lib/time'

import {
  markWorkoutForDate,
  markWorkoutToday,
  unmarkWorkoutForDate,
  unmarkWorkoutToday,
} from './api'

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
      // Refresh the month-based constellation + the all-time trained-days
      // count, both keyed under ['progress'].
      qc.invalidateQueries({ queryKey: ['progress'] })
    },
  })
}

/*
 * Toggle a workout on an arbitrary day from the 28-day grid. Backs the
 * "I forgot to log Tuesday" flow: tap a past cell to fill it in, tap
 * again to clear it. For today the call delegates to the same insert/
 * delete pair used by useToggleWorkoutToday so the streak math stays
 * consistent across both entry points.
 *
 * Optimistic: flips grid_28_days[date].completed immediately. When the
 * date is today we also patch today_workout_completed/at and nudge
 * streak_days by ±1, matching useToggleWorkoutToday so the hero number
 * and TodayTile keep pace. For past days we don't touch streak_days —
 * the next refetch from get_brief_context recomputes it (a backfill
 * may either extend the run or bridge a gap, and there's no honest
 * client-side guess).
 */
export function useToggleWorkoutForDate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, complete }: { date: string; complete: boolean }) =>
      complete
        ? date === todayInTimezone()
          ? markWorkoutToday()
          : markWorkoutForDate(date)
        : date === todayInTimezone()
          ? unmarkWorkoutToday()
          : unmarkWorkoutForDate(date),
    onMutate: async ({ date, complete }) => {
      await qc.cancelQueries({ queryKey: queryKeys.brief.all })
      const isToday = date === todayInTimezone()
      return patchBriefCache(qc, (ctx) => ({
        ...ctx,
        grid_28_days: ctx.grid_28_days.map((cell) =>
          cell.date === date ? { ...cell, completed: complete } : cell,
        ),
        ...(isToday
          ? {
              today_workout_completed: complete,
              today_workout_at: complete ? new Date().toISOString() : null,
              streak_days: complete ? ctx.streak_days + 1 : Math.max(0, ctx.streak_days - 1),
            }
          : null),
      }))
    },
    onError: (_err, _vars, context) => restoreBriefCache(qc, context),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.brief.all })
      // Refresh the month-based constellation + the all-time trained-days
      // count, both keyed under ['progress'].
      qc.invalidateQueries({ queryKey: ['progress'] })
    },
  })
}
