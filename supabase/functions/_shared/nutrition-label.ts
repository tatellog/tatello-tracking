/*
 * La etiqueta nutrimental, de lo impreso a per-100 (ST-004 · H3). Pura y
 * compartida: la edge `scan-meal` la usa y el cliente la prueba en jest
 * (re-export en features/meal-scan/nutrition-label.ts).
 *
 * El modelo solo COPIA la etiqueta tal como está impresa (base, porción
 * declarada y números); la conversión a per-100 la hace este código, no el
 * LLM, para que sea verificable. Un número que falta o que es imposible
 * llega como null: la app lo pide en vez de inventarlo.
 */

/** Cómo declara la etiqueta sus números. */
export type LabelBasis = 'per100' | 'perServing'

/** Lo impreso en la etiqueta, tal cual. */
export type LabelReading = {
  basis: LabelBasis
  /** Gramos (o ml) de UNA porción declarada; null si no se ve. */
  servingGrams: number | null
  kcal: number | null
  protein: number | null
  sugar: number | null
}

/** El producto como UN ingrediente, per-100, con la porción del envase. */
export type LabelIngredient = {
  name: string
  grams: number
  kcalPer100: number | null
  proteinPer100: number | null
  sugarPer100: number
}

/** Topes per-100 de lo posible: más que esto es una mala lectura (45 leído
 *  como 450), y se pide en vez de guardarse. */
export const LABEL_MAX_PER100 = { kcal: 900, protein: 100, sugar: 100 } as const

const round2 = (n: number) => Math.round(n * 100) / 100

export function normalizeLabel(name: string, r: LabelReading): LabelIngredient {
  const serving = r.servingGrams != null && r.servingGrams > 0 ? r.servingGrams : null
  // Por porción sin saber la porción: no hay forma honesta de pasar a per-100.
  const factor = r.basis === 'per100' ? 1 : serving != null ? 100 / serving : null
  const per100 = (v: number | null, max: number): number | null => {
    if (v == null || factor == null || !Number.isFinite(v) || v < 0) return null
    const x = round2(v * factor)
    return x > max ? null : x
  }
  return {
    name,
    grams: serving ?? 100,
    kcalPer100: per100(r.kcal, LABEL_MAX_PER100.kcal),
    proteinPer100: per100(r.protein, LABEL_MAX_PER100.protein),
    // El azúcar no entra al motor ni a las metas: si no se ve, 0.
    sugarPer100: per100(r.sugar, LABEL_MAX_PER100.sugar) ?? 0,
  }
}
