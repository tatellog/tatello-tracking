/*
 * El hallazgo en Hoy (ST-007), PURO. Decisión de la dueña (13 oct 2026, con
 * product-benchmark): Hoy lo muestra SOLO mientras es nuevo. Su valor es la
 * sorpresa y la sorpresa se gasta: un hallazgo fijo semanas en Hoy se vuelve
 * fondo. Se va al abrirlo (en Hoy o en Descubre) o tras mostrarse en 3 días
 * distintos; después vive en Descubre, que ya lo pone primero.
 *
 * Forma (revisión UX): una franja, no una tarjeta ("Tu día" sigue siendo la
 * única tarjeta de lectura), en la paleta de Hoy, con los números en texto.
 */
import { comboKcalGap, fmtKcalDelta, type ComboOpts } from './combo-facts'
import {
  comboEvidenceSample,
  monthPatternLabel,
  patternSourceLine,
  type EvidenceLabel,
  type PatternSample,
} from './evidence-label'
import { comboPhrase } from './month-built'
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
  title: string
  numbers: string | null
  evidence: string
}

function evidenceLine(sample: PatternSample | undefined, source: string): string {
  const total = sample ? (sample.total ?? sample.groups.reduce((a, g) => a + g.days, 0)) : null
  return [total ? `${total} días comparados` : null, source.toLowerCase()]
    .filter(Boolean)
    .join(' · ')
}

const pair = (label: string, hits: number, total: number) => `${label}: ${hits} de ${total}`

/**
 * Lo que dice la franja, con la MISMA etiqueta y muestra que Descubre. Los
 * números van en texto (en Hoy el único anillo es el del emblema).
 */
export function hoyDiscoveryModel(
  featured: FeaturedDiscovery,
  maturityStage: number,
  signals: readonly DailySignals[],
  opts: ComboOpts,
): HoyDiscoveryModel {
  const eyebrowOf = (label: EvidenceLabel) =>
    label === 'patron' ? 'Nuevo patrón encontrado' : 'Nueva observación'

  if (featured.kind === 'surprise') {
    const s = featured.surprise
    const label = monthPatternLabel({ kind: 'pattern', sample: s.sample }, maturityStage)
    const c = s.compare
    const strong = s.rows.find((r) => r.strong) ?? s.rows[0]
    const other = s.rows.find((r) => r !== strong)
    return {
      label,
      eyebrow: eyebrowOf(label),
      title: s.headline,
      numbers: c
        ? `${pair(c.strong.label, c.strong.hits, c.strong.total)} · ${pair(c.other.label, c.other.hits, c.other.total)}`
        : strong && other
          ? `${strong.label}: ${strong.value} · ${other.label}: ${other.value}`
          : null,
      evidence: evidenceLine(s.sample, patternSourceLine(s.id, signals)),
    }
  }

  if (featured.kind === 'combo') {
    const combo = featured.combo
    const gap = comboKcalGap(signals, combo, opts)
    const sample = comboEvidenceSample(combo, gap)
    const label = monthPatternLabel({ kind: 'pattern', sample }, maturityStage)
    const keys = combo.signals.map((x) => x.key)
    const source = keys.includes('sueno')
      ? patternSourceLine('sleep-deficit', signals)
      : keys.includes('cuerpo')
        ? patternSourceLine('movement-deficit', signals)
        : 'Con tus registros'
    return {
      label,
      eyebrow: eyebrowOf(label),
      title: comboPhrase(combo),
      numbers: gap
        ? `${fmtKcalDelta(gap.withAvg - gap.restAvg)} por día, contra tus otros días`
        : `${pair('Con el patrón', combo.deficits, combo.occurrences)} · ${pair('Otros días', combo.restDeficits, combo.restDays)}`,
      evidence: evidenceLine(sample, source),
    }
  }

  const p = featured.pattern
  const label = monthPatternLabel(p, maturityStage)
  const hi = p.evidence.bars.find((b) => b.highlight) ?? p.evidence.bars[0]
  const other = p.evidence.bars.find((b) => b !== hi)
  const rated = hi?.total != null && other?.total != null
  return {
    label,
    eyebrow: eyebrowOf(label),
    title: p.title,
    numbers: rated
      ? `${pair(hi!.label, hi!.value, hi!.total!)} · ${pair(other!.label, other!.value, other!.total!)}`
      : null,
    evidence: evidenceLine(p.sample, patternSourceLine(p.id, signals)),
  }
}
