/*
 * Deterministic Mes engine — "El Cielo". Reads ~30 days of real
 * `daily_signals` and turns them into the MONTH ARC: how each of the six
 * dimensions moved (its month level + its trend), a one-word theme for
 * the header, and a written month reading. NO AI, no menstrual-cycle
 * framing — the cycle is just one more signal that feeds the `ciclo`
 * dimension; it never becomes the subject (docs/tu-orbita-design.md §7).
 *
 * Mirrors the shape of week-logic.ts so MonthSegment can swap mock → real
 * the same way the Semana did.
 */
import type { DailySignals } from './api'
import { deriveDimensions, DIMENSIONS, type DimensionContext, type DimensionKey } from './logic'
import type { VozParte } from './mock'

/** A trend needs at least this much half-over-half change to be named. */
const TREND_GAP = 0.08

/** The dim floor a day with no signal sits at (mirrors logic.ts). */
const FLOOR = deriveDimensions(null)[0]!.brightness

/** One dimension's month: its average level and which way it moved. */
export type DimensionMonth = {
  key: DimensionKey
  label: string
  /** Mean brightness across the month's logged days. */
  avg: number
  /** Second-half minus first-half average. */
  delta: number
  trend: 'up' | 'down' | 'flat'
}

function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : FLOOR
}

/** For each of the six dimensions, its month average + half-over-half
 *  trend, computed from the logged days only (unlogged days aren't rows,
 *  so they don't drag the average to the floor). */
export function buildMonthSummary(
  signals: readonly DailySignals[],
  ctx?: DimensionContext,
): DimensionMonth[] {
  const sorted = [...signals].filter((s) => s.day).sort((a, b) => (a.day! < b.day! ? -1 : 1))

  if (sorted.length === 0) {
    return DIMENSIONS.map((d) => ({
      key: d.key,
      label: d.label,
      avg: FLOOR,
      delta: 0,
      trend: 'flat',
    }))
  }

  // Per-day brightness for every dimension, computed once.
  const perDay = sorted.map((s) => {
    const m = new Map<DimensionKey, number>()
    for (const dim of deriveDimensions(s, ctx)) m.set(dim.key, dim.brightness)
    return m
  })
  const mid = Math.floor(perDay.length / 2)

  return DIMENSIONS.map((d) => {
    const series = perDay.map((m) => m.get(d.key) ?? FLOOR)
    const delta = mean(series.slice(mid)) - mean(series.slice(0, mid))
    const trend: DimensionMonth['trend'] =
      delta > TREND_GAP ? 'up' : delta < -TREND_GAP ? 'down' : 'flat'
    return { key: d.key, label: d.label, avg: mean(series), delta, trend }
  })
}

/** How many days of the month carried any signal. */
export function monthDaysLogged(signals: readonly DailySignals[]): number {
  return signals.filter((s) => s.day).length
}

/** A one-word theme for the header, from the overall shape of the month.
 *  Honest about the "still forming" state when there's barely any data. */
export function monthTheme(summary: readonly DimensionMonth[], daysLogged: number): string {
  if (daysLogged < 4) return 'formación'
  const ups = summary.filter((d) => d.trend === 'up').length
  const downs = summary.filter((d) => d.trend === 'down').length
  if (ups - downs >= 2) return 'ascenso'
  if (downs - ups >= 2) return 'descenso'
  return 'movimiento'
}

// Warm, consistent gerunds — "aflojando" (never "cayendo", which reads as
// decline/alarm) matches the month theme's own word.
const TREND_WORD: Record<'up' | 'down', string> = {
  up: 'creciendo',
  down: 'aflojando',
}

/** The written month reading — opener by theme, the brightest dimension,
 *  and the single clearest movement. Driven entirely by the numbers. */
export function buildVozMes(
  summary: readonly DimensionMonth[],
  daysLogged: number,
): {
  parts: readonly VozParte[]
  signature: { confidence: 'alta' | 'media' | 'baja'; scope: string }
} {
  const theme = monthTheme(summary, daysLogged)
  const parts: VozParte[] = []

  if (theme === 'formación') {
    parts.push({ text: 'El mes apenas ' }, { text: 'se forma', tone: 'accent' }, { text: '. ' })
  } else if (theme === 'ascenso') {
    parts.push({ text: 'Tu mes viene en ' }, { text: 'ascenso', tone: 'accent' }, { text: '. ' })
  } else if (theme === 'descenso') {
    parts.push({ text: 'Tu mes viene ' }, { text: 'aflojando', tone: 'accent' }, { text: '. ' })
  } else {
    parts.push({ text: 'Tu mes se mueve, ' }, { text: 'parejo', tone: 'accent' }, { text: '. ' })
  }

  // Brightest dimension of the month.
  const brightest = [...summary].sort((a, b) => b.avg - a.avg)[0]
  if (brightest && brightest.avg >= 0.5) {
    parts.push({ text: 'Lo más en luz: ' })
    parts.push({ text: brightest.label.toLowerCase(), tone: 'accent' })
    parts.push({ text: '. ' })
  }

  // The clearest single movement (largest |delta| that isn't flat).
  const moved = [...summary]
    .filter((d) => d.trend !== 'flat')
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] as
    | (DimensionMonth & { trend: 'up' | 'down' })
    | undefined
  if (moved) {
    parts.push({ text: 'Tu ' })
    parts.push({ text: moved.label.toLowerCase(), tone: 'accent' })
    parts.push({ text: ` viene ${TREND_WORD[moved.trend]}.` })
  }

  const confidence: 'alta' | 'media' | 'baja' =
    daysLogged >= 18 ? 'alta' : daysLogged >= 8 ? 'media' : 'baja'
  return {
    parts,
    signature: {
      confidence,
      scope: `${daysLogged} ${daysLogged === 1 ? 'día leído' : 'días leídos'}`,
    },
  }
}

