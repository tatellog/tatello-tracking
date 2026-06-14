/*
 * useCalendarDays — fusiona las tres fuentes ya existentes en el arreglo de
 * días que pintan el strip y el panel de Hoy. NO toca backend: lee de
 * workouts (entrenó), daily_signals (descansó + qué registró) y revelations
 * (eventos). La fusión vive en `buildCalendarDays` (puro, testeado).
 */

import { useMemo } from 'react'

import { useSignalsHistory } from '@/features/orbit/hooks'
import { useRecentWorkoutDates } from '@/features/progress/hooks'
import { useRevelationHistory } from '@/features/revelations/hooks'
import { USER_TIMEZONE } from '@/lib/time'

import {
  buildCalendarDays,
  type CalendarDay,
  type CalendarEvent,
  type DayStatus,
  type DaySignal,
} from './logic'

// Ventana de workouts ≥ span del strip (cubre cruces de mes). Igual fuente
// que alimenta la constelación → la estrella y la figura nunca discrepan.
const WORKOUTS_WINDOW = 45

/** Timestamp ISO → 'YYYY-MM-DD' en la zona del usuario (en-CA = ISO). */
function localDayOf(iso: string, tz: string = USER_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export type UseCalendarDaysOpts = {
  span?: number
  /** Hoy en zona local 'YYYY-MM-DD' (de ctx.date). */
  today: string
  /** Hoy entrenado (de ctx.today_workout_completed) — optimismo del toggle. */
  todayWorkoutCompleted: boolean
  /** Override local optimista por fecha mientras una acción está en vuelo. */
  overrides?: Record<string, DayStatus>
}

export function useCalendarDays(opts: UseCalendarDaysOpts): {
  days: CalendarDay[]
  isLoading: boolean
} {
  const { span = 30, today, todayWorkoutCompleted, overrides } = opts

  const workouts = useRecentWorkoutDates(WORKOUTS_WINDOW)
  const signals = useSignalsHistory(span)
  const revelations = useRevelationHistory(50)

  const signalsByDay = useMemo(() => {
    const map: Record<string, DaySignal> = {}
    for (const s of signals.data ?? []) {
      if (s.day) map[s.day] = s
    }
    return map
  }, [signals.data])

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const r of revelations.data ?? []) {
      const day = localDayOf(r.shown_at)
      ;(map[day] ??= []).push({ id: r.id, title: r.title })
    }
    return map
  }, [revelations.data])

  const days = useMemo(
    () =>
      buildCalendarDays({
        today,
        span,
        trainedDates: workouts.data ?? [],
        signalsByDay,
        eventsByDay,
        todayWorkoutCompleted,
        overrides,
      }),
    [today, span, workouts.data, signalsByDay, eventsByDay, todayWorkoutCompleted, overrides],
  )

  return {
    days,
    isLoading: workouts.isLoading || signals.isLoading || revelations.isLoading,
  }
}
