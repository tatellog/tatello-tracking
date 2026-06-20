import { figureElementCount } from '@/features/tabs/components/constellation/data/derive-progress'
import { ZODIAC, type ZodiacSign } from '@/features/tabs/zodiac'

import { computeDelta, smoothWeightPoints, toWeightPoints, type WeightPoint } from './logic'
import type { BodyMeasurement } from '@/features/brief/api'

/* Datos derivados que alimentan las tarjetas de compartir. Vive acá (no
 * en los componentes) para que el cálculo del % revelado y la próxima
 * estrella sea uno solo, compartido por el flujo de entreno y el de
 * cambio visual — y se mantenga coherente con la constelación dibujada. */

export type ConstellationReveal = {
  /** 0..100 — qué fracción de la figura del signo está encendida. */
  revealedPct: number
  /** "Próxima estrella DÍA X" — null cuando la figura ya está completa. */
  nextStarDay: number | null
  /** Elementos de la figura (estrellas + líneas) — el techo del 100 %. */
  figureCount: number
  /** La figura del asterismo está entera. */
  figureComplete: boolean
}

/**
 * Reveal de la constelación a partir de los días entrenados. El % es
 * relativo a la FIGURA del signo (estrellas + líneas), no a los 28 días:
 * cuando el asterismo se cierra, está "100 % revelado" y lo demás es luz
 * extra. `litCount` es el número de días encendidos (grid_28_days).
 */
export function constellationReveal(sign: ZodiacSign, litCount: number): ConstellationReveal {
  const zod = ZODIAC[sign]
  const figureCount = figureElementCount(zod)
  const litFigure = Math.min(Math.max(0, litCount), figureCount)
  const revealedPct = figureCount > 0 ? Math.round((litFigure / figureCount) * 100) : 0
  const figureComplete = litCount >= figureCount
  // El siguiente elemento se enciende en la posición `litCount` (0-index)
  // de la secuencia; lo presentamos como "DÍA litCount + 1".
  const nextStarDay = figureComplete ? null : litCount + 1
  return { revealedPct, nextStarDay, figureCount, figureComplete }
}

export type WeightSpan = {
  /** Peso inicial (suavizado), 1 decimal. */
  from: number
  /** Peso actual (suavizado), 1 decimal. */
  to: number
  /** Delta con signo: "−0.3" / "+1.2". */
  deltaText: string
}

/**
 * Primer y último peso del rango (media móvil de 7 días, como el resto de
 * Progreso) más el delta con signo. Devuelve null si hay menos de dos
 * pesos — sin datos no se inventa una fila.
 */
export function weightSpan(measurements: BodyMeasurement[] | undefined): WeightSpan | null {
  const points: WeightPoint[] = smoothWeightPoints(toWeightPoints(measurements ?? []))
  const delta = computeDelta(points)
  const first = points[0]
  const last = points[points.length - 1]
  if (!delta || !first || !last) return null
  return {
    from: Number(first.weight.toFixed(1)),
    to: Number(last.weight.toFixed(1)),
    deltaText: formatSignedKg(delta.abs),
  }
}

/** "+1.2" / "−0.3" / "0.0" — el guion largo es el signo menos tipográfico. */
export function formatSignedKg(kg: number): string {
  if (kg === 0) return '0.0'
  return `${kg < 0 ? '−' : '+'}${Math.abs(kg).toFixed(1)}`
}

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

/** "2026-06-19" → "Junio 2026". Acepta YYYY-MM-DD o ISO. */
export function monthLabelFromIso(iso: string): string {
  const month = MONTHS_ES[Number(iso.slice(5, 7)) - 1] ?? ''
  return `${month} ${iso.slice(0, 4)}`.trim()
}
