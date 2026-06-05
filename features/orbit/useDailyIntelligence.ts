import { useQuery } from '@tanstack/react-query'

import { getMealsInRange } from '@/features/macros/api'
import { GLASS_ML, useWaterGoal } from '@/features/water/useWaterGoal'
import { supabase } from '@/lib/supabase'
import { todayInTimezone } from '@/lib/time'

import {
  computeIntelligence,
  type Intelligence,
} from '../../supabase/functions/_shared/intelligence/index'
import { getWeekSignals } from './api'

/*
 * The órbita engine, on the BACKEND. Calls the `daily-intelligence` Edge
 * Function (the deterministic rules run server-side, RLS-scoped to the
 * caller) and returns the full payload — Día / Semana / Mes.
 *
 * FALLBACK: if the function isn't reachable (not deployed yet, offline),
 * we compute the SAME payload locally from the SAME shared lib, so the app
 * never breaks. Once the function is live, it transparently takes over.
 */
type Params = { today: string; todayGetDay: number; waterGoalGlasses: number }

/*
 * Whether to call the `daily-intelligence` Edge Function. While false we
 * compute locally from the SAME shared lib — identical payload, but without a
 * network round-trip that (until the function is reliably deployed) times out
 * and falls back to local anyway, delaying the órbita's pattern sections. Flip
 * to true once the function is live + verified in this environment.
 */
const INTELLIGENCE_VIA_EDGE_FN = false

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function computeLocally(p: Params): Promise<Intelligence> {
  const from = shiftDate(p.today, -34)
  const [history, meals, macros] = await Promise.all([
    getWeekSignals(from, p.today),
    getMealsInRange(from, p.today),
    supabase.from('macro_targets').select('calories, protein_g').maybeSingle(),
  ])
  return computeIntelligence({
    history,
    meals,
    today: p.today,
    todayGetDay: p.todayGetDay,
    calorieTarget: macros.data?.calories ?? null,
    proteinTarget: macros.data?.protein_g ?? null,
    waterGoalGlasses: p.waterGoalGlasses,
  })
}

async function fetchIntelligence(p: Params): Promise<Intelligence> {
  // Skip the round-trip entirely while the Edge Function isn't the source of
  // truth here — go straight to the identical local compute.
  if (!INTELLIGENCE_VIA_EDGE_FN) return computeLocally(p)
  try {
    const { data, error } = await supabase.functions.invoke('daily-intelligence', { body: p })
    if (error) throw error
    if (data && (data as { error?: string }).error)
      throw new Error((data as { error: string }).error)
    if (data && (data as Intelligence).day) return data as Intelligence
    throw new Error('empty intelligence payload')
  } catch {
    // BE unavailable → local compute (same shared rules). App stays whole.
    return computeLocally(p)
  }
}

export function useDailyIntelligence() {
  const today = todayInTimezone()
  const todayGetDay = new Date(`${today}T00:00:00Z`).getUTCDay()
  const { goalMl } = useWaterGoal()
  const waterGoalGlasses = Math.max(1, Math.round(goalMl / GLASS_ML))

  return useQuery({
    queryKey: ['orbit', 'intelligence', today, todayGetDay, waterGoalGlasses] as const,
    queryFn: () => fetchIntelligence({ today, todayGetDay, waterGoalGlasses }),
    staleTime: 60_000,
  })
}
