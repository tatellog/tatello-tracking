/*
 * useCalendarDays — fusiona las tres fuentes ya existentes en el arreglo de
 * días que pintan el strip y el panel de Hoy. NO toca backend: lee de
 * workouts (entrenó), daily_signals (descansó + qué registró) y revelations
 * (eventos). La fusión vive en `buildCalendarDays` (puro, testeado).
 */

import { useMemo } from 'react'

import { useSignalsHistory } from '@/features/orbit/hooks'
import { useRecentWorkoutDates } from '@/features/progress/hooks'
import { useProfile } from '@/features/profile/hooks'
import {
  patternRevelationCopy,
  RETURN_COPY,
  TRANSFORMATION_THRESHOLDS,
  transformationCopy,
  type TransformationThreshold,
} from '@/features/revelations/logic'
import { useRevelationHistory } from '@/features/revelations/hooks'
import { ZODIAC, zodiacFromDate } from '@/features/tabs/zodiac'
import type { RevelationRow } from '@/features/revelations/api'
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

/**
 * Título + mensaje (voz del coach) de una revelación para el calendario.
 *
 * Transformación: el título guardado quedó CONGELADO con el signo de entonces
 * (p.ej. "LEO empezó a despertar." de cuando el perfil era Leo). El signo es
 * IDENTIDAD, no progreso histórico, así que lo regeneramos en vivo desde el
 * perfil actual (sin recalcular el hito: la etapa/`kind` no cambia). Los otros
 * tiers no llevan signo, así que conservan su título; su mensaje se reconstruye
 * para el detalle ("ver evidencia"): el patrón con su conteo, el regreso con su
 * bienvenida.
 */
function eventCopy(r: RevelationRow, signLabel: string): { title: string; message: string } {
  if (r.tier === 'transformation') {
    const t = Number(r.kind) as TransformationThreshold
    if ((TRANSFORMATION_THRESHOLDS as readonly number[]).includes(t)) {
      return transformationCopy(t, signLabel)
    }
    return { title: r.title, message: r.title }
  }
  if (r.tier === 'return') return { title: r.title, message: RETURN_COPY.message }
  const count = Number(r.metadata?.count ?? 0)
  const windowDays = Number(r.metadata?.window_days ?? r.metadata?.windowDays ?? 7)
  // Sin conteo válido (revelaciones viejas/seed sin metadata) NO fabricamos
  // "0 de los últimos N días" — solo el título (el detalle lo suprime al
  // coincidir con el título). Con conteo, el mensaje trae la evidencia real.
  const message = count > 0 ? patternRevelationCopy(r.kind, count, windowDays).message : r.title
  return { title: r.title, message }
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
  // El signo se renderiza EN VIVO desde el perfil (los títulos de transformación
  // guardados quedaron con el signo viejo). Ver eventCopy.
  const { data: profile } = useProfile()
  const signLabel = ZODIAC[zodiacFromDate(profile?.date_of_birth)].label

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
      const { title, message } = eventCopy(r, signLabel)
      ;(map[day] ??= []).push({ id: r.id, title, tier: r.tier, kind: r.kind, message })
    }
    return map
  }, [revelations.data, signLabel])

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
