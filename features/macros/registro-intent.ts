/*
 * Bus "intención de registro" — desacopla la sección de Momentos (emisor) del
 * MealComposer (suscriptor), ambos en el Tab Comidas pero sin estado
 * compartido. Tocar un momento pendiente (○ Cena) emite la intención con su
 * `mealType`; el composer abre el registro y fija ese tipo para la próxima
 * comida creada. Así "ves ○ Cena → sabes qué hacer" en 1 tap.
 */

import type { MealInput } from './api'

export type MealMoment = MealInput['meal_type']

type Listener = (mealType: MealMoment) => void

const listeners = new Set<Listener>()

export function emitRegistroIntent(mealType: MealMoment): void {
  for (const l of listeners) l(mealType)
}

export function subscribeRegistroIntent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
