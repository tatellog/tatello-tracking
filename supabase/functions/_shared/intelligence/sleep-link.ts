/*
 * Sueño ↔ déficit — el cierre de la pantalla de detalle de sueño.
 *
 * En Stelar el sueño no es una meta propia: vale porque alimenta el déficit.
 * Este detector compara la tasa de días en déficit tras noches de 7 h o más
 * contra noches más cortas (el sueño de un día es la noche ANTERIOR, porque
 * se atribuye al día en que despertó). Solo habla cuando la diferencia es
 * clara y a favor de dormir: si no hay evidencia, la pantalla calla.
 */
import { isDeficitDay } from './deficit.ts'
import type { DailySignals } from './types.ts'

export type SleepDeficitLink = {
  /** La frase del hallazgo, dicha. */
  headline: string
  /** Días en déficit tras noches de 7 h o más (d de n). */
  good: { deficit: number; days: number }
  /** Días en déficit tras noches más cortas (d de n). */
  short: { deficit: number; days: number }
}

/** Noche "buena": 7 h o más. */
export const SLEEP_LINK_GOOD_MIN = 420
/** Mínimo de días por lado para hablar. */
export const SLEEP_LINK_MIN_SIDE = 3
/** Ventaja mínima (en tasa) para decirlo: la misma con la que nace un patrón. */
export const SLEEP_LINK_MIN_ADVANTAGE = 0.15

export function sleepDeficitLink(
  signals: readonly Pick<DailySignals, 'day' | 'sleep_minutes' | 'calories'>[],
  calorieTarget: number | null | undefined,
): SleepDeficitLink | null {
  if (calorieTarget == null || calorieTarget <= 0) return null
  const days = new Map<string, Pick<DailySignals, 'sleep_minutes' | 'calories'>>()
  for (const s of signals) if (s.day) days.set(s.day, s)
  const withBoth = [...days.values()].filter(
    (s) => s.sleep_minutes != null && s.sleep_minutes > 0 && s.calories != null && s.calories > 0,
  )
  const good = withBoth.filter((s) => s.sleep_minutes! >= SLEEP_LINK_GOOD_MIN)
  const short = withBoth.filter((s) => s.sleep_minutes! < SLEEP_LINK_GOOD_MIN)
  if (good.length < SLEEP_LINK_MIN_SIDE || short.length < SLEEP_LINK_MIN_SIDE) return null
  const gd = good.filter((s) => isDeficitDay(s.calories, calorieTarget)).length
  const sd = short.filter((s) => isDeficitDay(s.calories, calorieTarget)).length
  if (gd / good.length - sd / short.length < SLEEP_LINK_MIN_ADVANTAGE) return null
  return {
    headline: 'Los días después de dormir 7 horas o más, cierras en déficit más seguido.',
    good: { deficit: gd, days: good.length },
    short: { deficit: sd, days: short.length },
  }
}
