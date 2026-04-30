export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type MealCopy = {
  type: MealType
  /** Capitalised label, e.g. "Cena" — used in eyebrow + save button. */
  label: string
  /** Conjugated verb for the question copy: desayunaste / comiste / cenaste / comiste de snack. */
  verb: string
  /** "Guardar desayuno" / "Guardar comida" / etc. */
  saveLabel: string
}

/*
 * Window definitions match the server-side backfill in
 * 20260430120001_meals_meal_type_and_suggestions.sql so that what the
 * client classifies "now" as → what the suggestion RPC pulls back →
 * what gets saved on submit form a consistent triangle.
 *
 * Boundaries:
 *   05–10  → breakfast
 *   11–15  → lunch
 *   16–20  → dinner
 *   else   → snack (late night, very early morning)
 */
export function inferMealType(date: Date = new Date()): MealCopy {
  const hour = date.getHours()
  if (hour >= 5 && hour <= 10) {
    return {
      type: 'breakfast',
      label: 'Desayuno',
      verb: 'desayunaste',
      saveLabel: 'Guardar desayuno',
    }
  }
  if (hour >= 11 && hour <= 15) {
    return { type: 'lunch', label: 'Comida', verb: 'comiste', saveLabel: 'Guardar comida' }
  }
  if (hour >= 16 && hour <= 20) {
    return { type: 'dinner', label: 'Cena', verb: 'cenaste', saveLabel: 'Guardar cena' }
  }
  return {
    type: 'snack',
    label: 'Snack',
    verb: 'comiste de snack',
    saveLabel: 'Guardar snack',
  }
}

/*
 * 12-hour clock with am/pm suffix used in the log-meal header
 * ("Cena · 7:35pm"). Chosen over toLocaleTimeString to avoid
 * inconsistent space separators across iOS / Android / web.
 */
export function formatMealHeaderTime(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours >= 12 ? 'pm' : 'am'
  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${h12}:${minutes.toString().padStart(2, '0')}${period}`
}
