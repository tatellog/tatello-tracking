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
  // La madrugada (0-4) es picoteo, no mañana: "Desayuno" preseleccionado a
  // las 2:36 AM leía "la app no tiene idea de mi vida" y de paso "tu día ya
  // empezó comiendo de más" (target-user jul 2026).
  if (hour < 5) return 'snack'
  if (hour < 11) return 'breakfast'
  if (hour < 17) return 'lunch'
  if (hour < 22) return 'dinner'
  return 'snack'
}
