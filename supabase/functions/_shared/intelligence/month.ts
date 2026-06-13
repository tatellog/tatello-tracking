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
import type { DailySignals, DimensionContext, DimensionKey, EnLuz, VozParte } from './types'

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

/* ── Evidencia acumulada (PRD Mes §Evidencia) ────────────────────────
 * SOLO datos contables del mes — "18 entrenamientos", no "% de brillo".
 * El conteo absoluto es la prueba tangible de "esto lo construí yo"; un
 * promedio de brillo se leería como score/meta (prohibido). */
export type MonthEvidence = {
  entrenos: number
  comidas: number
  sleepAvgMin: number | null
  waterAvg: number | null
  daysLogged: number
}

export function buildMonthEvidence(signals: readonly DailySignals[]): MonthEvidence {
  let entrenos = 0
  let comidas = 0
  let sleepSum = 0
  let sleepN = 0
  let waterSum = 0
  let waterN = 0
  let daysLogged = 0
  for (const s of signals) {
    if (!s.day) continue
    daysLogged += 1
    if (s.trained) entrenos += 1
    if (s.meal_count) comidas += s.meal_count
    if (s.sleep_minutes != null) {
      sleepSum += s.sleep_minutes
      sleepN += 1
    }
    if (s.water_glasses != null) {
      waterSum += s.water_glasses
      waterN += 1
    }
  }
  return {
    entrenos,
    comidas,
    sleepAvgMin: sleepN ? Math.round(sleepSum / sleepN) : null,
    waterAvg: waterN ? Math.round((waterSum / waterN) * 10) / 10 : null,
    daysLogged,
  }
}

/* ── En Luz del Mes (PRD) — el comportamiento más consistente en 30 días ─
 * Cuenta por PRESENCIA (consistencia), no por calidad. Umbral 8 días: a
 * un mes, 8 días con la misma señal ya es constancia (Semana usa 3 de 7). */
const EN_LUZ_MES_MIN = 8

type MonthBehavior = {
  key: DimensionKey
  label: string
  unit: string
  priority: number
  count: number
}

function monthBehaviorCounts(
  signals: readonly DailySignals[],
  ctx?: DimensionContext,
): MonthBehavior[] {
  const protTarget = ctx?.proteinTarget ?? null
  const count = (fn: (s: DailySignals) => boolean): number =>
    signals.filter((s) => s.day != null && fn(s)).length
  const list: MonthBehavior[] = [
    {
      key: 'cuerpo',
      label: 'Movimiento',
      unit: 'registrados',
      priority: 3,
      count: count((s) => s.trained === true),
    },
    ...(protTarget != null
      ? [
          {
            key: 'alimento' as DimensionKey,
            label: 'Proteína',
            unit: 'alcanzada',
            priority: 3,
            count: count((s) => s.protein_g != null && s.protein_g >= protTarget),
          },
        ]
      : []),
    {
      key: 'sueno',
      label: 'Sueño',
      unit: 'registrados',
      priority: 2,
      count: count((s) => s.sleep_minutes != null),
    },
    {
      key: 'energia',
      label: 'Energía',
      unit: 'registrados',
      priority: 1,
      count: count((s) => s.energy != null),
    },
    {
      key: 'alimento',
      label: 'Comida',
      unit: 'registrados',
      priority: 1,
      count: count((s) => (s.meal_count ?? 0) > 0),
    },
  ]
  return list.sort((a, b) => b.count - a.count || b.priority - a.priority)
}

export function buildEnLuzMes(
  signals: readonly DailySignals[],
  ctx?: DimensionContext,
): EnLuz | null {
  const top = monthBehaviorCounts(signals, ctx)[0]
  if (!top || top.count < EN_LUZ_MES_MIN) return null
  return { key: top.key, label: top.label, days: [], count: top.count, unit: top.unit }
}

/** La frase principal de la Voz — la consistencia más fuerte, factual. */
function vozMesLead(b: MonthBehavior): VozParte[] {
  switch (b.label) {
    case 'Movimiento':
      return [
        { text: 'El movimiento apareció en ' },
        { text: `${b.count} días`, tone: 'accent' },
        { text: ' del mes.' },
      ]
    case 'Proteína':
      return [
        { text: 'La proteína se alcanzó ' },
        { text: `${b.count} días`, tone: 'accent' },
        { text: '.' },
      ]
    case 'Sueño':
      return [
        { text: 'Tu sueño se registró ' },
        { text: `${b.count} días`, tone: 'accent' },
        { text: '.' },
      ]
    case 'Energía':
      return [
        { text: 'Registraste tu energía ' },
        { text: `${b.count} días`, tone: 'accent' },
        { text: '.' },
      ]
    default:
      return [
        { text: 'Registraste comida ' },
        { text: `${b.count} días`, tone: 'accent' },
        { text: '.' },
      ]
  }
}

/** Voz de Mes (PRD V1) — narrativa de EVIDENCIA acumulada. Describe
 *  CONSISTENCIA (cuántos días apareció cada comportamiento), nunca
 *  tendencia ("ascenso/aflojando") ni causa ("porque/cuando/mejora por").
 *  Lidera con lo más constante + una segunda señal constante si la hay. */
export function buildVozMes(
  signals: readonly DailySignals[],
  ctx: DimensionContext | undefined,
  daysLogged: number,
): {
  parts: readonly VozParte[]
  signature: { confidence: 'alta' | 'media' | 'baja'; scope: string }
} {
  const confidence: 'alta' | 'media' | 'baja' =
    daysLogged >= 18 ? 'alta' : daysLogged >= 8 ? 'media' : 'baja'
  const signature = {
    confidence,
    scope: `${daysLogged} ${daysLogged === 1 ? 'día leído' : 'días leídos'}`,
  }

  const consistent = monthBehaviorCounts(signals, ctx).filter((b) => b.count >= EN_LUZ_MES_MIN)
  if (consistent.length === 0) {
    return {
      parts: [
        { text: 'El mes apenas ' },
        { text: 'se forma', tone: 'accent' },
        { text: '. Aún no hay suficiente para ver constancia.' },
      ],
      signature,
    }
  }

  const parts: VozParte[] = [...vozMesLead(consistent[0]!)]
  if (consistent[1]) {
    parts.push(
      { text: ' También ' },
      { text: consistent[1]!.label.toLowerCase(), tone: 'accent' },
      { text: ` apareció ${consistent[1]!.count} días.` },
    )
  }
  return { parts, signature }
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
