import { supabase } from '@/lib/supabase'
import { todayInTimezone } from '@/lib/time'
import type { Database } from '@/types/database.types'

export type DailySignals = Database['public']['Views']['daily_signals']['Row']

export async function getTodaySignals(): Promise<DailySignals | null> {
  const { data, error } = await supabase
    .from('daily_signals')
    .select('*')
    .eq('day', todayInTimezone())
    .maybeSingle()
  if (error) throw error
  return data
}
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

export async function hasAnySignals(): Promise<boolean> {
  const { count, error } = await supabase
    .from('daily_signals')
    .select('day', { count: 'exact', head: true })
    .limit(1)
  if (error) throw error
  return (count ?? 0) > 0
}
