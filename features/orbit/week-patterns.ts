/*
 * Deterministic pattern detection for the Semana segment — NO AI. Cross-
 * references ~5 weeks of `daily_signals` to surface the same kinds of
 * patterns the mock showed: a weekday that consistently dips or shines,
 * and a trained↔sleep correlation. Returns real `Patron`s (the exact
 * shape PatternCard + the detail screen already render). When there isn't
 * enough history to be honest, returns [] and the UI falls back to mock.
 *
 * The prose fields stay short and factual — the rich coach voice is the
 * AI engine's job; here we only state what the numbers show.
 */
import type { DailySignals } from './api'
import { deriveDimensions, type DimensionContext } from './logic'
import type { PairedData, Patron, WeekdayData } from './mock'
import { dayBrightness } from './week-logic'

/** Minimum samples of a weekday before we'll claim a recurrence. */
const MIN_WEEKDAY_SAMPLES = 3
/** Brightness gap (vs the personal average) a weekday must clear. */
const WEEKDAY_GAP = 0.12
/** Minimum samples per side for the trained↔sleep comparison. */
const MIN_PAIR_SAMPLES = 3
/** Sleep-minutes gap that makes the trained↔sleep link worth naming. */
const SLEEP_GAP_MIN = 25

const MON_NAMES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const

/** Monday-first weekday index (0=L … 6=D) of a 'YYYY-MM-DD' string. */
function monIdx(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
}
function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}
function dayB(s: DailySignals, ctx?: DimensionContext): number {
  return dayBrightness(deriveDimensions(s, ctx))
}
function plural(monName: string): string {
  // Spanish weekdays are invariant in the plural except weekend days.
  return monName === 'sábado' || monName === 'domingo' ? `${monName}s` : monName
}

type Confidence = 'alta' | 'media' | 'baja'
function confidenceFor(n: number): Confidence {
  return n >= 4 ? 'alta' : n >= 3 ? 'media' : 'baja'
}

/** Group history rows by Monday-first weekday → their day-brightnesses. */
function brightnessByWeekday(history: readonly DailySignals[], ctx?: DimensionContext): number[][] {
  const byWd: number[][] = Array.from({ length: 7 }, () => [])
  for (const s of history) {
    if (s.day) byWd[monIdx(s.day)]!.push(dayB(s, ctx))
  }
  return byWd
}

/** A representative week profile (per-weekday average, gaps filled with
 *  the overall mean) for the card glyph + a few recent weeks for the
 *  detail proof. */
