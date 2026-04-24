import type { BriefContext, StreakCell } from '@/features/brief/api'
import {
  deriveAnchorAction,
  deriveCheckinCopy,
  deriveCheckinState,
  deriveContextMessage,
  deriveDayState,
} from '@/features/home/logic'

/*
 * Build a BriefContext with sensible defaults so each test only
 * names the fields it actually cares about. The baseline is the
 * 'nothing logged, no measurements, weekday' case — tests override
 * the relevant slices.
 */
function buildCtx(overrides: Partial<BriefContext> = {}): BriefContext {
  const grid: StreakCell[] = Array.from({ length: 28 }, (_, i) => {
    // Generate dates leading up to today. Fake today = index 27.
    const day = new Date(2026, 3, 24) // 2026-04-24 local (a Friday)
    day.setDate(day.getDate() - (27 - i))
    const y = day.getFullYear()
    const m = String(day.getMonth() + 1).padStart(2, '0')
    const d = String(day.getDate()).padStart(2, '0')
    return { date: `${y}-${m}-${d}`, completed: false }
  })

  return {
    date: '2026-04-24',
    day_of_week: 'Viernes',
    streak_days: 0,
    today_workout_completed: false,
    today_workout_at: null,
    latest_measurement: null,
    measurement_30d_ago: null,
    grid_28_days: grid,
    latest_mood: null,
    targets: null,
    today_macros: { protein_g: 0, calories: 0 },
    meal_count_today: 0,
    ...overrides,
  }
}

describe('deriveDayState', () => {
  it('returns on-level whenever today is already logged', () => {
    const state = deriveDayState(buildCtx({ today_workout_completed: true }), 22)
    expect(state).toBe('on-level')
  })

  it('returns risk after 19:00 when no workout logged', () => {
    expect(deriveDayState(buildCtx(), 19)).toBe('risk')
    expect(deriveDayState(buildCtx(), 21)).toBe('risk')
  })

  it('returns caution on weekend afternoons (>= 14h)', () => {
    expect(deriveDayState(buildCtx({ day_of_week: 'Sábado' }), 14)).toBe('caution')
    expect(deriveDayState(buildCtx({ day_of_week: 'Domingo' }), 16)).toBe('caution')
  })

  it('stays on-level on a weekday morning with no workout', () => {
    expect(deriveDayState(buildCtx(), 9)).toBe('on-level')
    expect(deriveDayState(buildCtx(), 13)).toBe('on-level')
  })

  it('stays on-level on a weekend before 14h', () => {
    expect(deriveDayState(buildCtx({ day_of_week: 'Sábado' }), 10)).toBe('on-level')
  })
})

describe('deriveAnchorAction', () => {
  it('celebrates when today is done', () => {
    const msg = deriveAnchorAction(buildCtx({ today_workout_completed: true }), 'on-level', 12)
    expect(msg).toMatch(/entreno de hoy hecho/i)
  })

  it('nudges hard in the evening risk state', () => {
    const msg = deriveAnchorAction(buildCtx(), 'risk', 20)
    expect(msg).toMatch(/antes de dormir/i)
  })

  it('suggests "antes de las 6" on a weekend caution state', () => {
    const msg = deriveAnchorAction(buildCtx({ day_of_week: 'Sábado' }), 'caution', 15)
    expect(msg).toMatch(/antes de las 6/i)
  })

  it('gives the early-morning "marca cuando termines" variant', () => {
    const msg = deriveAnchorAction(buildCtx(), 'on-level', 8)
    expect(msg).toMatch(/marca tu entreno/i)
  })

  it('defaults to "antes de las 6" on a weekday mid-day', () => {
    const msg = deriveAnchorAction(buildCtx(), 'on-level', 13)
    expect(msg).toMatch(/antes de las 6/i)
  })
})

describe('deriveContextMessage', () => {
  it('fires the 3-saturday pattern when the last 3 saturdays are empty', () => {
    // Construct a grid whose saturdays (dayOfWeek === 6) are all
    // completed: false. The default builder already has every cell
    // false, so the assertion holds when day_of_week is Sábado.
    const msg = deriveContextMessage(
      buildCtx({ day_of_week: 'Sábado', streak_days: 0 }),
      'on-level',
    )
    expect(msg).toMatch(/últimos 3 fueron los huecos/i)
  })

  it('warns on risk state', () => {
    const msg = deriveContextMessage(buildCtx({ streak_days: 5 }), 'risk')
    expect(msg).toMatch(/ya es tarde/i)
  })

  it('validates the sealed day', () => {
    const msg = deriveContextMessage(
      buildCtx({ today_workout_completed: true, streak_days: 8 }),
      'on-level',
    )
    expect(msg).toMatch(/ya está sellado/i)
  })

  it('falls back to a streak-count nudge', () => {
    const msg = deriveContextMessage(buildCtx({ streak_days: 14 }), 'on-level')
    expect(msg).toMatch(/vas 14 días seguidos/i)
  })
})

