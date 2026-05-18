import { requireUserId, supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

/** One check-in moment in `wellbeing_checkins`. */
export type WellbeingCheckin = Database['public']['Tables']['wellbeing_checkins']['Row']

/** The three 1–5 axes the Hoy slide captures. null = not yet rated. */
export type WellbeingDraft = {
  energy: number | null
  motivation: number | null
  stress: number | null
}

export function isEmptyDraft(d: WellbeingDraft): boolean {
  return d.energy == null && d.motivation == null && d.stress == null
}

/*
 * The day's most recent check-in for `date`, or null. The table is
 * append-friendly — multiple check-ins per day are allowed and the
 * daily_signals view averages them — but the Hoy slide reads and
 * edits the latest row, so a morning check-in stays correctable in
 * place rather than spawning a row per tap.
 */
export async function getTodayWellbeing(date: string): Promise<WellbeingCheckin | null> {
  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .select('*')
    .eq('checkin_date', date)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/*
 * Persist the check-in. With an id we edit that row in place; without
 * one we insert. An all-empty draft clears the check-in — deleting the
 * row (the table's >=1-axis constraint forbids an empty one) or doing
 * nothing if there was none. Returns the surviving row, or null.
 */
export async function saveWellbeing(
  date: string,
  id: string | null,
  draft: WellbeingDraft,
): Promise<WellbeingCheckin | null> {
  const empty = isEmptyDraft(draft)

  if (id && empty) {
    const { error } = await supabase.from('wellbeing_checkins').delete().eq('id', id)
    if (error) throw error
    return null
  }
  if (empty) return null

  if (id) {
    const { data, error } = await supabase
      .from('wellbeing_checkins')
      .update({ energy: draft.energy, motivation: draft.motivation, stress: draft.stress })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  }

  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('wellbeing_checkins')
    .insert({
      user_id: userId,
      checkin_date: date,
      energy: draft.energy,
      motivation: draft.motivation,
      stress: draft.stress,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
