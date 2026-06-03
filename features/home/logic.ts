import type { BriefContext, StreakCell } from '@/features/brief/api'

export type DayState = 'on-level' | 'caution' | 'risk'

const WEEKEND_DAYS = new Set(['Sábado', 'Domingo'])

function dayOfWeekOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).getDay()
}

export function deriveDayState(ctx: BriefContext, hour: number): DayState {
  if (ctx.today_workout_completed) return 'on-level'
  if (hour >= 19) return 'risk'
  if (WEEKEND_DAYS.has(ctx.day_of_week) && hour >= 14) return 'caution'
  return 'on-level'
}

export function deriveAnchorAction(ctx: BriefContext, state: DayState, hour: number): string {
  if (ctx.today_workout_completed) return '✓ Entreno de hoy hecho.'
  if (state === 'risk') return 'Entrena antes de dormir.'
  if (state === 'caution' && WEEKEND_DAYS.has(ctx.day_of_week)) {
    return 'Entrena antes de las 6.'
  }
  if (hour < 10) return 'Marca tu entreno cuando termines.'
  return 'Entrena antes de las 6.'
}

export type TodayTileState = 'morning' | 'day' | 'urgent' | 'completed' | 'first-day'

export function deriveTodayTileState(
  workoutCompleted: boolean,
  hour: number,
  dayOfWeek: number,
  gridDays: StreakCell[],
  isFirstDay: boolean = false,
): TodayTileState {
  if (isFirstDay) return 'first-day'
  if (workoutCompleted) return 'completed'

  const sameDayOfWeekHistory = gridDays
    .filter((d) => dayOfWeekOf(d.date) === dayOfWeek)
    .slice(-4, -1)

  const hasRiskyPattern =
    sameDayOfWeekHistory.length >= 3 && sameDayOfWeekHistory.filter((d) => !d.completed).length >= 2

  const isLate = hour >= 17
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
  const isRiskyWeekend = isWeekend && hour >= 14

  if (isLate || isRiskyWeekend || hasRiskyPattern) return 'urgent'
  if (hour < 11) return 'morning'
  return 'day'
}

export function deriveTodayTileCopy(
  state: TodayTileState,
  dayOfWeek: string,
): { topLabel: string; bottomText: string } {
  const topLabel = `Hoy · ${dayOfWeek}`
  switch (state) {
    case 'morning':
      return { topLabel, bottomText: 'Tu día está abierto' }
    case 'day':
      return { topLabel, bottomText: 'Marcar entreno' }
    case 'urgent':
      return { topLabel, bottomText: 'No pierdas la racha' }
    case 'first-day':
      return { topLabel: `Día 1 · ${dayOfWeek}`, bottomText: 'Empieza tu racha' }
    case 'completed':
      return { topLabel: '', bottomText: '' }
  }
}
