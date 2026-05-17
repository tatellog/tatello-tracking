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

const SCAN_DELAY_MS = 1700

/*
 * The "scan" — STUB, no AI. Waits, then returns a random dish from
 * the dummy library. This signature is the seam: a real vision model
 * drops in here later without touching the UI.
 */
export async function scanMeal(_photoUri: string): Promise<ScannedMeal> {
  await new Promise((resolve) => setTimeout(resolve, SCAN_DELAY_MS))
  const dish = DISHES[Math.floor(Math.random() * DISHES.length)] ?? DISHES[0]!
  return {
    name: dish.name,
    ingredients: dish.ingredients.map((ing, i) => ({ ...ing, id: `ing-${i}` })),
  }
}
