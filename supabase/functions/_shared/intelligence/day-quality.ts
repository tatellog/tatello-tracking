import type { DailySignals } from './types.ts'

/*
 * Calidad del día (V-09 · modelo de día parcial) — LA definición única de
 * "día completo / parcial / vacío" para todo el motor. Antes cada
 * consumidor decidía solo (adaptive-tdee: ≥800 kcal "día creíble";
 * weekly-reading: >0 kcal "día con comida"); ahora la regla vive aquí,
 * corre idéntica en server y cliente, y las superficies pueden declarar
 * su base ("con tus días completos") sin re-derivarla.
 *
 *   · completo — registro creíble: alimenta promedios y TDEE.
 *   · parcial  — hubo comida pero lee a registro a medias (un yogurt
 *                suelto): cuenta como presencia y evidencia del día,
 *                NUNCA envenena promedios ni el balance energético.
 *   · vacio    — sin comida registrada: silencio, jamás juicio.
 *
 * El umbral es el histórico del TDEE adaptativo (800 kcal) — este módulo
 * UNIFICA, no cambia comportamiento. `meal_count` NO participa a
 * propósito: un día de 900 kcal en una sola comida es creíble, y decidir
 * lo contrario es un cambio de producto (decisión de la dueña, no de una
 * refactorización).
 *
 * Decisiones de la dueña (23 jul 2026):
 *   · Un día PARCIAL sí cuenta como "día en déficit" en trayectoria y
 *     Mes — no es accidente, no "corregirlo".
 *   · El TDEE sigue EXCLUYENDO parciales de su promedio (status quo).
 */

export type DayQuality = 'completo' | 'parcial' | 'vacio'

/** Umbral de día creíble en kcal — el mismo que siempre usó el TDEE
 *  adaptativo; menos que esto lee a registro incompleto. */
export const COMPLETE_DAY_MIN_KCAL = 800

/** La calidad de un día según sus propias señales de comida. */
export function dayQuality(s: Pick<DailySignals, 'calories'>): DayQuality {
  const kcal = s.calories ?? 0
  if (kcal <= 0) return 'vacio'
  return kcal >= COMPLETE_DAY_MIN_KCAL ? 'completo' : 'parcial'
}
