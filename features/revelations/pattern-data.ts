/*
 * Pattern data loader — Sistema de Revelaciones (Tier 3 · patrones).
 *
 * SINGLE JOB: read from Supabase and SHAPE the inputs the pure
 * detectors in `@/features/patterns/consistency` expect. It does NOT
 * run the detectors — another file feeds these shapes into them. Keep
 * this boundary: this is the I/O seam, the detection is pure logic.
 *
 * Window: the last 7 LOCAL days ending today (inclusive), derived from
 * `nowMs` so the same instant always yields the same window. We push
 * the date filter to Postgres (gte on the stored date/timestamp) and
 * only group in JS what the detectors need.
 *
 * RLS already scopes every table to auth.uid() = user_id; we still
 * filter explicitly by user_id, matching the rest of the repo's api.
 */

import { type ProteinDay, type SleepNight, WINDOW_DAYS } from '@/features/patterns/consistency'
import { requireUserId, supabase } from '@/lib/supabase'

const DAY_MS = 24 * 60 * 60 * 1000

/** Local YYYY-MM-DD for an instant — matches the detectors' day keying. */
function localDateKey(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type PatternData = {
  /** One entry per local day in the window: protein eaten vs target. */
  proteinDays: ProteinDay[]
  /** Distinct YYYY-MM-DD workout dates in the window. */
  workoutDates: string[]
  /** One entry per logged night in the window: minutes slept. */
  sleepNights: SleepNight[]
  /** Raw meal instants in the window — the night-eating detector
   *  buckets these by LOCAL hour, so it needs the timestamp, not a
   *  pre-aggregated day. */
  meals: { consumed_at: string }[]
}

/**
 * Load and shape the 7-day window the consistency detectors read.
 *
 * The window lower bound is today's local date minus (WINDOW_DAYS - 1)
 * days. For date-typed columns (meal_date, workout_date, sleep_date)
 * we filter on the local date string directly. For `consumed_at`
 * (a timestamptz the night detector needs raw) we also gate on the
 * date string via meal_date so the heavy timestamp scan stays bounded.
 */
export async function fetchPatternData(nowMs: number): Promise<PatternData> {
  const userId = await requireUserId()
  const todayKey = localDateKey(nowMs)
  const startKey = localDateKey(nowMs - (WINDOW_DAYS - 1) * DAY_MS)

  const [mealsRes, targetRes, workoutsRes, sleepRes] = await Promise.all([
    // Meals in the window — meal_date is the local day (used to group
    // protein), consumed_at is the raw instant (used by night-eating).
    supabase
      .from('meals')
      .select('consumed_at, meal_date, protein_g')
      .eq('user_id', userId)
      .gte('meal_date', startKey)
      .lte('meal_date', todayKey),
    // Current protein target. If the user never set one, the detector
    // ignores days with target 0 — so a missing row is fine.
    supabase.from('macro_targets').select('protein_g').eq('user_id', userId).maybeSingle(),
    // Distinct trained days — `workouts` has a UNIQUE (user_id,
    // workout_date), so each row already is a distinct day.
    supabase
      .from('workouts')
      .select('workout_date')
      .eq('user_id', userId)
      .gte('workout_date', startKey)
      .lte('workout_date', todayKey),
    // Nights logged in the window.
    supabase
      .from('sleep_logs')
      .select('sleep_date, duration_minutes')
      .eq('user_id', userId)
      .gte('sleep_date', startKey)
      .lte('sleep_date', todayKey),
  ])

  if (mealsRes.error) throw mealsRes.error
  if (targetRes.error) throw targetRes.error
  if (workoutsRes.error) throw workoutsRes.error
  if (sleepRes.error) throw sleepRes.error

  const targetG = targetRes.data?.protein_g ?? 0
  const mealRows = mealsRes.data ?? []

  // Group protein by local day. meal_date may be null on legacy rows;
  // skip those for the per-day aggregate (they still travel raw for the
  // night detector, which keys off consumed_at).
  const proteinByDay = new Map<string, number>()
  for (const row of mealRows) {
    if (!row.meal_date) continue
    proteinByDay.set(row.meal_date, (proteinByDay.get(row.meal_date) ?? 0) + Number(row.protein_g))
  }
  const proteinDays: ProteinDay[] = [...proteinByDay.entries()].map(([date, proteinG]) => ({
    date,
    proteinG,
    targetG,
  }))

  // Distinct workout dates (UNIQUE constraint makes the rows already
  // distinct, but de-dup defensively).
  const workoutDates = [...new Set((workoutsRes.data ?? []).map((r) => r.workout_date as string))]

  const sleepNights: SleepNight[] = (sleepRes.data ?? [])
    .filter((r) => r.duration_minutes != null)
    .map((r) => ({ date: r.sleep_date as string, minutes: r.duration_minutes as number }))

  const meals = mealRows.map((r) => ({ consumed_at: r.consumed_at }))

  return { proteinDays, workoutDates, sleepNights, meals }
}
