import { requireUserId, supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type MoodCheckin = Database['public']['Tables']['mood_checkins']['Row']

export type MoodValue = 'good' | 'neutral' | 'struggle'

/*
 * Append a mood_checkin row. No upsert — the table is append-only on
 * purpose (Sprint 2 T4): each change of mood during the day is its
 * own data point for future pattern analysis. The Home only ever
 * displays the most-recent row per day.
 *
 * `date` (YYYY-MM-DD) lets Órbita registrar el ánimo de un DÍA PASADO: como el
 * view daily_signals deriva el día de `checked_at at time zone`, se ancla
 * `checked_at` al mediodía local de esa fecha (mismo criterio que sleep api).
 * Sin `date` → ahora (comportamiento de siempre).
 */
export async function addMoodCheckin(value: MoodValue, date?: string): Promise<MoodCheckin> {
  const userId = await requireUserId()
  const row: {
    user_id: string
    value: MoodValue
    checked_at?: string
  } = { user_id: userId, value }
  if (date) {
    // NO setear `checkin_date`: es una columna GENERATED (deriva de `checked_at`
    // en America/Mexico_City) y escribirla rompe el INSERT. Anclamos `checked_at`
    // al mediodía local de esa fecha → el día generado cae en `date`.
    const [y, m, d] = date.split('-').map(Number) as [number, number, number]
    row.checked_at = new Date(y, m - 1, d, 12, 0, 0, 0).toISOString()
  }
  const { data, error } = await supabase.from('mood_checkins').insert(row).select().single()
  if (error) throw error
  return data
}
