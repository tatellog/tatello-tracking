import { requireUserId, supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

/** One night in `sleep_logs`, keyed by (user_id, sleep_date). */
export type SleepLog = Database['public']['Tables']['sleep_logs']['Row']

/** What the Hoy-tab slide captures — duration + quality, no clock
 *  times. `quality` is null until the user rates the night. */
export type SleepDraft = {
  durationMinutes: number
  quality: number | null
}

/*
 * The night attributed to `date` — the local date the user woke up.
 * A missing row simply means last night hasn't been logged yet.
 */
export async function getSleepLog(date: string): Promise<SleepLog | null> {
  const { data, error } = await supabase
    .from('sleep_logs')
    .select('*')
    .eq('sleep_date', date)
    .maybeSingle()
  if (error) throw error
  return data
}

/*
 * Upsert the night's sleep. The Hoy slide is a duration+quality
 * control, but `sleep_logs` needs bedtime and wake_time — duration is
 * a generated column off their difference. So we synthesize a pair:
 * wake anchored at 07:30 local on the wake date, bedtime = wake −
 * duration. The instants are nominal; what the órbita engine reads
 * (sleep_date + duration_minutes) is exact. A user who later logs
 * real clock times from a dedicated screen just overwrites the row.
 */
export async function upsertSleepLog(date: string, draft: SleepDraft): Promise<void> {
  const userId = await requireUserId()
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const wake = new Date(y, m - 1, d, 7, 30, 0, 0)
  const bedtime = new Date(wake.getTime() - draft.durationMinutes * 60_000)
  const { error } = await supabase.from('sleep_logs').upsert(
    {
      user_id: userId,
      sleep_date: date,
      bedtime: bedtime.toISOString(),
      wake_time: wake.toISOString(),
      quality: draft.quality,
    },
    { onConflict: 'user_id,sleep_date' },
  )
  if (error) throw error
}
