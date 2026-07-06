/*
 * Bus del "Deshacer" tras el re-log de 1 tap (QuickLog "Lo de siempre").
 *
 * El 1-tap solo es sin fricción si equivocarse también lo es: sin undo,
 * la usuaria duda antes de tocar y la velocidad prometida muere (patrón
 * MFP/YAZIO: quick-add siempre con snackbar + deshacer). El toast vive
 * GLOBAL en el (tabs) layout (el sheet se cierra ~520 ms después del
 * tap, así que el undo debe sobrevivirlo). Mismo patrón que
 * celebrate-bus / universe-delta-bus.
 */

export type MealUndoPayload = {
  /** id del meal recién creado (para el delete del deshacer). */
  id: string
  name: string
  /** "Desayuno" / "Cena"... — el momento al que se sumó. */
  mealTypeLabel: string
}

type Listener = (payload: MealUndoPayload) => void

const listeners = new Set<Listener>()

export function emitMealUndo(payload: MealUndoPayload): void {
  listeners.forEach((fn) => fn(payload))
}

export function subscribeMealUndo(fn: Listener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
