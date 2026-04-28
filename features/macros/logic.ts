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
    return `Proteína cerrada. Te quedan ${calRemaining} cal — espacio para una buena cena.`
  }

  // 4 — large protein gap, evening hours: reassure + suggest dinner.
  if (proteinRemaining > 30 && hour >= 17) {
    const suggestion = suggestProteinSource(proteinRemaining, hour)
    return `Vas atrasada. ${proteinRemaining}g por delante — ${suggestion} y la pegas.`
  }

  // 5 — large protein gap, still daytime: distribute across the day.
  if (proteinRemaining > 30 && hour < 17) {
    const suggestion = suggestProteinSource(proteinRemaining, hour)
    return `Andas baja en proteína. ${proteinRemaining}g pendientes — ${suggestion}.`
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
