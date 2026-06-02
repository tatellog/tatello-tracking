import * as ImageManipulator from 'expo-image-manipulator'
import { z } from 'zod'

import { supabase } from '@/lib/supabase'

import { DISHES, type DishIngredient } from './dishes'

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

/*
 * MOCK vs REAL — env-driven so going live is a config flip, not a code
 * change. Defaults to MOCK (safe): a missing/empty env never points the
 * app at a non-deployed function. To go live, set
 *   EXPO_PUBLIC_USE_MOCK_SCAN=false
 * in .env.local AFTER deploying the `scan-meal` function + its
 * OPENAI_API_KEY secret, then restart Expo.
 */
const USE_MOCK_SCAN = process.env.EXPO_PUBLIC_USE_MOCK_SCAN !== 'false'

const SCAN_ERROR = 'No pudimos leer tu plato. Intenta de nuevo.'
const SCAN_DELAY_MS = 1500

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

function withIds(meal: { name: string; ingredients: DishIngredient[] }): ScannedMeal {
  return {
    name: meal.name,
    ingredients: meal.ingredients.map((ing, i) => ({ ...ing, id: `ing-${i}` })),
  }
}

function randomDish() {
  return DISHES[Math.floor(Math.random() * DISHES.length)] ?? DISHES[0]!
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ── MOCKS (paso 1) ─────────────────────────────────────────────────── */

async function scanMealMock(): Promise<ScannedMeal> {
  await delay(SCAN_DELAY_MS)
  return withIds(randomDish())
}

async function scanMealFromTextMock(description: string): Promise<ScannedMeal> {
  await delay(SCAN_DELAY_MS)
  const dish = randomDish()
  // Echo the user's words as the meal name when they wrote something, so
  // the confirm form feels like it parsed *their* text.
  return withIds({ name: description.trim() || dish.name, ingredients: dish.ingredients })
}

/* ── REAL calls (activated in paso 3: USE_MOCK_SCAN=false + deploy) ───── */

async function scanMealReal(photoUri: string): Promise<ScannedMeal> {
  const processed = await ImageManipulator.manipulateAsync(photoUri, [{ resize: { width: 768 } }], {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  })
  if (!processed.base64) throw new Error(SCAN_ERROR)

  const { data, error } = await supabase.functions.invoke('scan-meal', {
    body: { imageBase64: processed.base64, mimeType: 'image/jpeg' },
  })
  if (error) throw new Error(SCAN_ERROR)

  const parsed = ScanResponseSchema.safeParse(data)
  if (!parsed.success) throw new Error(SCAN_ERROR)
  return withIds(parsed.data)
}

async function scanMealFromTextReal(description: string): Promise<ScannedMeal> {
  // The edge function gets a `text` branch in paso 3 (parse a description
  // into the same ingredient shape). Same validation contract.
  const { data, error } = await supabase.functions.invoke('scan-meal', {
    body: { text: description },
  })
  if (error) throw new Error(SCAN_ERROR)

  const parsed = ScanResponseSchema.safeParse(data)
  if (!parsed.success) throw new Error(SCAN_ERROR)
  return withIds(parsed.data)
}

/* ── Public seams (UI calls these; mock vs real is internal) ─────────── */

/** Scan a meal PHOTO → dish + ingredients. Mocked until paso 3. */
export async function scanMeal(photoUri: string): Promise<ScannedMeal> {
  return USE_MOCK_SCAN ? scanMealMock() : scanMealReal(photoUri)
}

/** Parse a TEXT description ("2 huevos con pan") → dish + ingredients.
 *  Mocked until paso 3. */
export async function scanMealFromText(description: string): Promise<ScannedMeal> {
  return USE_MOCK_SCAN ? scanMealFromTextMock(description) : scanMealFromTextReal(description)
}
