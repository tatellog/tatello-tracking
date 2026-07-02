import { requireUserId, supabase } from '@/lib/supabase'
import { todayInTimezone } from '@/lib/time'
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
 *
 * OJO: SOLO se ancla al mediodía para días PASADOS. Para HOY dejamos
 * `checked_at = now()` (default) → varios cambios de ánimo el mismo día tienen
 * timestamps CRECIENTES y `latest_mood` del brief (order by checked_at desc)
 * devuelve el más reciente. Anclar hoy al mediodía hacía que todos los cambios
 * empataran en timestamp y el brief se quedara con el ánimo VIEJO (Brillo no
 * seguía al slider). Sin `date` → ahora (comportamiento de siempre).
 */
export async function addMoodCheckin(value: MoodValue, date?: string): Promise<MoodCheckin> {
  const userId = await requireUserId()
  const row: {
    user_id: string
    value: MoodValue
    checked_at?: string
  } = { user_id: userId, value }
  if (date && date !== todayInTimezone()) {
    // Día PASADO. NO setear `checkin_date`: es una columna GENERATED (deriva de
    // `checked_at` en America/Mexico_City) y escribirla rompe el INSERT.
    // Anclamos `checked_at` al mediodía local de esa fecha → el día generado
    // cae en `date`.
    const [y, m, d] = date.split('-').map(Number) as [number, number, number]
    row.checked_at = new Date(y, m - 1, d, 12, 0, 0, 0).toISOString()
  }
  const { data, error } = await supabase.from('mood_checkins').insert(row).select().single()
  if (error) throw error
  return data
}

/* ─── Nota del día (daily_notes) ──────────────────────────────────────
 * La nota libre del check-in de "Cómo amaneciste". Una por día (PK
 * user_id + note_date → upsert). RLS filtra por dueña, así que basta con
 * `note_date`. `date` es el día LOCAL (YYYY-MM-DD). */

/** La nota de ESE día, o null si no hay. */
export async function getDailyNote(date: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('daily_notes')
    .select('note')
    .eq('note_date', date)
    .maybeSingle()
  if (error) throw error
  return data?.note ?? null
}

/** Guarda (upsert) la nota del día. Nota vacía = borrar (el CHECK exige ≥1
 *  char; no guardamos cadenas vacías). */
export async function upsertDailyNote(note: string, date: string): Promise<void> {
  const userId = await requireUserId()
  const trimmed = note.trim().slice(0, 2000)
  if (trimmed.length === 0) {
    const { error } = await supabase.from('daily_notes').delete().eq('note_date', date)
    if (error) throw error
    return
  }
  const { error } = await supabase
    .from('daily_notes')
    .upsert(
      { user_id: userId, note_date: date, note: trimmed, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,note_date' },
    )
  if (error) throw error
}
