import type { WeekDimKey } from './week-orbit-logic'

/*
 * One-shot deep-link into a SPECIFIC star of the Órbita · Semana galaxy.
 * Hermano de pending-segment.ts: ese elige el segmento (Día/Semana/Mes), este
 * elige qué dimensión queda enfocada al llegar. Lo usa el CTA "Verlo en mi
 * órbita" de una revelación de patrón: la ceremonia habla de UN hábito ("el
 * movimiento estuvo ahí 5 de 7 días"), así que al aterrizar en Semana
 * pre-enfocamos esa estrella y se muestra su readout (los días reales) — la
 * evidencia exacta, no la galaxia genérica.
 *
 * Se limpia al leer para que no se re-dispare en una visita normal a Órbita.
 */
let pending: WeekDimKey | null = null

export function requestWeekFocus(dim: WeekDimKey): void {
  pending = dim
}

export function consumeWeekFocus(): WeekDimKey | null {
  const p = pending
  pending = null
  return p
}
