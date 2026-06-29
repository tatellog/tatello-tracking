import { supabase } from '@/lib/supabase'
import { todayInTimezone } from '@/lib/time'
import type { Database } from '@/types/database.types'

export type DailySignals = Database['public']['Views']['daily_signals']['Row']

/** La vista daily_signals puede devolver MÁS DE UNA fila por día (fan-out de
 *  joins en la vista), así que NO se puede usar `.maybeSingle()` (falla con >1
 *  fila). Fusionamos las filas del día en una: coalesce del primer valor no
 *  nulo por campo; en booleanos (trained/rested/on_period) gana `true`. */
function mergeDaySignals(rows: readonly DailySignals[]): DailySignals {
  return rows.reduce((acc, r) => {
    const out = { ...acc }
    for (const key of Object.keys(r) as (keyof DailySignals)[]) {
      const v = r[key]
      if (v == null) continue
      if (out[key] == null) (out[key] as unknown) = v
      else if (typeof v === 'boolean' && v) (out[key] as unknown) = true
    }
    return out
  })
}

/** Señales de UN día (ISO 'YYYY-MM-DD'). Base de getTodaySignals y de ver un
 *  día pasado desde Semana. Robusto a filas duplicadas de la vista. */
export async function getDaySignals(day: string): Promise<DailySignals | null> {
  const { data, error } = await supabase.from('daily_signals').select('*').eq('day', day)
  if (error) throw error
  if (!data || data.length === 0) return null
  return data.length === 1 ? data[0]! : mergeDaySignals(data)
}

export async function getTodaySignals(): Promise<DailySignals | null> {
  return getDaySignals(todayInTimezone())
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
