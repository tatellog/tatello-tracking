/*
 * "Tu smartwatch" · lógica pura de la pantalla que junta lo que trajo el reloj
 * y la báscula. Asigna cada entreno a su día LOCAL (la usuaria vive en su zona,
 * Salud guarda instantes) y arma la semana de pasos. Sin side effects.
 */
import type { HealthSummary, HealthWorkout } from './api'
import { addDaysIso, clockTime } from './sleep-detail'

const WORKOUT_LABEL: Record<string, string> = {
  fuerza: 'Fuerza',
  cardio: 'Cardio',
  caminata: 'Caminata',
}

const INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** El día local (YYYY-MM-DD) de un instante en la zona dada. */
export function localDayOf(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso))
}

export type WorkoutLine = {
  key: string
  label: string
  time: string
  minutes: number | null
  kcal: number | null
}

/** Las sesiones de un día, en orden, listas para pintar. */
export function workoutsOfDay(
  workouts: readonly HealthWorkout[],
  day: string,
  tz: string,
): WorkoutLine[] {
  return workouts
    .filter((w) => localDayOf(w.started_at, tz) === day)
    .map((w) => ({
      key: w.started_at,
      label: WORKOUT_LABEL[w.workout_type ?? ''] ?? 'Entreno',
      time: clockTime(w.started_at, tz),
      minutes: w.duration_min,
      kcal: w.energy_kcal,
    }))
}

/** "Fuerza · 7:10 am · 45 min · ~320 kcal" sin las partes que falten. */
export function workoutLineText(w: WorkoutLine): string {
  return [
    w.label,
    w.time,
    w.minutes != null && w.minutes > 0 ? `${w.minutes} min` : null,
    w.kcal != null && w.kcal > 0 ? `~${w.kcal} kcal` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function stepsOfDay(summary: HealthSummary, day: string): number | null {
  return summary.steps.find((s) => s.day_date === day)?.steps ?? null
}

export function waterOfDay(summary: HealthSummary, day: string): number | null {
  const ml = summary.water.find((w) => w.day_date === day)?.water_ml ?? null
  return ml != null && ml > 0 ? ml : null
}

export type StepsBar = { day: string; initial: string; steps: number | null; selected: boolean }

/** Los 7 días que terminan en `today` (el último es hoy). */
export function lastSevenSteps(summary: HealthSummary, today: string): StepsBar[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDaysIso(today, i - 6)
    const dow = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7
    return {
      day,
      initial: INITIALS[dow]!,
      steps: stepsOfDay(summary, day),
      selected: day === today,
    }
  })
}

/** Promedio de pasos de los días que SÍ tienen dato (null con menos de 3). */
export function averageSteps(bars: readonly StepsBar[]): number | null {
  const vals = bars.map((b) => b.steps).filter((n): n is number => n != null && n > 0)
  if (vals.length < 3) return null
  return Math.round(vals.reduce((a, n) => a + n, 0) / vals.length)
}

/** "6,240" (separador de miles como en México). */
export function formatCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
