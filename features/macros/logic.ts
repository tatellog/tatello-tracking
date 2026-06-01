import { suggestProteinSource } from './proteinEquivalents'

export type MacrosState = {
  protein_g: number
  calories: number
}

export type MacroTargets = {
  protein_g: number
  calories: number
}

/*
 * Turn the current day's macro picture into a single narrative line
 * for the Home card. Fully deterministic — same inputs, same output —
 * so the acceptance scenarios can be proved by unit tests instead
 * of eyeballing the simulator at different times of day.
 *
 * Sprint 4 replaces this function's body with Anthropic structured
 * output; the signature stays so every caller's call site keeps
 * working. Product advice lives in here until then.
 */
export function deriveMacroMessage(
  current: MacrosState,
  target: MacroTargets,
  hour: number,
  mealCount: number,
): string {
  const proteinPct = target.protein_g > 0 ? current.protein_g / target.protein_g : 0
  const calPct = target.calories > 0 ? current.calories / target.calories : 0
  const proteinRemaining = Math.max(0, Math.round(target.protein_g - current.protein_g))
  const calRemaining = Math.max(0, Math.round(target.calories - current.calories))

  // 1 — nothing logged yet.
  if (mealCount === 0) {
    if (hour < 11) return 'Día abierto. Arranca con huevos o yogurt griego al desayuno.'
    if (hour < 16) return 'Aún no loggeas. Mete algo proteico ahora.'
    return 'Día sin loggear. ¿Olvido o ayuno?'
  }

  // 2 — protein significantly over target, calories still in range.
  // Checked before the 'protein closed' branch so a user at 120%
  // protein gets the celebratory copy, not a neutral nudge.
  if (proteinPct > 1.1 && calPct <= 1) {
    return 'Proteína superada. Buen día.'
  }

  // 3 — protein goal met, calories still have room.
  if (proteinPct >= 1 && calPct < 1) {
    return `Proteína cerrada. Te quedan ${calRemaining} cal, espacio para una buena cena.`
  }

  // 4 — large protein gap, evening hours: reassure + suggest dinner.
  if (proteinRemaining > 30 && hour >= 17) {
    const suggestion = suggestProteinSource(proteinRemaining, hour)
    return `Vas atrasada. ${proteinRemaining}g por delante: ${suggestion} y la pegas.`
  }

  // 5 — large protein gap, still daytime: distribute across the day.
  if (proteinRemaining > 30 && hour < 17) {
    const suggestion = suggestProteinSource(proteinRemaining, hour)
    return `Andas baja en proteína. ${proteinRemaining}g pendientes: ${suggestion}.`
  }

  // 6 — comfortably on track, just nudge the remainder.
  if (proteinPct >= 0.7 && proteinPct < 1) {
    return `Vas bien. Te faltan ${proteinRemaining}g por cerrar.`
  }

  // 7 — significantly over calories.
  if (calPct > 1.05) {
    const over = Math.round(current.calories - target.calories)
    return `Te pasaste por ${over} cal. Si entrenaste hoy, no pasa nada.`
  }

  // 8 — default summary line.
  return `Te quedan ${proteinRemaining}g de proteína y ${calRemaining} cal.`
}

/* ─── Weekly meal aggregate (the "Esta semana" layer in Comidas) ─────
 *
 * Pure: takes the week's meals + the 7 target dates + an optional protein
 * reference, returns the read-only stats the weekly view shows. Framing
 * is manifesto-safe by construction — it counts protein and logging
 * CONSISTENCY, never "good/bad" food categories, and never a %-to-goal.
 */
/** Meal-time buckets — classified by WHEN (neutral), never by good/bad
 *  food. Drives the celestial week ring. */
export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealTypeKey = (typeof MEAL_TYPES)[number]

export type WeeklyMealStats = {
  /** Distinct days within the window that have at least one logged meal. */
  daysLogged: number
  /** Window length (7). */
  totalDays: number
  /** Mean protein over the LOGGED days only (null if none logged) — we
   *  never average over unlogged days, which would read as a punishment. */
  proteinAvgPerLoggedDay: number | null
  /** The protein reference, if the user set one. */
  proteinTarget: number | null
  /** Of the logged days, how many reached the protein reference (null
   *  when there's no reference to compare against). */
  daysHitProtein: number | null
  /** Count of MEALS in the window per meal-time (the ring's segments). */
  byMealType: Record<MealTypeKey, number>
  /** Total meals logged in the window. */
  totalMeals: number
}

/** The N calendar dates ending at `today` (inclusive), oldest first.
 *  Pure Y-M-D calendar math (UTC epoch days) so it's timezone-agnostic. */
export function lastNDates(today: string, n: number): string[] {
  const [y, m, d] = today.split('-').map(Number)
  const base = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i -= 1) {
    const dt = new Date(base - i * 86_400_000)
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(dt.getUTCDate()).padStart(2, '0')
    out.push(`${dt.getUTCFullYear()}-${mm}-${dd}`)
  }
  return out
}

export function computeWeeklyMealStats(
  meals: readonly { meal_date: string | null; protein_g: number | string; meal_type?: string }[],
  weekDates: readonly string[],
  proteinTarget: number | null,
): WeeklyMealStats {
  const inWeek = new Set(weekDates)
  const proteinByDate = new Map<string, number>()
  const byMealType: Record<MealTypeKey, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }
  let totalMeals = 0
  for (const meal of meals) {
    if (meal.meal_date == null || !inWeek.has(meal.meal_date)) continue
    proteinByDate.set(
      meal.meal_date,
      (proteinByDate.get(meal.meal_date) ?? 0) + Number(meal.protein_g),
    )
    totalMeals += 1
    if (meal.meal_type && meal.meal_type in byMealType) {
      byMealType[meal.meal_type as MealTypeKey] += 1
    }
  }
  const perDay = [...proteinByDate.values()]
  const daysLogged = perDay.length
  return {
    daysLogged,
    totalDays: weekDates.length,
    proteinAvgPerLoggedDay:
      daysLogged === 0 ? null : perDay.reduce((a, b) => a + b, 0) / daysLogged,
    proteinTarget,
    daysHitProtein:
      proteinTarget == null ? null : perDay.filter((p) => p >= proteinTarget).length,
    byMealType,
    totalMeals,
  }
}
