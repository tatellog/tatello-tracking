import { z } from 'zod'

import { requireUserId, supabase } from '@/lib/supabase'
import type { Database } from '@/types/database.types'

type MacroTargetsRow = Database['public']['Tables']['macro_targets']['Row']
export type Meal = Database['public']['Tables']['meals']['Row']

/*
 * Input schemas mirror the DB CHECK constraints so the client
 * fails fast with a useful message instead of letting Postgres
 * throw a generic CHECK-violation. These are re-used by the form
 * resolver (react-hook-form + zod) so the user sees the same
 * rules while typing, not only on submit.
 */

export const MacroTargetsInputSchema = z.object({
  // Realistic adult range (50-300 g protein, 1000-5000 kcal). Stops
  // typo'd values (e.g. extra zero) from landing in the targets row
  // before the Home rings render with broken denominators.
  protein_g: z.number().int('Usa números enteros').min(50, 'Mínimo 50 g').max(300, 'Máximo 300 g'),
  calories: z
    .number()
    .int('Usa números enteros')
    .min(1000, 'Mínimo 1000 cal')
    .max(5000, 'Máximo 5000 cal'),
})

export type MacroTargetsInput = z.infer<typeof MacroTargetsInputSchema>

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])

export const MealInputSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  protein_g: z.number().min(0, 'No puede ser negativo').max(500, 'Máximo 500 g'),
  calories: z
    .number()
    .int('Usa números enteros')
    .min(0, 'No puede ser negativo')
    .max(5000, 'Máximo 5000 cal'),
  consumed_at: z
    .date()
    .refine((d) => d.getTime() <= Date.now() + 60_000, 'No puede ser en el futuro')
    .refine((d) => d.getTime() >= Date.now() - SEVEN_DAYS_MS, 'Máximo 7 días atrás'),
  meal_type: MealTypeSchema,
})

export type MealInput = z.infer<typeof MealInputSchema>

/* ─── macro_targets ──────────────────────────────────────────────── */

export async function getMacroTargets(): Promise<MacroTargetsRow | null> {
  const { data, error } = await supabase.from('macro_targets').select('*').maybeSingle()
  if (error) throw error
  return data
}

export async function upsertMacroTargets(input: MacroTargetsInput): Promise<MacroTargetsRow> {
  const userId = await requireUserId()
  const parsed = MacroTargetsInputSchema.parse(input)
  const { data, error } = await supabase
    .from('macro_targets')
    .upsert({
      user_id: userId,
      protein_g: parsed.protein_g,
      calories: parsed.calories,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/* ─── meals ──────────────────────────────────────────────────────── */

export async function getMealsForDate(mealDate: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('meal_date', mealDate)
    .order('consumed_at', { ascending: true })
  if (error) throw error
  return data
}

export async function getMealById(id: string): Promise<Meal | null> {
  const { data, error } = await supabase.from('meals').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/* A frequent meal is a de-duplicated entry from the user's own log,
 * surfaced for one-tap re-adding in the Hoy-tab quick log. The macros
 * come from the user's most recent entry of that name (foods drift;
 * the latest log is the best estimate). */
export type FrequentMeal = {
  /** Id of the most recent meal with this name — the row to open
   *  when the user taps the history entry to edit it. */
  id: string
  name: string
  meal_type: string
  protein_g: number
  calories: number
  /** How many times this name appears in the lookback window. */
  freq: number
}

const FREQUENT_LOOKBACK_DAYS = 90

/*
 * Frequent meals — the quick log's "Lo de siempre". Derived purely
 * from the user's own meal history (no food database, no seeding):
 * pull the last 90 days, group by lowercased name, rank by frequency
 * then recency. Aggregation is client-side — at this volume (a few
 * hundred rows at most) it's cheaper than maintaining a Postgres RPC.
 * If the dataset ever outgrows that, this is the seam to move to a
 * server-side `group by`.
 */
export async function getFrequentMeals(limit = 8): Promise<FrequentMeal[]> {
  const userId = await requireUserId()
  const since = new Date(Date.now() - FREQUENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('meals')
    .select('id, name, meal_type, protein_g, calories, consumed_at')
    .eq('user_id', userId)
    .gte('consumed_at', since)
    .order('consumed_at', { ascending: false })
  if (error) throw error

  type Agg = FrequentMeal & { lastAt: string }
  const groups = new Map<string, Agg>()
  for (const m of data) {
    const key = m.name.trim().toLowerCase()
    const existing = groups.get(key)
    if (existing) {
      existing.freq += 1
    } else {
      // First time seen — and because rows are consumed_at DESC, this
      // first occurrence is the most recent, so its id + macros win.
      groups.set(key, {
        id: m.id,
        name: m.name.trim(),
        meal_type: m.meal_type,
        protein_g: Number(m.protein_g),
        calories: m.calories,
        freq: 1,
        lastAt: m.consumed_at,
      })
    }
  }

  return [...groups.values()]
    .sort((a, b) => b.freq - a.freq || b.lastAt.localeCompare(a.lastAt))
    .slice(0, limit)
    .map(({ lastAt: _lastAt, ...meal }) => meal)
}

export async function createMeal(input: MealInput): Promise<Meal> {
  const userId = await requireUserId()
  const parsed = MealInputSchema.parse(input)
  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      name: parsed.name,
      protein_g: parsed.protein_g,
      calories: parsed.calories,
      consumed_at: parsed.consumed_at.toISOString(),
      meal_type: parsed.meal_type,
      source: 'manual',
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMeal(id: string, input: MealInput): Promise<Meal> {
  const parsed = MealInputSchema.parse(input)
  const { data, error } = await supabase
    .from('meals')
    .update({
      name: parsed.name,
      protein_g: parsed.protein_g,
      calories: parsed.calories,
      consumed_at: parsed.consumed_at.toISOString(),
      meal_type: parsed.meal_type,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meals').delete().eq('id', id)
  if (error) throw error
}
