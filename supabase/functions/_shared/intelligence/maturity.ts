/*
 * La madurez de datos de Órbita — PURA y determinista (docs/orbita-maturity-spec.md).
 *
 * Órbita promete solo lo que sus datos sostienen. La etapa se mide en DÍAS
 * CON DATOS ÚTILES, no en días desde el registro (quien volvió tras un mes
 * fuera no está en "mes 3"), y cada dimensión madura por separado: con reloj
 * y sin comidas maduran sueño y movimiento; los patrones de déficit no.
 *
 *   0 · Llegando          < 3 días
 *   1 · Primeras señales  3 a 7   (observaciones descriptivas)
 *   2 · Señal naciente    8 a 20  (correlaciones tentativas)
 *   3 · Tu mes            21 a 59 (hallazgo sorpresa + patrones confirmados)
 *   4 · Tus temporadas    60 a 179
 *   5 · Tu historia       ≥ 180
 */
import { dayQuality } from './day-quality.ts'
import type { DailySignals } from './types.ts'

export type MaturityStage = 0 | 1 | 2 | 3 | 4 | 5

export type DataMaturity = {
  /** Días útiles por dimensión. Comida = día COMPLETO (modelo de día parcial). */
  days: { food: number; sleep: number; movement: number }
  /** La etapa de Órbita: la de la dimensión más madura. */
  stage: MaturityStage
  /** ¿Hay comida suficiente para patrones de déficit? (≥ 8 días completos). */
  deficitReady: boolean
  /** Otras dimensiones ya maduran pero la comida no: el déficit está
   *  bloqueado por falta de comidas, y la UI lo dice con su razón. */
  deficitBlockedByFood: boolean
}

const STAGE_FLOORS: readonly [MaturityStage, number][] = [
  [5, 180],
  [4, 60],
  [3, 21],
  [2, 8],
  [1, 3],
]

export function stageFor(days: number): MaturityStage {
  for (const [stage, floor] of STAGE_FLOORS) if (days >= floor) return stage
  return 0
}

export function dataMaturity(signals: readonly DailySignals[]): DataMaturity {
  let food = 0
  let sleep = 0
  let movement = 0
  const seen = new Set<string>()
  for (const s of signals) {
    if (!s.day || seen.has(s.day)) continue
    seen.add(s.day)
    if ((s.meal_count ?? 0) > 0 && dayQuality(s) === 'completo') food++
    if ((s.sleep_minutes ?? 0) > 0) sleep++
    if (s.trained === true || (s.steps ?? 0) > 0) movement++
  }
  const deficitReady = food >= 8
  return {
    days: { food, sleep, movement },
    stage: stageFor(Math.max(food, sleep, movement)),
    deficitReady,
    deficitBlockedByFood: !deficitReady && Math.max(sleep, movement) >= 8,
  }
}
