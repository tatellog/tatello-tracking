/*
 * Déficit sano — fuente única de verdad (manifiesto · línea roja).
 *
 * Un día cuenta como "déficit" SOLO si el consumo está dentro de
 * [0.6×target, target]: en déficit, pero por encima del 60% de la meta.
 * Debajo del piso NO se cuenta como logro — premiar una ingesta muy por
 * debajo de la meta sería celebrar restricción extrema, prohibido por el
 * manifiesto. Esta definición la comparten Día, Semana y Mes para que el
 * concepto "día en déficit" sea idéntico en toda Órbita.
 *
 * Vive en _shared/intelligence/ (server + cliente); features/orbit/deficit.ts
 * lo re-exporta para que todos los imports del cliente sigan funcionando.
 */

/** Piso de seguridad: por debajo del 60% del target NO es déficit (sería
 *  restricción extrema). */
export const DEFICIT_FLOOR_RATIO = 0.6

/** ¿Ese día estuvo en déficit sano? Consumo dentro de [0.6×target, target].
 *  `false` si no hay calorías registradas o target inválido. */
export function isDeficitDay(
  calories: number | null | undefined,
  target: number | null | undefined,
): boolean {
  if (target == null || target <= 0) return false
  if (calories == null || calories <= 0) return false
  return calories <= target && calories >= target * DEFICIT_FLOOR_RATIO
}

/** Hoy todavía abierto y debajo del piso (ST-002 · día parcial): va a medio
 *  registrar, así que no se lee ni entra a ningún denominador "X de Y en
 *  déficit" hasta que cierre. En la banda o sobre la meta sí cuenta, como en
 *  vivo. `openDay` = el día real de hoy (null = no hay día abierto). */
export function isOpenBelowFloor(
  day: string | null | undefined,
  calories: number | null | undefined,
  target: number | null | undefined,
  openDay: string | null | undefined,
): boolean {
  if (openDay == null || day !== openDay) return false
  if (target == null || target <= 0 || calories == null || calories <= 0) return false
  return !isDeficitDay(calories, target) && calories <= target
}
