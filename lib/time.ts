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

/*
 * El "hoy" del cliente debe usar la MISMA zona que el server: `profiles.timezone`,
 * que es como la vista `daily_signals` (y las columnas *_date) bucketean los días.
 * Si el cliente usa otra zona, pide/borra el día equivocado — el bug de la usuaria.
 *
 * `profiles.timezone` se cachea acá a nivel de módulo; `queryClient` lo sincroniza
 * cuando el perfil carga (incluso al hidratar de AsyncStorage) vía setUserTimezone,
 * y lo limpia al cambiar de usuario. Cascada de fallback mientras no se conoce:
 *   profiles.timezone → zona del device → México (último recurso).
 *
 * Esto resuelve también el caso "viajera" (device ≠ zona del onboarding): el
 * cliente sigue a la MISMA zona que la vista, así que nunca se desalinean.
 */
let cachedUserTimezone: string | null = null

/** Sincroniza la zona del perfil hacia el cálculo de "hoy" del cliente. */
export function setUserTimezone(tz: string | null | undefined): void {
  cachedUserTimezone = tz && tz.length > 0 ? tz : null
}

/** La zona efectiva para bucketear el día del usuario (perfil → device → MX). */
export function userTimezone(): string {
  return cachedUserTimezone ?? deviceTimezone()
}

export function todayInTimezone(tz: string = userTimezone()): string {
  // en-CA locale happens to format as 'YYYY-MM-DD' natively, avoiding
  // a manual zero-pad + concat.
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
}

/*
 * The device's current IANA timezone (e.g. 'America/Mexico_City',
 * 'Europe/Madrid'). Captured into profiles.timezone at the end of
 * onboarding so every per-user server query (the órbitas engine,
 * future daily_signals view) buckets the local day correctly instead
 * of assuming everyone lives in Mexico City. Falls back to the
 * USER_TIMEZONE literal on the rare runtime that returns no zone.
 */
export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || USER_TIMEZONE
}
