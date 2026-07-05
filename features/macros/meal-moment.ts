/*
 * El momento de comida que "toca" por hora local. Un solo lugar para los
 * cortes: antes vivían triplicados (QuickLogSheet, MealComposer,
 * MomentsToday) y con la comida terminando a las 4pm, así que a las 4:02
 * la app preseleccionaba Cena — el primer default "adivinado" que la
 * usuaria veía era un error. Horario MX: la comida corre hasta las 5pm y
 * la cena hasta las 10pm.
 */

import type { MealMoment } from './registro-intent'

export function mealMomentByHour(hour: number = new Date().getHours()): MealMoment {
  if (hour < 11) return 'breakfast'
  if (hour < 17) return 'lunch'
  if (hour < 22) return 'dinner'
  return 'snack'
}
