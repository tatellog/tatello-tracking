import * as ImageManipulator from 'expo-image-manipulator'
import { z } from 'zod'

import { supabase } from '@/lib/supabase'

import { type DishIngredient } from './dishes'

export type ScannedIngredient = DishIngredient & { id: string }

export type ScannedMeal = {
  name: string
  ingredients: ScannedIngredient[]
}

/** Protein (g) for an ingredient at its current grams. */
export function ingredientProtein(ing: { grams: number; proteinPer100: number }): number {
  return (ing.proteinPer100 * ing.grams) / 100
}

/** Calories for an ingredient at its current grams. */
export function ingredientKcal(ing: { grams: number; kcalPer100: number }): number {
  return (ing.kcalPer100 * ing.grams) / 100
}

/** Summed protein + calories across the meal's ingredients. */
export function mealTotals(ingredients: ScannedIngredient[]): {
  protein: number
  calories: number
} {
  return ingredients.reduce(
    (acc, ing) => ({
      protein: acc.protein + ingredientProtein(ing),
      calories: acc.calories + ingredientKcal(ing),
    }),
    { protein: 0, calories: 0 },
  )
}

// Shape the edge function returns (already validated + clamped server-
// side); we re-validate here so a bad/changed response degrades to a warm
// error instead of feeding NaNs into the confirm form.
const ScanResponseSchema = z.object({
  name: z.string(),
  ingredients: z.array(
    z.object({
      name: z.string(),
      grams: z.number(),
      proteinPer100: z.number(),
      kcalPer100: z.number(),
    }),
  ),
})

const SCAN_ERROR = 'No pudimos leer tu plato. Intenta de nuevo.'

/*
 * The real scan: resize the photo (small + cheap — the server uses
 * detail:low ≈ 512px anyway), base64 it in one pass, and hand it to the
 * `scan-meal` edge function (gpt-4o-mini, key server-side). Returns the
 * dish + ingredients the confirm form renders. A non-food photo comes
 * back as { name:'', ingredients:[] } — the UI then falls to manual entry.
 *
 * This is the seam the UI was built against; the signature is unchanged.
 */
export async function scanMeal(photoUri: string): Promise<ScannedMeal> {
  const processed = await ImageManipulator.manipulateAsync(
    photoUri,
    [{ resize: { width: 768 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  )
  if (!processed.base64) throw new Error(SCAN_ERROR)

  const { data, error } = await supabase.functions.invoke('scan-meal', {
    body: { imageBase64: processed.base64, mimeType: 'image/jpeg' },
  })
  if (error) throw new Error(SCAN_ERROR)

  const parsed = ScanResponseSchema.safeParse(data)
  if (!parsed.success) throw new Error(SCAN_ERROR)

  return {
    name: parsed.data.name,
    ingredients: parsed.data.ingredients.map((ing, i) => ({ ...ing, id: `ing-${i}` })),
  }
}
