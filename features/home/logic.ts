import type { BriefContext, StreakCell } from '@/features/brief/api'

export type DayState = 'on-level' | 'caution' | 'risk'

/*
 * Client-side heuristics that feed the anchor action and the
 * context message above the deltas. These are deliberately simple
 * — Sprint 3 replaces them with Anthropic LLM structured output,
 * where the same ctx feeds a prompt and the model returns richer,
 * more specific copy.
 *
 * Every function here is pure: `hour` is injected by the caller
 * instead of being read from `new Date()` inside, so tests become
 * deterministic regardless of the machine timezone. Day-of-week
 * comes from ctx.day_of_week (server-computed in
 * America/Mexico_City) so local drift can't flip Saturday to
 * Friday either.
 */

const WEEKEND_DAYS = new Set(['Sábado', 'Domingo'])

/*
 * Parse 'YYYY-MM-DD' to the local-zoned JS day-of-week (0–6) without
 * the `new Date('YYYY-MM-DD')` UTC-midnight gotcha that drifts by one
 * day for users west of UTC.
 */
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

/* ─── today tile ──────────────────────────────────────────────────── */

export type TodayTileState = 'morning' | 'day' | 'urgent' | 'completed' | 'first-day'

/*
 * Decide which variant the in-grid TodayTile should render. Pure:
 * all inputs explicit, no new Date() reads inside.
 *
 *   first-day → user has never marked a workout (profile.first_workout_at
 *               is null). Trumps everything else. The tile renders with
 *               the germinate entrance and a 'Empieza tu racha' prompt.
 *   completed → workout already marked for today. Caller hides the
 *               tile and renders the full 28-cell grid instead.
 *   urgent    → hour ≥ 17, weekend (Sun/Sat) ≥ 14h, OR the risky
 *               pattern: of the last three same-weekday entries, at
 *               least two were not completed. Faster halo, bolder
 *               copy.
 *   morning   → hour < 11, no urgency triggers. Soft 'tu día está
 *               abierto' prompt.
 *   day       → 11 ≤ hour < 17, no urgency triggers. Direct 'marcar
 *               entreno' nudge.
 */
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
    // Drop today (last match) and take the previous three.
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
      // Not consumed when completed — the grid renders 28 normal
      // cells in this state. Return an empty shape so callers don't
      // have to special-case the return type.
      return { topLabel: '', bottomText: '' }
  }
}
