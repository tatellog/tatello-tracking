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
  protein_g: z.number().int('Usa números enteros').min(1, 'Mínimo 1 g').max(999, 'Máximo 999 g'),
  calories: z
    .number()
    .int('Usa números enteros')
    .min(1, 'Mínimo 1 cal')
    .max(9999, 'Máximo 9999 cal'),
})

export type MacroTargetsInput = z.infer<typeof MacroTargetsInputSchema>

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

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
