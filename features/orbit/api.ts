import { supabase } from '@/lib/supabase'
import { todayInTimezone } from '@/lib/time'
import type { Database } from '@/types/database.types'

/** One row of the daily_signals view — every órbita signal for a user
 *  on a local day, already unified. See 20260518120005_daily_signals. */
export type DailySignals = Database['public']['Views']['daily_signals']['Row']

/*
 * Today's row of daily_signals for the caller. The view is
 * security_invoker, so RLS scopes it to the authenticated user — no
 * user_id filter needed. Returns null when nothing has been logged
 * today (the orbital diagram then renders every dimension "lejos").
 */
export async function getTodaySignals(): Promise<DailySignals | null> {
  const { data, error } = await supabase
    .from('daily_signals')
    .select('*')
    .eq('day', todayInTimezone())
    .maybeSingle()
  if (error) throw error
  return data
}

/*
 * A contiguous range of daily_signals rows for the caller, oldest
 * first. Same security_invoker view as getTodaySignals, so RLS scopes
 * it to the authenticated user — no user_id filter needed. fromDate
 * and toDate are inclusive 'YYYY-MM-DD' local days (the shape the view
 * buckets on). Backs the Semana segment, which reads one orbital
 * signal per day across the current week. Days with nothing logged
 * simply don't come back as rows.
 */
export async function getWeekSignals(fromDate: string, toDate: string): Promise<DailySignals[]> {
  const { data, error } = await supabase
    .from('daily_signals')
    .select('*')
    .gte('day', fromDate)
    .lte('day', toDate)
    .order('day', { ascending: true })
  if (error) throw error
  return data ?? []
}

/*
 * Has the user ever logged anything that lands in daily_signals? The
 * 3 órbita segments (Día / Semana / Mes) flip to an empty placeholder
 * when this returns false — Stelar shouldn't render archetypes,
 * patterns or readings from MOCK data for a brand-new account who
 * hasn't given it anything to read. `count: 'exact', head: true`
 * fetches only the row count (no body), so this stays cheap even on
 * a thousand-day history.
 */
export async function hasAnySignals(): Promise<boolean> {
  const { count, error } = await supabase
    .from('daily_signals')
    .select('day', { count: 'exact', head: true })
    .limit(1)
  if (error) throw error
  return (count ?? 0) > 0
}
