import { requireUserId, supabase } from '@/lib/supabase'

export async function getRestDay(date: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('rest_days')
    .select('rest_date')
    .eq('rest_date', date)
    .maybeSingle()
  if (error) throw error
  return data != null
}

export async function markRestDay(date: string): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase.from('rest_days').insert({ user_id: userId, rest_date: date })
  if (error && error.code !== '23505') throw error
}

export async function unmarkRestDay(date: string): Promise<void> {
  const { error } = await supabase.from('rest_days').delete().eq('rest_date', date)
  if (error) throw error
}
