/*
 * computeIntelligence — the single orchestrator that runs ALL the
 * deterministic órbita rules over a user's raw signals and returns the
 * payload the app renders (Día / Semana / Mes). Pure: shared by the Edge
 * Function (server) AND the app's local fallback. One source of truth.
 */
import { buildArquetipoSemana } from './arquetipo'
import { buildDayReadings } from './day-readings'
import { buildDayIdentity, deriveDimensions } from './dimensions'
import { detectHabitPatterns } from './habit-patterns'
import {
  buildMonthSatellites,
  buildMonthSummary,
  buildVozMes,
  monthDaysLogged,
  monthTheme,
} from './month'
import { detectMonthPatterns } from './month-patterns'
import { detectNightPattern } from './night-pattern'
import type {
  DailySignals,
  DayCard,
  DayIdentity,
  DiaSemana,
  Dimension,
  DimensionMonth,
  Meal,
  MonthSatellite,
  Patron,
  VozParte,
} from './types'
import { buildVozSemanaReal, buildWeekAhead, buildWeekDaysReal } from './week'
import { detectWeekPatterns } from './week-patterns'

export type IntelligenceInput = {
  history: readonly DailySignals[]
  meals: readonly Meal[]
  /** Local 'YYYY-MM-DD' day. */
  today: string
  /** JS getDay (0=Sun … 6=Sat) of `today`, Sunday-first week. */
  todayGetDay: number
  calorieTarget: number | null
  proteinTarget: number | null
  waterGoalGlasses: number
  /** Regla de negocio (cycle-gate.ts): false → el usuario no tiene ciclo
   *  (hombre, o mujer sin menstruación activa); la dimensión `ciclo` y el
   *  chip de periodo se omiten de TODO el payload. undefined → se incluye
   *  (back-compat). */
  cycleEnabled?: boolean
}

type Voz = {
  parts: readonly VozParte[]
  signature: { confidence: 'alta' | 'media' | 'baja'; scope: string }
}
type Arquetipo = ReturnType<typeof buildArquetipoSemana>

export type Intelligence = {
  day: { dimensions: Dimension[]; header: DayIdentity; readings: DayCard[] }
  week: { days: DiaSemana[]; arquetipo: Arquetipo; voz: Voz; ahead: string | null }
  month: {
    summary: DimensionMonth[]
    theme: string
    voz: Voz
    satellites: MonthSatellite[]
    patterns: Patron[]
    daysLogged: number
  }
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function computeIntelligence(input: IntelligenceInput): Intelligence {
  const {
    history,
    meals,
    today,
    todayGetDay,
    calorieTarget,
    proteinTarget,
    waterGoalGlasses,
    cycleEnabled,
  } = input
  const dimCtx = { calorieTarget, proteinTarget, cycleEnabled }

  const todaySignal = history.find((s) => s.day === today) ?? null
  const dimensions = deriveDimensions(todaySignal, dimCtx)

  // Sunday-first week ending today.
  const weekStart = shiftDate(today, -todayGetDay)
  const weekSignals = history.filter((s) => s.day != null && s.day >= weekStart && s.day <= today)
  const days = buildWeekDaysReal(weekSignals, todayGetDay, dimCtx)

  // Recurrence patterns — day-specific ("los lunes…", "las noches…"); feed
  // both the Mes cards and the Semana "lo que viene" nudge.
  const night = detectNightPattern(meals)
  const habits = detectHabitPatterns(history)
  const weekday = detectWeekPatterns(history, dimCtx)
  const recurrences = [...(night ? [night] : []), ...habits, ...weekday]

  // Month-shape habits ("Tu semana de movimiento", "…tiene una forma") — read
  // over the whole month, so they live in Mes (lead the patterns), NOT Semana.
  const monthShape = detectMonthPatterns(history, dimCtx)

  const m30 = history.slice(-30)
  const summary = buildMonthSummary(m30, dimCtx)
  const daysLogged = monthDaysLogged(m30)

  return {
    day: {
      dimensions,
      header: buildDayIdentity(dimensions),
      readings: buildDayReadings(todaySignal, {
        calorieTarget,
        proteinTarget,
        waterGoalGlasses,
        cycleEnabled,
      }),
    },
    week: {
      days,
      arquetipo: buildArquetipoSemana(days, todayGetDay),
      voz: buildVozSemanaReal(days, todayGetDay),
      ahead: buildWeekAhead(recurrences, todayGetDay),
    },
    month: {
      summary,
      theme: monthTheme(summary, daysLogged),
      voz: buildVozMes(summary, daysLogged),
      satellites: buildMonthSatellites(summary, daysLogged),
      patterns: [...monthShape, ...recurrences],
      daysLogged,
    },
  }
}
