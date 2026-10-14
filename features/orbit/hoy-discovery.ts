/*
 * El hallazgo en Hoy (ST-007), PURO. Decisión de la dueña (13 oct 2026, con
 * product-benchmark): Hoy lo muestra SOLO mientras es nuevo. Su valor es la
 * sorpresa y la sorpresa se gasta: un hallazgo fijo semanas en Hoy se vuelve
 * fondo. Se va al abrirlo (en Hoy o en Descubre) o tras mostrarse en 3 días
 * distintos; después vive en Descubre, que ya lo pone primero.
 *
 * Forma (dueña 14 oct 2026): UNA fila tocable con ícono y título corto. Hoy
 * solo avisa que hay algo nuevo; la explicación vive en Descubre.
 */
import { comboKcalGap, type ComboOpts } from './combo-facts'
import { comboEvidenceSample, monthPatternLabel, type EvidenceLabel } from './evidence-label'
import { comboPhrase, type WinningCombo } from './month-built'
import type { DailySignals } from './api'
import type { FeaturedDiscovery } from './featured-discovery'

/** Días distintos que Hoy puede mostrar un mismo hallazgo sin abrirse. */
export const HOY_DISCOVERY_MAX_DAYS = 3

/** Lo que Hoy recuerda de cada hallazgo: en qué días lo mostró y si se abrió. */
export type HoyDiscoveryState = Record<string, { days: string[]; opened?: boolean }>

/** ¿Hoy muestra este hallazgo? Nuevo = no abierto y mostrado en menos de 3
 *  días distintos (el día de hoy, si ya se mostró, sigue contando como suyo). */
export function hoyDiscoveryVisible(state: HoyDiscoveryState, id: string, today: string): boolean {
  const entry = state[id]
  if (!entry) return true
  if (entry.opened) return false
  return entry.days.includes(today) || entry.days.length < HOY_DISCOVERY_MAX_DAYS
}

/** Registra que Hoy mostró el hallazgo este día (idempotente). */
export function markHoyDiscoveryShown(
  state: HoyDiscoveryState,
  id: string,
  today: string,
): HoyDiscoveryState {
  const entry = state[id] ?? { days: [] }
  if (entry.days.includes(today)) return state
  return { ...state, [id]: { ...entry, days: [...entry.days, today] } }
}

/** Registra que el hallazgo se abrió (en Hoy o en Descubre). */
export function markHoyDiscoveryOpened(state: HoyDiscoveryState, id: string): HoyDiscoveryState {
  const entry = state[id] ?? { days: [] }
  if (entry.opened) return state
  return { ...state, [id]: { ...entry, opened: true } }
}

export type HoyDiscoveryModel = {
  label: EvidenceLabel
  eyebrow: string
  /** El hallazgo en 4-6 palabras. Hoy solo avisa: los números, la muestra y
   *  la fuente viven en el detalle de Descubre (dueña 14 oct 2026: la gente
   *  casi no lee, Hoy no carga texto). */
  title: string
  /** Para el ícono (el mismo del detalle); null en el combo. */
  lookId: string | null
}

/** Títulos cortos de los patrones de apoyo. Los que faltan ya son cortos y
 *  usan su primera oración. */
const PATTERN_SHORT: Record<string, string> = {
  'sleep-deficit': 'Dormir 7 h o más, más días en déficit',
  'training-protein': 'Días de entreno, más proteína',
  'movement-deficit': 'Días de entreno, más días en déficit',
}

const firstSentence = (t: string) => t.split('. ')[0]!.replace(/\.$/, '')

/** "Tu día fuerte: dormir bien y entrenar" (el combo sin su remate). */
function comboShort(combo: WinningCombo): string {
  const list = comboPhrase(combo).replace(/ coincidieron con tu déficit\.$/, '')
  return `Tu día fuerte: ${list.charAt(0).toLowerCase()}${list.slice(1)}`
}

/** La etiqueta del hallazgo ("patron" / "observacion"), la MISMA regla y
 *  muestra que Descubre. También va en los eventos del recorrido (ST-008). */
export function discoveryLabel(
  featured: FeaturedDiscovery,
  maturityStage: number,
  signals: readonly DailySignals[],
  opts: ComboOpts,
): EvidenceLabel {
  if (featured.kind === 'surprise')
    return monthPatternLabel({ kind: 'pattern', sample: featured.surprise.sample }, maturityStage)
  if (featured.kind === 'combo') {
    const sample = comboEvidenceSample(featured.combo, comboKcalGap(signals, featured.combo, opts))
    return monthPatternLabel({ kind: 'pattern', sample }, maturityStage)
  }
  return monthPatternLabel(featured.pattern, maturityStage)
}

/** Lo que dice la fila, con la MISMA etiqueta que Descubre. */
export function hoyDiscoveryModel(
  featured: FeaturedDiscovery,
  maturityStage: number,
  signals: readonly DailySignals[],
  opts: ComboOpts,
): HoyDiscoveryModel {
  const label = discoveryLabel(featured, maturityStage, signals, opts)
  const eyebrow = label === 'patron' ? 'Nuevo patrón' : 'Nueva observación'
  if (featured.kind === 'surprise')
    return { label, eyebrow, title: featured.surprise.short, lookId: featured.surprise.id }
  if (featured.kind === 'combo')
    return { label, eyebrow, title: comboShort(featured.combo), lookId: null }
  const p = featured.pattern
  return { label, eyebrow, title: PATTERN_SHORT[p.id] ?? firstSentence(p.title), lookId: p.id }
}
