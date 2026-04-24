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
