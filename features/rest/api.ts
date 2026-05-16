import { requireUserId, supabase } from '@/lib/supabase'

/*
 * Rest days are one row per user per day in `rest_days`, keyed by
 * (user_id, rest_date). A row's existence is the whole signal: the
 * user chose "Hoy descansé" that day. A missing row → no rest logged.
 */

export async function getRestDay(date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('rest_days')
    .select('rest_date')
    .eq('rest_date', date)
    .maybeSingle()
  if (error) throw error
  return data != null
}

/*
 * Log a rest day. Idempotent: the (user_id, rest_date) primary key
 * makes a second tap no-op — we swallow Postgres' 23505 (unique
 * violation) and rethrow anything else.
 */
export async function markRestDay(date: string): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase.from('rest_days').insert({ user_id: userId, rest_date: date })
  if (error && error.code !== '23505') throw error
}

/* Undo a rest day — RLS scopes the delete to the current user. */
export async function unmarkRestDay(date: string): Promise<void> {
  const { error } = await supabase.from('rest_days').delete().eq('rest_date', date)
  if (error) throw error
}