/*
 * Helper: build a 28-day grid with precise control over which
 * weekday-matching entries are completed. Useful for the risky-
 * pattern branch of deriveCheckinState.
 */
function buildGridWithSelectiveCompletions(todayDow: number, completedSameDay: boolean[]) {
  const grid: StreakCell[] = []
  // Anchor today at 2026-04-24 (Friday, dow=5). Grid[27] = today.
  const today = new Date(2026, 3, 24)
  let completedIdx = 0
  for (let i = 0; i < 28; i++) {
    const day = new Date(today)
    day.setDate(today.getDate() - (27 - i))
    const dow = day.getDay()
    const y = day.getFullYear()
    const m = String(day.getMonth() + 1).padStart(2, '0')
    const d = String(day.getDate()).padStart(2, '0')
    let completed = false
    if (dow === todayDow && i < 27) {
      completed = completedSameDay[completedIdx] ?? false
      completedIdx++
    }
    grid.push({ date: `${y}-${m}-${d}`, completed })
  }
  return grid
}

describe('deriveCheckinState', () => {
  it('returns completed whenever today workout is completed', () => {
    expect(deriveCheckinState(true, 9, 5, [])).toBe('completed')
    expect(deriveCheckinState(true, 22, 6, [])).toBe('completed')
  })

  it('returns early on a weekday morning with no history risk', () => {
    const grid = buildGridWithSelectiveCompletions(5, [true, true, true])
    expect(deriveCheckinState(false, 9, 5, grid)).toBe('early')
    expect(deriveCheckinState(false, 13, 5, grid)).toBe('early')
  })

  it('returns urgent after 17:00 on any day', () => {
    const grid = buildGridWithSelectiveCompletions(3, [true, true, true])
    expect(deriveCheckinState(false, 17, 3, grid)).toBe('urgent')
    expect(deriveCheckinState(false, 20, 3, grid)).toBe('urgent')
  })

  it('returns urgent on weekend afternoons (>= 14:00)', () => {
    const gridSat = buildGridWithSelectiveCompletions(6, [true, true, true])
    expect(deriveCheckinState(false, 14, 6, gridSat)).toBe('urgent')
    const gridSun = buildGridWithSelectiveCompletions(0, [true, true, true])
    expect(deriveCheckinState(false, 15, 0, gridSun)).toBe('urgent')
  })

  it('stays early on weekend mornings before 14:00', () => {
    const grid = buildGridWithSelectiveCompletions(6, [true, true, true])
    expect(deriveCheckinState(false, 10, 6, grid)).toBe('early')
  })

  it('returns urgent when the risky weekday pattern fires (2 of last 3 empty)', () => {
    // Friday (dow=5) with last 3 fridays: true, false, false → 2 empties → risky.
    const grid = buildGridWithSelectiveCompletions(5, [true, false, false])
    expect(deriveCheckinState(false, 10, 5, grid)).toBe('urgent')
  })

  it('stays early when the last 3 same-weekday entries are mostly completed', () => {
    // Friday with last 3 fridays: true, true, false → only 1 empty → not risky.
    const grid = buildGridWithSelectiveCompletions(5, [true, true, false])
    expect(deriveCheckinState(false, 10, 5, grid)).toBe('early')
  })
})

describe('deriveCheckinCopy', () => {
  it('uses the weekday in the label for both active states', () => {
    expect(deriveCheckinCopy('early', 'Lunes').label).toBe('Hoy · Lunes')
    expect(deriveCheckinCopy('urgent', 'Sábado').label).toBe('Hoy · Sábado')
  })

  it('swaps prompt text by state', () => {
    expect(deriveCheckinCopy('early', 'Lunes').prompt).toMatch(/todavía no la has cerrado/i)
    expect(deriveCheckinCopy('urgent', 'Sábado').prompt).toMatch(/no pierdas la racha/i)
  })

  it('returns empty strings for the completed state', () => {
    const { label, prompt } = deriveCheckinCopy('completed', 'Lunes')
    expect(label).toBe('')
    expect(prompt).toBe('')
  })
})
