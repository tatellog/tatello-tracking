import { requireUserId, supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type MoodCheckin = Database['public']['Tables']['mood_checkins']['Row']

export type MoodValue = 'good' | 'neutral' | 'struggle'

/*
 * Append a mood_checkin row. No upsert — the table is append-only on
 * purpose (Sprint 2 T4): each change of mood during the day is its
 * own data point for future pattern analysis. The Home only ever
 * displays the most-recent row per day.
 */
export async function addMoodCheckin(value: MoodValue): Promise<MoodCheckin> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('mood_checkins')
    .insert({ user_id: userId, value })
    .select()
    .single()
  if (error) throw error
  return data
}
