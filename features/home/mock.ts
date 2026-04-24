import type { BriefContext, StreakCell } from '@/features/brief/api'

/*
 * Dev-only mock BriefContext used by useHomeBrief when the Supabase
 * query errors AND EXPO_PUBLIC_SKIP_AUTH is set. Lets us iterate on
 * the Home visually without an authenticated session.
 *
 * Grid shape: 14 most-recent days completed (excluding today), today
 * empty. That gives a visible 14-streak, a copper today cell that
 * hasn't been sealed yet, and faded older cells for depth.
 *
 * Never imported in production code paths — tree-shaken when
 * useHomeBrief's skipAuth branch isn't reachable.
 */

const MOCK_TODAY = '2026-04-24'
const MOCK_WEEKDAY = 'Viernes'

function isoLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildGrid(): StreakCell[] {
  const [y, m, d] = MOCK_TODAY.split('-').map(Number) as [number, number, number]
  const today = new Date(y, m - 1, d)
  return Array.from({ length: 28 }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (27 - i))
    return {
      date: isoLocalDate(date),
      // Index 13..26 completed → 14 consecutive pre-today.
      completed: i >= 13 && i < 27,
    }
  })
}

export const MOCK_BRIEF_CONTEXT: BriefContext = {
  date: MOCK_TODAY,
  day_of_week: MOCK_WEEKDAY,
  streak_days: 14,
  today_workout_completed: false,
  latest_measurement: {
    id: 'mock-latest',
    user_id: 'mock-user',
    measured_at: `${MOCK_TODAY}T09:00:00Z`,
    weight_kg: 76.2,
    waist_cm: 75,
    chest_cm: null,
    hip_cm: null,
    thigh_cm: null,
    arm_cm: null,
    created_at: `${MOCK_TODAY}T09:00:00Z`,
  },
  measurement_30d_ago: {
    id: 'mock-30d',
    user_id: 'mock-user',
    measured_at: '2026-03-25T09:00:00Z',
    weight_kg: 78,
    waist_cm: 77,
    chest_cm: null,
    hip_cm: null,
    thigh_cm: null,
    arm_cm: null,
    created_at: '2026-03-25T09:00:00Z',
  },
  grid_28_days: buildGrid(),
  latest_mood: null,
}
