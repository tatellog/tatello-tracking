/*
 * "Lo que alimenta tu transformación" — consistency over the last N
 * days (the rows in Comidas: Proteína / Agua — both real nutrients).
 *
 * PURE + manifesto-safe BY CONSTRUCTION: it counts DAYS FULFILLED
 * (protein reference reached, water goal met), never "good/bad" food,
 * never a rigid streak to break, never a %-to-shame. Missing a day
 * simply doesn't add to the count — it is never subtracted or punished.
 * "X de 10" reads as "lo que ya alimentaste", not "lo que fallaste".
 *
 * Calorías are deliberately NOT a row here: scoring "days under a
 * calorie target" would reward restriction (the clinical red line) and
 * turn calories into the countdown the manifesto forbids. They live as
 * a quiet context fact in the moon card instead.
 */

export type ConsistencyScore = { hit: number; total: number }

export type NourishmentConsistency = {
  /** `null` when no protein reference is set — the row is then hidden,
   *  not shown as "0 de 10", which would read as failure. */
  protein: ConsistencyScore | null
  agua: ConsistencyScore
}

export function computeNourishmentConsistency(args: {
  /** The window of calendar days (oldest→newest), e.g. the last 10. */
  dates: readonly string[]
  meals: readonly { meal_date: string | null; protein_g: number | string }[]
  /** glasses logged per `intake_date` within the window. */
  waterByDate: Readonly<Record<string, number>>
  /** The user's protein reference, or null if unset. */
  proteinTarget: number | null
  /** Glasses that count as "goal met" for a day (>= 1). */
  waterGoalGlasses: number
}): NourishmentConsistency {
  const { dates, meals, waterByDate, proteinTarget, waterGoalGlasses } = args
  const inWindow = new Set(dates)
  const proteinByDate = new Map<string, number>()

  for (const m of meals) {
    if (m.meal_date == null || !inWindow.has(m.meal_date)) continue
    proteinByDate.set(m.meal_date, (proteinByDate.get(m.meal_date) ?? 0) + Number(m.protein_g))
  }

  const total = dates.length
  const goal = Math.max(1, waterGoalGlasses)

  const aguaHit = dates.filter((d) => (waterByDate[d] ?? 0) >= goal).length
  const proteinHit =
    proteinTarget == null || proteinTarget <= 0
      ? null
      : dates.filter((d) => (proteinByDate.get(d) ?? 0) >= proteinTarget).length

  return {
    protein: proteinHit == null ? null : { hit: proteinHit, total },
    agua: { hit: aguaHit, total },
  }
}
