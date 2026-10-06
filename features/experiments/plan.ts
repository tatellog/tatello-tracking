/*
 * El plan de un día ("si es viernes, haré X") · helpers puros del cliente.
 * Lo medible vive en _shared (experiments.ts); aquí, fechas del recordatorio,
 * el estado del día y el texto que se lee en Hoy.
 */
import { weekdayOf } from './logic'
import type { ExperimentRow } from './api'

export const WEEKDAY_PLURAL = [
  'domingos',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábados',
] as const
export const WEEKDAY_SINGULAR = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const

/** Horas para el recordatorio (minutos desde medianoche). */
export const REMINDER_CHOICES = [
  { minutes: 9 * 60, label: '9:00' },
  { minutes: 13 * 60, label: '13:00' },
  { minutes: 17 * 60, label: '17:00' },
] as const

export type WeekdayPlan = {
  id: string
  hypothesisId: string
  weekday: number
  text: string
  reminderMinutes: number | null
  startedOn: string
  endsOn: string
}

/** El plan de día de un experimento activo, o null si no es de ese tipo. */
export function weekdayPlanOf(exp: ExperimentRow | null | undefined): WeekdayPlan | null {
  if (!exp || exp.status !== 'running') return null
  const p = exp.plan ?? {}
  const wd = p.weekday
  const text = p.planText
  if (typeof wd !== 'number' || typeof text !== 'string') return null
  return {
    id: exp.id,
    hypothesisId: exp.hypothesis_id,
    weekday: wd,
    text,
    reminderMinutes: typeof p.reminderMinutes === 'number' ? p.reminderMinutes : null,
    startedOn: exp.started_on,
    endsOn: exp.ends_on,
  }
}

/** Las fechas del plan (ese día de la semana) dentro de [startedOn, endsOn]. */
export function planDates(plan: Pick<WeekdayPlan, 'weekday' | 'startedOn' | 'endsOn'>): string[] {
  const out: string[] = []
  const d = new Date(`${plan.startedOn}T00:00:00Z`)
  while (d.toISOString().slice(0, 10) <= plan.endsOn) {
    const iso = d.toISOString().slice(0, 10)
    if (weekdayOf(iso) === plan.weekday) out.push(iso)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

/** Día anterior a un 'YYYY-MM-DD'. */
export function prevDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Qué toca mostrar en Hoy: 'today' si hoy es día del plan; 'checkin' si ayer
 * lo fue y aún no responde; null si nada. `answered` = fechas ya respondidas.
 */
export function planMoment(
  plan: WeekdayPlan,
  today: string,
  answered: ReadonlySet<string>,
): { kind: 'today'; date: string } | { kind: 'checkin'; date: string } | null {
  const dates = planDates(plan)
  if (dates.includes(today)) return { kind: 'today', date: today }
  const y = prevDay(today)
  if (dates.includes(y) && !answered.has(y)) return { kind: 'checkin', date: y }
  return null
}

/** "Viernes 2 de 4": el número de esta ocurrencia dentro del plan. */
export function occurrenceOf(plan: WeekdayPlan, date: string): { n: number; of: number } {
  const dates = planDates(plan)
  return { n: dates.indexOf(date) + 1, of: dates.length }
}

/**
 * La próxima fecha del recordatorio (hora local) estrictamente después de
 * `now`, dentro del plan; null si ya no quedan.
 */
export function nextReminderDate(plan: WeekdayPlan, now: Date): Date | null {
  if (plan.reminderMinutes == null) return null
  for (const iso of planDates(plan)) {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
    const at = new Date(
      y,
      m - 1,
      d,
      Math.floor(plan.reminderMinutes / 60),
      plan.reminderMinutes % 60,
    )
    if (at.getTime() > now.getTime()) return at
  }
  return null
}
