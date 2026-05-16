import { requireUserId, supabase } from '@/lib/supabase'

/*
 * Water intake is one row per user per day in `water_intake`, keyed
 * by (user_id, intake_date). A missing row simply means the day
 * hasn't been logged yet → 0 glasses.
 */

export async function getWaterGlasses(date: string): Promise<number> {
  const { data, error } = await supabase
    .from('water_intake')
    .select('glasses')
    .eq('intake_date', date)
    .maybeSingle()
  if (error) throw error
  return data?.glasses ?? 0
}

export async function setWaterGlasses(date: string, glasses: number): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase.from('water_intake').upsert(
    {
      user_id: userId,
      intake_date: date,
      glasses,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,intake_date' },
  )
  if (error) throw error
}
