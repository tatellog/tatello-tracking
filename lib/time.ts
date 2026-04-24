/*
 * Single source of truth for the user's local timezone on the
 * client. Mirrors public.user_timezone() in the database — when we
 * eventually read the tz from profiles.timezone, both this module
 * and the SQL function move together.
 *
 * todayInTimezone formats YYYY-MM-DD in the given tz, which is
 * exactly the shape meals.meal_date, workouts.workout_date, and
 * mood_checkins.checkin_date use on the server. Keeps client delete
 * paths pointing at the right server-computed day.
 */
export const USER_TIMEZONE = 'America/Mexico_City'

export function todayInTimezone(tz: string = USER_TIMEZONE): string {
  // en-CA locale happens to format as 'YYYY-MM-DD' natively, avoiding
  // a manual zero-pad + concat.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}
