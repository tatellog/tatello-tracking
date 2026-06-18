/*
 * Bus "comida registrada" — desacopla el ACTO de registrar (MealComposer /
 * AllyCard) de la CELEBRACIÓN visual (NutritionMoon: pulso + partículas hacia
 * la luna). El registro emite; la luna escucha. Mismo patrón que los otros
 * buses de módulo del proyecto (un Set de listeners, sin estado global).
 *
 * NO dispara recompensa de universo (eso vive en Hoy) → un solo conteo.
 */

type Listener = () => void

const listeners = new Set<Listener>()

/** Llamar tras un registro exitoso en Comidas. */
export function emitMealLogged(): void {
  for (const l of listeners) l()
}

/** La luna se suscribe para celebrar (pulso + partículas). Devuelve unsub. */
export function subscribeMealLogged(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
