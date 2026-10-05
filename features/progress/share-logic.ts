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

/* ── Tarjetas nuevas (rediseño dueña 5 oct 2026) ─────────────────────── */

/**
 * El tiempo del proceso como héroe de la tarjeta de cambio visual: "23
 * meses", "3 semanas", "12 días", "2 años". El valor y la unidad por
 * separado (el número va gigante y la unidad en serif).
 */
export function processDuration(fromIso: string, toIso: string): { value: string; unit: string } {
  const [fy, fm, fd] = fromIso.slice(0, 10).split('-').map(Number) as [number, number, number]
  const [ty, tm, td] = toIso.slice(0, 10).split('-').map(Number) as [number, number, number]
  const days = Math.max(
    0,
    Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000),
  )
  if (days < 14) return { value: String(days), unit: days === 1 ? 'día' : 'días' }
  let months = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0)
  if (months < 2) {
    const weeks = Math.floor(days / 7)
    return { value: String(weeks), unit: 'semanas' }
  }
  if (months >= 24 && months % 12 === 0) {
    const years = months / 12
    return { value: String(years), unit: 'años' }
  }
  months = Math.max(2, months)
  return { value: String(months), unit: 'meses' }
}

/** Entrenos por mes (YYYY-MM) de `fromIso` a `toIso`, inclusive, en orden.
 *  Los meses sin entreno van en 0 (la barra baja también es historia). */
export function trainedByMonth(
  trainedDates: readonly string[],
  fromIso: string,
  toIso: string,
): { month: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const d of trainedDates) {
    if (d < fromIso.slice(0, 10) || d > toIso.slice(0, 10)) continue
    const k = d.slice(0, 7)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const out: { month: string; count: number }[] = []
  let [y, m] = fromIso.split('-').map(Number) as [number, number]
  const end = toIso.slice(0, 7)
  for (let guard = 0; guard < 600; guard++) {
    const k = `${y}-${String(m).padStart(2, '0')}`
    out.push({ month: k, count: counts.get(k) ?? 0 })
    if (k >= end) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/** Celda de un día del mes en la rejilla L-D: columna (0..6) y fila (0..5). */
export function monthCellPosition(monthIso: string, day: number): { col: number; row: number } {
  const [y, m] = monthIso.split('-').map(Number) as [number, number]
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const idx = lead + day - 1
  return { col: idx % 7, row: Math.floor(idx / 7) }
}
