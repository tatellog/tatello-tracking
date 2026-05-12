import { requireUserId, supabase } from '@/lib/supabase'
import { todayInTimezone } from '@/lib/time'

/*
 * Log today's workout. Idempotent: the table has a unique (user_id,
 * workout_date) index, so a second tap today no-ops instead of
 * erroring. We swallow Postgres' 23505 (unique violation) specifically
 * and rethrow anything else.
 */
export async function markWorkoutToday(): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase.from('workouts').insert({ user_id: userId })
  if (error && error.code !== '23505') throw error
}

/*
 * Undo today's workout (for the "oops, I mistapped" case). Targets by
 * generated workout_date so it can't accidentally delete yesterday even
 * if completed_at crossed midnight on the device clock.
 */
export async function unmarkWorkoutToday(): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('user_id', userId)
    .eq('workout_date', todayInTimezone())
  if (error) throw error
}

/*
 * Log a workout for a past date. workout_date is a generated column
 * derived from `(completed_at at time zone 'America/Mexico_City')::date`,
 * so we set completed_at to noon-Mexico_City for the target day —
 * 18:00 UTC, far enough from both ends that DST shifts (now defunct
 * for Mexico_City but still belt-and-braces) can't bump the date.
 */
export async function markWorkoutForDate(date: string): Promise<void> {
  const userId = await requireUserId()
  const completedAt = `${date}T18:00:00Z`
  const { error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, completed_at: completedAt })
  if (error && error.code !== '23505') throw error
}

export async function unmarkWorkoutForDate(date: string): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('user_id', userId)
    .eq('workout_date', date)
  if (error) throw error
}
