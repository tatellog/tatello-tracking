/*
 * REGLA DE NEGOCIO — visibilidad del ciclo, en un solo lugar.
 *
 * El ciclo solo existe en la app para quien menstrúa hoy:
 *   - usuario masculino → NUNCA ve contenido de ciclo,
 *   - usuaria femenina sin menstruación activa (embarazo, postmenopausia,
 *     "no tengo ciclo" / prefirió no decir / sin responder) → tampoco.
 *
 * Pure y compartida (app Metro + Edge Functions Deno) para que el engine
 * y cada superficie de UI apliquen EXACTAMENTE el mismo criterio. La capa
 * app la re-exporta tipada desde features/cycle/phase.ts.
 */

/** Cycle situations con ciclo mensual activo. Pregnant / postmenopause /
 *  skip no tienen fase ni contenido de ciclo. */
export const ACTIVE_CYCLE_SITUATIONS = ['menstruates', 'contraception', 'irregular'] as const

export function isCycleActive(
  biologicalSex: string | null | undefined,
  cycleSituation: string | null | undefined,
): boolean {
  // Defensa también para perfiles legacy/raros: un hombre con un
  // cycle_situation persistido por error sigue sin ver nada de ciclo.
  if (biologicalSex === 'male') return false
  if (!cycleSituation) return false
  return (ACTIVE_CYCLE_SITUATIONS as readonly string[]).includes(cycleSituation)
}
