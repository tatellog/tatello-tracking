/*
 * computeIntelligence — the single orchestrator that runs ALL the
 * deterministic órbita rules over a user's raw signals and returns the
 * payload the app renders (Día / Semana / Mes). Pure: shared by the Edge
 * Function (server) AND the app's local fallback. One source of truth.
 */
import { buildArquetipoSemana } from './arquetipo'
import { buildDayReadings } from './day-readings'
import { deriveDimensions } from './dimensions'
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
}

type Voz = {
  parts: readonly VozParte[]
  signature: { confidence: 'alta' | 'media' | 'baja'; scope: string }
}
type Arquetipo = ReturnType<typeof buildArquetipoSemana>

export type Intelligence = {
  day: { dimensions: Dimension[]; readings: DayCard[] }
  week: { days: DiaSemana[]; arquetipo: Arquetipo; voz: Voz; shape: Patron[]; ahead: string | null }
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
  const { history, meals, today, todayGetDay, calorieTarget, proteinTarget, waterGoalGlasses } =
    input
  const dimCtx = { calorieTarget, proteinTarget }

  const todaySignal = history.find((s) => s.day === today) ?? null

  // Sunday-first week ending today.
  const weekStart = shiftDate(today, -todayGetDay)
  const weekSignals = history.filter((s) => s.day != null && s.day >= weekStart && s.day <= today)
  const days = buildWeekDaysReal(weekSignals, todayGetDay, dimCtx)

  // Recurrence patterns — shared by Semana "lo que viene" + Mes cards.
  const night = detectNightPattern(meals)
  const habits = detectHabitPatterns(history)
  const weekday = detectWeekPatterns(history, dimCtx)
  const recurrences = [...(night ? [night] : []), ...habits, ...weekday]

  const m30 = history.slice(-30)
  const summary = buildMonthSummary(m30, dimCtx)
  const daysLogged = monthDaysLogged(m30)

  return {
    day: {
      dimensions: deriveDimensions(todaySignal, dimCtx),
      readings: buildDayReadings(todaySignal, { calorieTarget, proteinTarget, waterGoalGlasses }),
    },
    week: {
      days,
      arquetipo: buildArquetipoSemana(days, todayGetDay),
      voz: buildVozSemanaReal(days, todayGetDay),
      shape: detectMonthPatterns(history, dimCtx),
      ahead: buildWeekAhead(recurrences, todayGetDay),
    },
    month: {
      summary,
      theme: monthTheme(summary, daysLogged),
      voz: buildVozMes(summary, daysLogged),
      satellites: buildMonthSatellites(summary, daysLogged),
      patterns: recurrences,
      daysLogged,
    },
  }
}
