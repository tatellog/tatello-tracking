import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type BodyMeasurement = Database['public']['Tables']['body_measurements']['Row']
type MoodCheckin = Database['public']['Tables']['mood_checkins']['Row']

/*
 * One cell in the 28-day heatmap. `date` is YYYY-MM-DD in
 * America/Mexico_City; `completed` is whether a workout row exists
 * for that day.
 */
export type StreakCell = {
  date: string
  completed: boolean
}

/*
 * Shape returned by the `get_brief_context` RPC. The Postgres side builds
 * this with jsonb_build_object, so supabase-js typing is Json (opaque);
 * we cast into this shape at the boundary instead of sprinkling casts
 * through the UI. Keys are snake_case on purpose — they match the DB so
 * adapting once, later, is cheaper than adapting on every access.
 *
 * grid_28_days is oldest first (index 0 = 27 days ago) and today last
 * (index 27 = today). That order matches the row-major fill of the
 * 7×4 visual grid read left-to-right, top-to-bottom.
 */
export type BriefContext = {
  date: string
  day_of_week: string // Spanish weekday: 'Domingo' … 'Sábado'
  streak_days: number
  today_workout_completed: boolean
  latest_measurement: BodyMeasurement | null
  measurement_30d_ago: BodyMeasurement | null
  grid_28_days: StreakCell[]
  latest_mood: MoodCheckin | null
}

/*
 * Fetch the authenticated user's brief context.
 *
 * p_date is optional — omit for "today in user tz" (server default).
 * p_user_id is omitted on purpose: the RPC defaults it to auth.uid()
 * and rejects any caller-supplied value that doesn't match, so passing
 * it client-side buys nothing and risks silent mismatches.
 */
export async function fetchBriefContext(date?: string): Promise<BriefContext> {
  const { data, error } = await supabase.rpc('get_brief_context', {
    p_date: date,
  })
  if (error) throw error
  return data as unknown as BriefContext
}
