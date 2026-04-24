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
 * shaped by the hour of day. Three bands:
 *
 *   ≤ 20 g  — snack territory; suggests what's realistic as a
 *             between-meals bite (eggs in the morning, yogurt or
 *             whey in the afternoon, whey or tuna in the evening).
 *   ≤ 50 g  — a proper meal; the gram figure is computed against
 *             a 25 g-per-100 g protein anchor (lean meat / fish).
 *   > 50 g  — too much to rescue in one sitting; honest copy that
 *             points at distributing across two meals.
 */
export function suggestProteinSource(gramsNeeded: number, hour: number): string {
  if (gramsNeeded <= 20) {
    if (hour < 11) return `2 huevos cubren ${Math.round(gramsNeeded)}g`
    if (hour >= 15 && hour < 19) return 'un yogurt griego o un scoop de whey'
    return '1 scoop de whey o atún en lata'
  }

  if (gramsNeeded <= 50) {
    // 25 g protein per 100 g is the rough anchor across tuna / lean beef.
    const grams = Math.round((gramsNeeded / 25) * 100)
    if (hour >= 18) return `unos ${grams}g de pollo o pescado para la cena`
    return `unos ${grams}g de proteína magra`
  }

  return 'te faltan más de 50g — 2 comidas con proteína sólida (pollo, pescado, res)'
}
