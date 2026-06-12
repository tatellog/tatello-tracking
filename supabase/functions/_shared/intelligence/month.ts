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
import { deriveDimensions, dimensionsFor } from './dimensions'
import type { DailySignals, DimensionContext, DimensionKey, VozParte } from './types'

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
  // The user's dimension set — sin `ciclo` cuando el gate está cerrado, so
  // the month arc never lists a CICLO row for users who don't have one.
  const dims = dimensionsFor(ctx)

  if (sorted.length === 0) {
    return dims.map((d) => ({
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

  return dims.map((d) => {
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
  /** The real dimension behind this body — drives the per-dimension glow
   *  color in MonthSky (same palette as the month bars). */
  dimensionKey: DimensionKey
  /** Poetic name shown on the satellite — never a number. */
  label: string
  /** The real dimension, revealed on tap (e.g. "tu sueño"). */
  caption: string
  /** A one-sentence reading shown in the tap reveal. */
  detail: string
  tentative: boolean
}

const noun = (d: DimensionMonth): string => d.label.toLowerCase()

/** Build the month's satellites — the named bodies orbiting MonthSky. Up to
 *  four, each a distinct dimension: `tu brillo` (the brightest, a state fact
 *  shown at any confidence), then once a month is logged `tu pausa` (the
 *  quietest), `tu ancla` (the steadiest) and `tu señal naciente` (the one
 *  still moving, named tentatively). A thin month surfaces fewer. */
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
      id: 'shine',
      kind: 'peak',
      dimensionKey: brightest.key,
      label: 'tu brillo',
      caption: `tu ${noun(brightest)}`,
      detail: `Tu ${noun(brightest)} fue lo más brillante del mes.`,
      tentative: false,
    })
    used.add(brightest.key)
  }

  // The remaining three reads need some month behind them. Ciclo is left
  // out of these — at the floor it isn't "in pause" or "moving", it just
  // wasn't a period month; it only earns a body as `brillo` (above) when
  // the period actually made it the brightest.
  const avail = (): DimensionMonth[] => summary.filter((d) => !used.has(d.key) && d.key !== 'ciclo')
  if (daysLogged >= 8) {
    // tu pausa — the quietest dimension that still carries signal: the one
    // most at rest this month.
    const pausa = avail()
      .filter((d) => d.avg >= 0.2)
      .sort((a, b) => a.avg - b.avg)[0]
    if (pausa) {
      out.push({
        id: 'rest',
        kind: 'valley',
        dimensionKey: pausa.key,
        label: 'tu pausa',
        caption: `tu ${noun(pausa)}`,
        detail: `Tu ${noun(pausa)} fue lo más en calma del mes.`,
        tentative: false,
      })
      used.add(pausa.key)
    }

    // tu ancla — the steadiest dimension with real presence: smallest
    // movement, decent level.
    const ancla = avail()
      .filter((d) => d.avg >= 0.4)
      .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0]
    if (ancla) {
      out.push({
        id: 'anchor',
        kind: 'stable',
        dimensionKey: ancla.key,
        label: 'tu ancla',
        caption: `tu ${noun(ancla)}`,
        detail: `Tu ${noun(ancla)} se mantuvo firme todo el mes.`,
        tentative: false,
      })
      used.add(ancla.key)
    }

    // tu señal naciente — a read still taking shape: the remaining dimension
    // that moved the most, named tentatively (a hypothesis Stelar is still
    // forming, never a verdict — and never "watching you"). Closes the chain
    // once a month has been logged.
    const observe = avail().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
    if (observe) {
      const moved = observe.trend !== 'flat'
      out.push({
        id: 'watch',
        kind: 'tentative',
        dimensionKey: observe.key,
        label: 'tu señal naciente',
        caption: `tu ${noun(observe)}`,
        // You are the subject, not Stelar — "Stelar lo va leyendo" reread as
        // surveillance (the very thing the rename fixed). Tentative + no
        // verdict + gender-safe (the noun's gender is dynamic).
        detail: moved
          ? `Algo nace en tu ${noun(observe)}. Todavía sin nombre.`
          : `Tu ${noun(observe)} aún no dice nada claro.`,
        tentative: true,
      })
      used.add(observe.key)
    }
  }

  return out
}
