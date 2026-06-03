import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { todayInTimezone } from '@/lib/time'

import { getTodaySignals, getWeekSignals, hasAnySignals } from './api'

/*
 * Today's órbita signals — the data behind the Día segment's orbital
 * diagram. Short staleTime: a meal/mood/sleep logged elsewhere should
 * surface here quickly. Returns null when nothing is logged today.
 */
export function useTodaySignals() {
  return useQuery({
    queryKey: queryKeys.orbit.today(),
    queryFn: getTodaySignals,
    staleTime: 60_000,
  })
}

/*
 * The Sunday→today window for the current week, as inclusive
 * 'YYYY-MM-DD' local days. We start from todayInTimezone() (same
 * source of truth as getTodaySignals) and walk back getUTCDay() days
 * to land on Sunday. Parsing the local-day string as a UTC instant
 * keeps getUTCDay() and the subtraction off the device timezone, so
 * the weekday math matches the user's local day exactly.
 */
function currentWeekRange(): { from: string; to: string } {
  const today = todayInTimezone()
  const todayUtc = new Date(`${today}T00:00:00Z`)
  const sundayUtc = new Date(todayUtc)
  sundayUtc.setUTCDate(todayUtc.getUTCDate() - todayUtc.getUTCDay())
  return { from: sundayUtc.toISOString().slice(0, 10), to: today }
}

/*
 * The current week's órbita signals — one row per logged day from this
 * week's Sunday through today, oldest first. Backs the Semana segment.
 * Same short staleTime as useTodaySignals so a signal logged in
 * another tab shows up in the weekly reading quickly. Returns [] when
 * nothing was logged this week.
 */
export function useWeekSignals() {
  const { from, to } = currentWeekRange()
  return useQuery({
    queryKey: queryKeys.orbit.week(from, to),
    queryFn: () => getWeekSignals(from, to),
    staleTime: 60_000,
  })
}

/*
 * A rolling window of recent days (default 35 ≈ 5 weeks), oldest first —
 * the history the deterministic pattern detectors cross-reference to find
 * recurring weekday dips/peaks and trained↔sleep correlations. Reuses the
 * same range query as the week; longer staleTime since patterns move
 * slowly (a new day barely shifts a 5-week aggregate).
 */
function historyRange(days: number): { from: string; to: string } {
  const today = todayInTimezone()
  const fromUtc = new Date(`${today}T00:00:00Z`)
  fromUtc.setUTCDate(fromUtc.getUTCDate() - (days - 1))
  return { from: fromUtc.toISOString().slice(0, 10), to: today }
}

export function useSignalsHistory(days = 35) {
  const { from, to } = historyRange(days)
  return useQuery({
    queryKey: queryKeys.orbit.history(from, to),
    queryFn: () => getWeekSignals(from, to),
    // 60s (was 10 min): the pattern list should reflect a freshly logged
    // day — or a reseed in dev — within a minute, not stay frozen for
    // ten. The query is cheap (one ranged read), so "calm over eager"
    // isn't worth a stale patterns surface.
    staleTime: 60_000,
  })
}

/*
 * Has the user ever logged anything? Drives the empty-state path in
 * Día / Semana / Mes — false → render placeholder, true → render the
 * full segment. Longer staleTime than the today query: this only
 * flips from false→true once per user, ever, so we don't need to
 * re-check on every focus.
 */
export function useHasAnySignals() {
  return useQuery({
    queryKey: queryKeys.orbit.hasAny(),
    queryFn: hasAnySignals,
    staleTime: 1000 * 60 * 5,
  })
}