function buildWeekdayVisual(
  history: readonly DailySignals[],
  byWd: number[][],
  overall: number,
  ctx?: DimensionContext,
): Pick<WeekdayData, 'week' | 'weeks'> {
  const week = byWd.map((arr) => (arr.length ? mean(arr) : overall))

  // Group rows into Monday-start weeks, newest last.
  const weeksMap = new Map<string, number[]>()
  for (const s of history) {
    if (!s.day) continue
    const d = new Date(`${s.day}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - monIdx(s.day))
    const key = d.toISOString().slice(0, 10)
    if (!weeksMap.has(key)) weeksMap.set(key, Array(7).fill(overall))
    weeksMap.get(key)![monIdx(s.day)] = dayB(s, ctx)
  }
  const weeks = [...weeksMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-4)
    .map(([, bars], i) => ({ label: `sem ${i + 1}`, bars }))

  return { week, weeks }
}

/** The strongest weekday dip OR peak, if either clears the gap. At most
 *  one of each (a low and a high) so the list never floods. */
function detectWeekdayPatterns(history: readonly DailySignals[], ctx?: DimensionContext): Patron[] {
  const byWd = brightnessByWeekday(history, ctx)
  const overall = mean(history.map((s) => dayB(s, ctx)))
  const eligible = byWd
    .map((arr, i) => ({ i, n: arr.length, avg: mean(arr) }))
    .filter((w) => w.n >= MIN_WEEKDAY_SAMPLES)
  if (eligible.length < 2) return []

  const out: Patron[] = []
  const visual = buildWeekdayVisual(history, byWd, overall, ctx)

  const low = eligible.reduce((m, w) => (w.avg < m.avg ? w : m), eligible[0]!)
  if (overall - low.avg >= WEEKDAY_GAP) {
    const name = MON_NAMES[low.i]!
    const pct = Math.round(((overall - low.avg) / overall) * 100)
    out.push({
      id: `weekday-low-${low.i}`,
      category: 'recurrencia',
      title: `¿Los ${plural(name)} pesan más?`,
      emphasis: plural(name),
      detail: `Lo vimos en ${low.n} de tus ${plural(name)}.`,
      data: { kind: 'weekday', focus: low.i, ...visual },
      since: `Detectado en tus últimos ${low.n} ${plural(name)}`,
      confidence: confidenceFor(low.n),
      caption: `Tus últimos ${low.n} ${plural(name)}.`,
      legend: `Tu ${name} suele ir por debajo de tu promedio. Cerca de un ${pct}% menos.`,
      voz: `El ${name} baja una y otra vez. Hay un ritmo tuyo ahí.`,
      correlacion: `Es tu día más bajo de la semana.`,
      experimento: {
        hint: `Reserva el ${name} para lo que pesa menos. Es cuando llegas con menos.`,
        action: `Cuidar mis ${plural(name)}`,
      },
    })
  }

  const high = eligible.reduce((m, w) => (w.avg > m.avg ? w : m), eligible[0]!)
  if (high.i !== low.i && high.avg - overall >= WEEKDAY_GAP) {
    const name = MON_NAMES[high.i]!
    const pct = Math.round(((high.avg - overall) / overall) * 100)
    out.push({
      id: `weekday-high-${high.i}`,
      category: 'comparacion',
      title: `¿Tus ${plural(name)} brillan?`,
      emphasis: plural(name),
      detail: `Lo vimos en ${high.n} de tus ${plural(name)}.`,
      data: { kind: 'weekday', focus: high.i, ...visual },
      since: `Detectado en tus últimos ${high.n} ${plural(name)}`,
      confidence: confidenceFor(high.n),
      caption: `Tus últimos ${high.n} ${plural(name)}.`,
      legend: `Tu ${name} suele ir por encima de tu promedio. Cerca de un ${pct}% más.`,
      voz: `El ${name} es tu día más en luz. Hay algo ahí que te deja llegar con más.`,
      correlacion: `Es tu día más alto de la semana.`,
      experimento: {
        hint: `Agenda para los ${plural(name)} lo que más te cuesta. Es cuando llegas con más.`,
        action: `Proteger mis ${plural(name)}`,
      },
    })
  }

  return out
}

/** Trained days vs not, compared by sleep — the classic "duermes mejor si
 *  entrenas" link, only when both sides have enough days and the gap is
 *  real. */
function detectTrainSleep(history: readonly DailySignals[]): Patron[] {
  const trained: number[] = []
  const rest: number[] = []
  for (const s of history) {
    if (s.sleep_minutes == null) continue
    ;(s.trained ? trained : rest).push(s.sleep_minutes)
  }
  if (trained.length < MIN_PAIR_SAMPLES || rest.length < MIN_PAIR_SAMPLES) return []

  const trainedAvg = mean(trained)
  const restAvg = mean(rest)
  if (trainedAvg - restAvg < SLEEP_GAP_MIN) return []

  const diffMin = Math.round(trainedAvg - restAvg)
  const groups: PairedData['groups'] = [
    { label: 'Entrené', avg: +(trainedAvg / 60).toFixed(1), unit: 'h' },
    { label: 'No entrené', avg: +(restAvg / 60).toFixed(1), unit: 'h' },
  ]
  return [
    {
      id: 'train-sleep',
      category: 'correlacion',
      title: '¿Duermes mejor si entrenas?',
      emphasis: 'entrenas',
      detail: `Lo vimos en ${trained.length} días con entreno.`,
      data: { kind: 'paired', groups },
      since: `Detectado en tus últimos ${trained.length + rest.length} días`,
      confidence: confidenceFor(Math.min(trained.length, rest.length)),
      caption: 'Tus noches, con y sin entreno.',
      legend: `Los días que entrenas duermes unos ${diffMin} min más.`,
      voz: 'El cuerpo que se movió pide descanso y lo toma. Los días que entrenas, la noche llega más profunda.',
      correlacion: `Tu sueño sube unos ${diffMin} minutos los días que entrenas.`,
      experimento: {
        hint: 'Cuando sientas el sueño pesado, mira si entrenaste. Suele ir de la mano.',
        action: 'Mirar sueño y entreno',
      },
    },
  ]
}

/** All week-readable patterns from the rolling history. Empty when the
 *  history is too thin to claim anything — the caller falls back to the
 *  mock examples. */
export function detectWeekPatterns(
  history: readonly DailySignals[],
  ctx?: DimensionContext,
): Patron[] {
  if (history.length < 7) return []
  return [...detectWeekdayPatterns(history, ctx), ...detectTrainSleep(history)]
}
