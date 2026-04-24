import { requireUserId, supabase } from '@/lib/supabase'

/*
 * All workout dates are expressed in the user's local timezone on the
 * server (workouts.workout_date is `(completed_at at time zone TZ)::date`
 * generated). We mirror the same timezone here so delete targets match.
 * Hardcoded for Sprint 1; when the app goes multi-region this becomes
 * a profile setting and is threaded through both sides.
 */
const USER_TIMEZONE = 'America/Mexico_City'

/* YYYY-MM-DD in the given timezone — `en-CA` locale formats that way natively. */
function todayInTimezone(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}

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
    .eq('workout_date', todayInTimezone(USER_TIMEZONE))
  if (error) throw error
}
