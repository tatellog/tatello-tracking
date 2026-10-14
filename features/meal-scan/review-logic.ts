/*
 * La revisión de una comida escaneada (ST-004), pura y testeable: cómo se
 * lee lo que la usuaria teclea, cómo se pasa su porción a per-100 y cuándo
 * se puede confirmar. Antes vivía en línea en app/scan-meal.tsx.
 */
import type { ScannedIngredient } from './scan'

/** Lo que tecleó → número. Acepta "12.5" y "12,5"; vacío o basura → 0.
 *  Antes se borraba todo lo que no fuera dígito y "12.5" se leía 125 (×10). */
export function parseDecimalInput(raw: string): number {
  const cleaned = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const [int = '', ...rest] = cleaned.split('.')
  const n = Number(rest.length > 0 ? `${int || '0'}.${rest.join('')}` : int)
  return Number.isFinite(n) ? n : 0
}

/** Un valor de SU porción (los gramos de la fila) → per-100, para que la fila
 *  escale igual que las demás si luego cambia los gramos. */
export function perPortionToPer100(value: number, grams: number): number {
  return grams > 0 ? (value * 100) / grams : value
}

/** Un dato que la etiqueta no trajo (o el modelo no leyó). */
export type MissingField = 'kcal' | 'protein'

/** ¿Se puede guardar? Nunca con un dato faltante sin llenar ni con un
 *  ingrediente manual sin sus kcal reales (V-07: nunca inventar). */
export function canConfirmIngredients(
  ingredients: readonly Pick<ScannedIngredient, 'source' | 'missing' | 'grams' | 'kcalPer100'>[],
): boolean {
  if (ingredients.length === 0) return false
  return ingredients.every(
    (i) =>
      (i.missing?.length ?? 0) === 0 &&
      !(i.source === 'manual' && (i.kcalPer100 * i.grams) / 100 <= 0),
  )
}

/** Lo que tecleó para un macro de la fila: per-100, ese dato ya no falta, y
 *  una fila de etiqueta pasa a "ajustada por ti" (sus números ya no son los
 *  leídos). */
export function withTypedMacro<T extends ScannedIngredient>(
  ing: T,
  field: MissingField,
  raw: string,
): T {
  const per100 = perPortionToPer100(parseDecimalInput(raw), ing.grams)
  const missing = ing.missing?.filter((m) => m !== field)
  return {
    ...ing,
    ...(field === 'kcal' ? { kcalPer100: per100 } : { proteinPer100: per100 }),
    missing: missing && missing.length > 0 ? missing : undefined,
    source: ing.source === 'etiqueta' ? 'manual' : ing.source,
  }
}

/** Reescanear: lo nuevo del scan + las filas que la usuaria agregó a mano
 *  (las que no venían del scan anterior), para no borrar su trabajo. */
export function mergeRescan<T extends { id: string }>(
  fresh: readonly T[],
  current: readonly T[],
  scannedIds: ReadonlySet<string>,
): T[] {
  return [...fresh, ...current.filter((i) => !scannedIds.has(i.id))]
}
