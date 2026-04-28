/*
 * Curated table of protein sources common in Mexican diets, with
 * approximate grams of protein per 100 g of food. Numbers are
 * rounded — good enough for suggestions, not for a nutritionist's
 * spreadsheet.
 *
 * This table is a deliberate stand-in for Sprint 4's LLM. When the
 * model ships, it replaces suggestProteinSource wholesale; callers
 * don't change. The signature is the contract.
 */

export type ProteinCategory =
  | 'pollo'
  | 'pescado'
  | 'res'
  | 'huevo'
  | 'lacteo'
  | 'legumbre'
  | 'suplemento'

export type ProteinEquivalent = {
  food: string
  proteinPer100g: number
  category: ProteinCategory
}

export const PROTEIN_EQUIVALENTS: readonly ProteinEquivalent[] = [
  { food: 'pechuga de pollo', proteinPer100g: 31, category: 'pollo' },
  { food: 'atún en lata (escurrido)', proteinPer100g: 25, category: 'pescado' },
  { food: 'salmón', proteinPer100g: 22, category: 'pescado' },
  { food: 'huevos enteros', proteinPer100g: 13, category: 'huevo' },
  { food: 'claras de huevo', proteinPer100g: 11, category: 'huevo' },
  { food: 'carne de res magra', proteinPer100g: 26, category: 'res' },
  { food: 'queso cottage', proteinPer100g: 11, category: 'lacteo' },
  { food: 'yogurt griego natural', proteinPer100g: 10, category: 'lacteo' },
  { food: 'lentejas cocidas', proteinPer100g: 9, category: 'legumbre' },
  { food: 'frijoles cocidos', proteinPer100g: 8, category: 'legumbre' },
  { food: 'whey protein (1 scoop ~30g)', proteinPer100g: 80, category: 'suplemento' },
] as const

/*
 * Pick a food suggestion for the remaining protein the user needs,
 * shaped by the hour of day. Three bands, colloquial copy:
 *
 *   ≤ 20 g  — snack territory. Eggs in the morning, yogurt or whey
 *             mid-afternoon, tuna or whey otherwise.
 *   ≤ 50 g  — a proper meal. Dinner-explicit after 18:00, otherwise
 *             a generic 'mete algo proteico fuerte' nudge.
 *   > 50 g  — too much to rescue in one sitting; points at spreading
 *             across multiple meals.
 *
 * The strings drop into deriveMacroMessage's evening / daytime
 * branches as the trailing clause, so they read as natural advice
 * rather than as standalone sentences.
 */
export function suggestProteinSource(gramsNeeded: number, hour: number): string {
  if (gramsNeeded <= 20) {
    if (hour < 11) return '2 huevos te lo cubren'
    if (hour >= 15 && hour < 19) return 'un yogurt griego o whey'
    return 'una lata de atún o whey'
  }

  if (gramsNeeded <= 50) {
    if (hour >= 18) return 'pollo o pescado a la cena'
    return 'mete algo proteico fuerte'
  }

  return 'son varias comidas — pollo, atún o pescado'
}
