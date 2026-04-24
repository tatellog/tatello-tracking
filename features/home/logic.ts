import type { BriefContext, StreakCell } from '@/features/brief/api'

export type DayState = 'on-level' | 'caution' | 'risk'

/*
 * Client-side heuristics that feed the anchor action and the
 * context message above the deltas. These are deliberately simple
 * — Sprint 3 replaces them with Anthropic LLM structured output,
 * where the same ctx feeds a prompt and the model returns richer,
 * more specific copy.
 *
 * Every function here is pure and takes BriefContext as the single
 * source of truth. The only ambient reads are `new Date().getHours()`
 * for the local wall-clock; day-of-week comes from ctx.day_of_week
 * (server-computed in America/Mexico_City) so timezone drift on the
 * device clock can't flip Saturday to Friday.
 */

const WEEKEND_DAYS = new Set(['Sábado', 'Domingo'])

const SATURDAY_INDEX = 6

/*
 * Parse 'YYYY-MM-DD' to the local-zoned JS day-of-week (0–6) without
 * the `new Date('YYYY-MM-DD')` UTC-midnight gotcha that drifts by one
 * day for users west of UTC.
 */
function dayOfWeekOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).getDay()
}

export function deriveDayState(ctx: BriefContext): DayState {
  if (ctx.today_workout_completed) return 'on-level'
  const hour = new Date().getHours()
  if (hour >= 19) return 'risk'
  if (WEEKEND_DAYS.has(ctx.day_of_week) && hour >= 14) return 'caution'
  return 'on-level'
}

export function deriveAnchorAction(ctx: BriefContext, state: DayState): string {
  if (ctx.today_workout_completed) return '✓ Entreno de hoy hecho.'
  const hour = new Date().getHours()
  if (state === 'risk') return 'Entrena antes de dormir.'
  if (state === 'caution' && WEEKEND_DAYS.has(ctx.day_of_week)) {
    return 'Entrena antes de las 6.'
  }
  if (hour < 10) return 'Marca tu entreno cuando termines.'
  return 'Entrena antes de las 6.'
}

export function deriveContextMessage(ctx: BriefContext, state: DayState): string {
  if (ctx.day_of_week === 'Sábado') {
    // The 3 Saturdays before today in the 28-day grid.
    const saturdaysBefore: StreakCell[] = ctx.grid_28_days
      .slice(0, -1) // today is always the last cell
      .filter((c) => dayOfWeekOf(c.date) === SATURDAY_INDEX)
    const last3 = saturdaysBefore.slice(-3)
    if (last3.length === 3 && last3.every((c) => !c.completed)) {
      return 'Hoy es sábado. Tus últimos 3 fueron los huecos.'
    }
  }
  if (state === 'risk') return 'Ya es tarde. No dejes que hoy sea un hueco.'
  if (ctx.today_workout_completed) return 'Hoy ya está sellado. Mantén el ritmo.'
  return `Vas ${ctx.streak_days} días seguidos. Uno más.`
}
