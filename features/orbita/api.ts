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
