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
 * so the 6 acceptance scenarios can be proved by unit tests instead
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
  const caloriePct = target.calories > 0 ? current.calories / target.calories : 0
  const proteinRemaining = Math.max(0, Math.round(target.protein_g - current.protein_g))
  const calorieRemaining = Math.max(0, Math.round(target.calories - current.calories))

  // 1 — nothing logged yet.
  if (mealCount === 0) {
    if (hour < 11) return 'Empieza fuerte con proteína al desayuno. Huevos o yogurt griego.'
    if (hour < 16) return 'Ya es media tarde sin loggear. Empieza con algo proteico.'
    return 'No has loggeado nada hoy. ¿Olvido o ayuno?'
  }

  // 2a — protein significantly over, calories in range → recognize
  // the over-delivery explicitly. Checked before the 'Proteína lista'
  // rule so a user at 120% protein doesn't read a neutral nudge.
  if (proteinPct > 1.1 && caloriePct <= 1) {
    return 'Proteína superada. Buen día nutricional.'
  }

  // 2b — protein goal met, calories still have room.
  if (proteinPct >= 1 && caloriePct < 1) {
    return `Proteína lista. Te quedan ${calorieRemaining} cal — espacio para algo de carbo.`
  }

  // 3 — large protein gap, evening hours: suggest a dinner source.
  if (proteinRemaining > 30 && hour >= 17) {
    return `Te faltan ${proteinRemaining}g de proteína. ${capitalize(
      suggestProteinSource(proteinRemaining, hour),
    )}.`
  }

  // 4 — large protein gap, still daytime: suggest distribution.
  if (proteinRemaining > 30 && hour < 17) {
    return `Faltan ${proteinRemaining}g — distribúyelos en lo que queda del día. ${capitalize(
      suggestProteinSource(proteinRemaining, hour),
    )}.`
  }

  // 5 — comfortably on track, just nudge the remaining.
  if (proteinPct >= 0.7 && proteinPct < 1) {
    return `Vas bien. Te quedan ${proteinRemaining}g — ${suggestProteinSource(
      proteinRemaining,
      hour,
    )}.`
  }

  // 6 — significantly over calories.
  if (caloriePct > 1.05) {
    const over = Math.round(current.calories - target.calories)
    return `Pasaste tu meta de calorías por ${over}. Si entrenas hoy, no pasa nada.`
  }

  // 7 — default summary line.
  return `Te quedan ${proteinRemaining}g de proteína y ${calorieRemaining} cal.`
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