// ── The month's satellites — the editorial headline over the bars ───
// 0–4 named bodies orbiting the hero, each derived from real month data
// with an honesty guard so we never invent one. All labels are
// AFFIRMATIVE (no "peak/valley" polarity that reads as good/bad). The
// `kind` drives the existing visual treatment in MonthSky.

export type MonthSatelliteKind = 'peak' | 'valley' | 'stable' | 'tentative' | 'rising'

export type MonthSatellite = {
  id: string
  kind: MonthSatelliteKind
  /** Poetic name shown on the satellite — never a number. */
  label: string
  /** The real dimension, revealed on tap (e.g. "tu sueño"). */
  caption: string
  /** A one-sentence reading shown in the tap reveal. */
  detail: string
  tentative: boolean
}

const noun = (d: DimensionMonth): string => d.label.toLowerCase()

/** Build the month's satellites from the summary. Confidence-gated: a
 *  TREND read is confirmed ("tu calma") only with a full month; below
 *  that it appears as a humble "stelar observa". The brightest dimension
 *  is a current-state fact, so it shows at any confidence. */
export function buildMonthSatellites(
  summary: readonly DimensionMonth[],
  daysLogged: number,
): MonthSatellite[] {
  const out: MonthSatellite[] = []
  const used = new Set<DimensionKey>()

  // tu brillo — the most-lit dimension (a state fact, any confidence).
  const brightest = [...summary].sort((a, b) => b.avg - a.avg)[0]
  if (brightest && brightest.avg >= 0.5) {
    out.push({
      id: 'brillo',
      kind: 'peak',
      label: 'tu brillo',
      caption: `tu ${noun(brightest)}`,
      detail: `Tu ${noun(brightest)} fue lo más en luz del mes.`,
      tentative: false,
    })
    used.add(brightest.key)
  }

  // tu ancla — a high, steady dimension (needs some month to claim).
  if (daysLogged >= 8) {
    const stable = summary
      .filter((d) => !used.has(d.key) && d.trend === 'flat' && d.avg >= 0.45)
      .sort((a, b) => b.avg - a.avg)[0]
    if (stable) {
      out.push({
        id: 'ancla',
        kind: 'stable',
        label: 'tu ancla',
        caption: `tu ${noun(stable)}`,
        detail: `Tu ${noun(stable)} se mantuvo firme todo el mes.`,
        tentative: false,
      })
      used.add(stable.key)
    }
  }

  // The trend reads — confirmed with a full month, tentative below it.
  // With confidence, surface BOTH the strongest rise ("tu impulso", the
  // good pattern) AND the strongest fall ("tu calma", the rough one), so
  // the month shows what's gaining and what's easing — not just one side.
  if (daysLogged >= 18) {
    const up = summary
      .filter((d) => !used.has(d.key) && d.trend === 'up')
      .sort((a, b) => b.delta - a.delta)[0]
    if (up) {
      out.push({
        id: 'impulso',
        kind: 'rising',
        label: 'tu impulso',
        caption: `tu ${noun(up)}`,
        detail: `Tu ${noun(up)} viene creciendo este mes. Va ganando fuerza.`,
        tentative: false,
      })
      used.add(up.key)
    }
    const down = summary
      .filter((d) => !used.has(d.key) && d.trend === 'down')
      .sort((a, b) => a.delta - b.delta)[0]
    if (down) {
      out.push({
        id: 'calma',
        kind: 'valley',
        label: 'tu calma',
        caption: `tu ${noun(down)}`,
        detail: `Tu ${noun(down)} vino aflojando este mes. Un repliegue, nada más.`,
        tentative: false,
      })
    }
  } else {
    const moved = summary
      .filter((d) => !used.has(d.key) && d.trend !== 'flat')
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
    if (moved) {
      out.push({
        id: 'observa',
        kind: 'tentative',
        label: 'stelar observa',
        caption: `tu ${noun(moved)}`,
        detail: `Algo se mueve en tu ${noun(moved)}. Todavía es pronto para decir hacia dónde.`,
        tentative: true,
      })
    }
  }

  return out
}
