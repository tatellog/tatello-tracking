import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

import { queryKeys } from '@/lib/queryKeys'
import { todayInTimezone } from '@/lib/time'
import { useSession } from '@/hooks/useSession'

import { getMealsInRange } from '@/features/macros/api'

import {
  countSignalDays,
  getDaySignals,
  getTodaySignals,
  getWeekSignals,
  hasAnySignals,
} from './api'
import { isoTwoWeekRange } from './week-orbit-logic'

/** Id del usuario en sesión para scopear las keys de órbita (un usuario nuevo no
 *  hereda la caché de otro en el mismo dispositivo). 'anon' sin sesión. */
function useOrbitUid(): string {
  return useSession().session?.user?.id ?? 'anon'
}

/*
 * Vigila el cambio de día mientras Órbita está montada. El tab persiste entre
 * sesiones (no se desmonta), así que si cruza la medianoche sin re-render, las
 * queries de Órbita (today/week/month) siguen keyeadas con la fecha de AYER y
 * muestran datos viejos como "hoy" — justo el bug que vio la usuaria. Cada minuto
 * comparamos el día local; al cambiar, forzamos un re-render: las keys derivan de
 * todayInTimezone(), así que recalculan a HOY → fetch limpio del día nuevo. (Hoy
 * ya hace esto vía useDayRollover; Órbita no lo tenía.) */
export function useOrbitDayRollover(): void {
  const dayRef = useRef(todayInTimezone())
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      const today = todayInTimezone()
      if (today !== dayRef.current) {
        dayRef.current = today
        force((n) => n + 1)
      }
    }, 60 * 1000)
    return () => clearInterval(id)
  }, [])
}

/*
 * Today's órbita signals — the data behind the Día segment's orbital
 * diagram. Short staleTime: a meal/mood/sleep logged elsewhere should
 * surface here quickly. Returns null when nothing is logged today.
 */
export function useTodaySignals() {
  // Key scopeada por usuario + fecha local: un usuario nuevo no hereda la caché
  // de otro, y al cambiar de día no se sirven las señales de ayer como "hoy".
  const uid = useOrbitUid()
  return useQuery({
    queryKey: queryKeys.orbit.today(uid, todayInTimezone()),
    queryFn: getTodaySignals,
    staleTime: 60_000,
  })
}

/*
 * Las señales de UN día (para ver un día pasado en Órbita Día desde la tira de
 * Semana). `day` ISO 'YYYY-MM-DD'. Cache por día; un día pasado es estable, así
 * que staleTime alto. El día de hoy igual lo sirve useTodaySignals con su
 * propia key (no colisionan).
 */
export function useDaySignals(day: string, enabled = true) {
  const uid = useOrbitUid()
  return useQuery({
    queryKey: queryKeys.orbit.day(uid, day),
    queryFn: () => getDaySignals(day),
    staleTime: 5 * 60_000,
    enabled,
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
  const uid = useOrbitUid()
  const { from, to } = currentWeekRange()
  return useQuery({
    queryKey: queryKeys.orbit.week(uid, from, to),
    queryFn: () => getWeekSignals(from, to),
    staleTime: 60_000,
  })
}

/*
 * TWO-week window (last Monday → today) for the redesigned Semana (Órbita)
 * view. Two weeks so the view can compare the current week with the previous
 * one (Señal Naciente); every pure consumer filters to its own week, so
 * passing both weeks is safe. Monday-first to match the "L·M·M·J·V·S·D" line.
 * Returns the signals plus `todayIso` (same day source) so the pure logic
 * stays deterministic. Distinct cache key from the Sunday-based week above.
 */
export function useIsoWeekSignals() {
  const uid = useOrbitUid()
  const todayIso = todayInTimezone()
  const { from, to } = isoTwoWeekRange(todayIso)
  const query = useQuery({
    queryKey: queryKeys.orbit.week(uid, from, to),
    queryFn: () => getWeekSignals(from, to),
    staleTime: 60_000,
  })
  return { ...query, todayIso }
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
  const uid = useOrbitUid()
  const { from, to } = historyRange(days)
  return useQuery({
    queryKey: queryKeys.orbit.history(uid, from, to),
    queryFn: () => getWeekSignals(from, to),
    // 60s (was 10 min): the pattern list should reflect a freshly logged
    // day — or a reseed in dev — within a minute, not stay frozen for
    // ten. The query is cheap (one ranged read), so "calm over eager"
    // isn't worth a stale patterns surface.
    staleTime: 60_000,
  })
}

/*
 * Recent meals (≈5 weeks) — feeds the late-night pattern detector, which
 * needs meal TIMES (daily_signals only carries per-day totals). Same
 * window as the signals history; 60s staleTime so it tracks new meals.
 */
export function useHistoryMeals(days = 35) {
  const uid = useOrbitUid()
  const { from, to } = historyRange(days)
  return useQuery({
    queryKey: ['orbit', 'history-meals', uid, from, to] as const,
    queryFn: () => getMealsInRange(from, to),
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
  const uid = useOrbitUid()
  return useQuery({
    queryKey: queryKeys.orbit.hasAny(uid),
    queryFn: hasAnySignals,
    staleTime: 1000 * 60 * 5,
  })
}

/*
 * Días con señal de por vida — "X días en órbita" en Hoy. Acumulado que
 * solo crece (no racha): sin días consecutivos, sin reset, sin pérdida.
 * El +1 de HOY lo aporta el caller en vivo (el conteo del server puede
 * tardar en incluir el día en curso).
 */
export function useTotalSignalDays() {
  const uid = useOrbitUid()
  return useQuery({
    queryKey: queryKeys.orbit.totalDays(uid),
    queryFn: countSignalDays,
    staleTime: 60_000,
  })
}
