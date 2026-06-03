/*
 * Weekly HABIT detectors for the Semana segment — beyond the brightness
 * weekday-low/high in week-patterns.ts. Deterministic, no AI. Each reads
 * a specific signal (tension, weekend food, sleep) and, if it recurs,
 * returns a real `Patron` the PatternCard + detail screen already render.
 *
 * Voice rules (features/patterns/CLAUDE.md): subject is the pattern, not
 * the user; no clinical words; no guilt; no imperatives; no count in the
 * headline. Calories appear only as paired CONTEXT, never a verdict.
 */
import type { DailySignals } from './types'
import type { PairedData, Patron, WeekdayData } from './types'

const MON_NAMES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const

const MIN_SAMPLES = 3
/** Stress (1–5) a weekday must clear over the personal average to name it. */
const STRESS_GAP = 1.0
/** Weekend kcal must clear this over the weekday average. */
const WEEKEND_KCAL_GAP = 500
/** Sleep-minutes a weekday must fall under the average to name it. */
const SLEEP_GAP_MIN = 40
/*
 * Severe ceilings — pervasive, sustained versions of each habit aren't a
 * "one day stands out" pattern; they're the manifiesto's red-line case
 * (NOT cheerful coaching; the referral flow is pre-launch TODO, see
 * features/patterns/logic.ts). Above these we SUPPRESS the card.
 */
const SEVERE_STRESS_AVG = 4.0 // most days near-maxed = pervasive tension
const SEVERE_WEEKEND_KCAL = 3500 // a very high, sustained weekend intake
const SEVERE_SLEEP_MIN = 300 // chronic short sleep (<5h) across the week

function monIdx(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
}
function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}
function plural(name: string): string {
  return name === 'sábado' || name === 'domingo' ? `${name}s` : name
}
function confidenceFor(n: number): 'alta' | 'media' | 'baja' {
  return n >= 4 ? 'alta' : n >= 3 ? 'media' : 'baja'
}

/** Build the weekday glyph + recent-weeks proof from a 0..1 metric. */
function weekdayVisual(
  history: readonly DailySignals[],
  focus: number,
  valueOf01: (s: DailySignals) => number | null,
): WeekdayData {
  const byWd: number[][] = Array.from({ length: 7 }, () => [])
  for (const s of history) {
    if (!s.day) continue
    const v = valueOf01(s)
    if (v != null) byWd[monIdx(s.day)]!.push(v)
  }
  const overall = mean(byWd.flat())
  const week = byWd.map((arr) => (arr.length ? mean(arr) : overall))

  const weeksMap = new Map<string, number[]>()
  for (const s of history) {
    if (!s.day) continue
    const v = valueOf01(s)
    if (v == null) continue
    const d = new Date(`${s.day}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - monIdx(s.day))
    const key = d.toISOString().slice(0, 10)
    if (!weeksMap.has(key)) weeksMap.set(key, Array(7).fill(overall))
    weeksMap.get(key)![monIdx(s.day)] = v
  }
  const weeks = [...weeksMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-4)
    .map(([, bars], i) => ({ label: `sem ${i + 1}`, bars }))

  return { kind: 'weekday', focus, week, weeks }
}

/** Per-weekday samples of a numeric field (skips null). */
function byWeekdayField(
  history: readonly DailySignals[],
  field: (s: DailySignals) => number | null,
): { i: number; n: number; avg: number }[] {
  const byWd: number[][] = Array.from({ length: 7 }, () => [])
  for (const s of history) {
    if (!s.day) continue
    const v = field(s)
    if (v != null) byWd[monIdx(s.day)]!.push(v)
  }
  return byWd.map((arr, i) => ({ i, n: arr.length, avg: mean(arr) }))
}

/* ── 1 · weekday tension — a day that lands heavier (high stress) ──── */
function detectWeekdayTension(history: readonly DailySignals[]): Patron | null {
  const stress = byWeekdayField(history, (s) => s.stress ?? null)
  const eligible = stress.filter((w) => w.n >= MIN_SAMPLES)
  if (eligible.length < 2) return null
  const overall = mean(eligible.flatMap((w) => Array(w.n).fill(w.avg)))
  const peak = eligible.reduce((m, w) => (w.avg > m.avg ? w : m), eligible[0]!)
  if (peak.avg - overall < STRESS_GAP) return null
  if (overall >= SEVERE_STRESS_AVG) return null // pervasive → suppress

  const name = MON_NAMES[peak.i]!
  return {
    id: `weekday-tension-${peak.i}`,
    category: 'recurrencia',
    title: `¿Los ${plural(name)} pesan distinto?`,
    emphasis: plural(name),
    detail: 'Vuelve en tu ritmo.',
    data: weekdayVisual(history, peak.i, (s) => (s.stress != null ? s.stress / 5 : null)),
    since: 'Se repite en tu ritmo.',
    confidence: confidenceFor(peak.n),
    caption: `Tus ${plural(name)}, semana a semana.`,
    legend: `Los ${plural(name)} llegan más cargados que el resto de tu semana.`,
    voz: `El ${name} pide más de ti, una y otra vez. No hay que arreglarlo · solo verlo.`,
    correlacion: `Los ${plural(name)} es cuando más se nota.`,
    experimento: {
      hint: `A veces el ${name} ya viene cargado desde antes. Algo a notar, sin más.`,
      action: `Ver mis ${plural(name)}`,
    },
  }
}

/* ── 2 · weekend food — the table asks for more Sat/Sun ───────────── */
function detectWeekendFood(history: readonly DailySignals[]): Patron | null {
  const wd: number[] = []
  const we: number[] = []
  for (const s of history) {
    if (!s.day || s.calories == null) continue
    ;(monIdx(s.day) >= 5 ? we : wd).push(s.calories)
  }
  if (wd.length < MIN_SAMPLES || we.length < MIN_SAMPLES) return null
  const weAvg = mean(we)
  const wdAvg = mean(wd)
  if (weAvg - wdAvg < WEEKEND_KCAL_GAP) return null
  if (weAvg >= SEVERE_WEEKEND_KCAL) return null // very high, sustained → suppress

  const data: PairedData = {
    kind: 'paired',
    groups: [
      { label: 'Entre semana', avg: Math.round(wdAvg), unit: 'kcal' },
      { label: 'Fin de semana', avg: Math.round(weAvg), unit: 'kcal' },
    ],
  }
  return {
    id: 'weekend-food',
    category: 'comparacion',
    title: '¿El finde pide más?',
    emphasis: 'finde',
    detail: 'Tu ritmo cambia el fin de semana.',
    data,
    since: 'Se repite cada semana.',
    confidence: confidenceFor(Math.min(wd.length, we.length)),
    caption: 'Tu mesa, entre semana y fin de semana.',
    legend: 'Tus fines de semana suelen pedir más en la mesa que tus días entre semana.',
    voz: 'El finde afloja el ritmo de la semana. Es parte de tu órbita, no una falla.',
    correlacion: 'El fin de semana tu mesa pide más que entre semana.',
    experimento: {
      hint: 'El finde tiene otro pulso. Verlo sin corregirlo ya dice mucho.',
      action: 'Ver mi fin de semana',
    },
  }
}

/* ── 3 · low-sleep weekday — a night that runs short ──────────────── */
function detectLowSleepWeekday(history: readonly DailySignals[]): Patron | null {
  const sleep = byWeekdayField(history, (s) => s.sleep_minutes ?? null)
  const eligible = sleep.filter((w) => w.n >= MIN_SAMPLES)
  if (eligible.length < 2) return null
  const overall = mean(eligible.flatMap((w) => Array(w.n).fill(w.avg)))
  const low = eligible.reduce((m, w) => (w.avg < m.avg ? w : m), eligible[0]!)
  if (overall - low.avg < SLEEP_GAP_MIN) return null
  if (overall <= SEVERE_SLEEP_MIN) return null // chronic short sleep → suppress

  const name = MON_NAMES[low.i]!
  // Bars show sleep level (focus day reads as the short one).
  const maxSleep = Math.max(...sleep.map((w) => w.avg), 1)
  return {
    id: `low-sleep-${low.i}`,
    category: 'recurrencia',
    title: `¿Los ${plural(name)} duermes menos?`,
    emphasis: plural(name),
    detail: 'Se repite en tu ritmo.',
    data: weekdayVisual(history, low.i, (s) =>
      s.sleep_minutes != null ? Math.min(1, s.sleep_minutes / (maxSleep || 1)) : null,
    ),
    since: 'Visto en tu ritmo.',
    confidence: confidenceFor(low.n),
    caption: 'Tu sueño, semana a semana.',
    legend: `Los ${plural(name)} tu sueño suele quedar más corto.`,
    voz: `El ${name} la noche se acorta, una y otra vez. Solo verlo.`,
    correlacion: `Los ${plural(name)} es cuando menos duermes.`,
    experimento: {
      hint: `A veces el ${name} la noche se va sin avisar. Algo a notar.`,
      action: 'Ver mi sueño',
    },
  }
}

/** All weekly habit patterns from the rolling history. */
export function detectHabitPatterns(history: readonly DailySignals[]): Patron[] {
  if (history.length < 7) return []
  return [
    detectWeekdayTension(history),
    detectWeekendFood(history),
    detectLowSleepWeekday(history),
  ].filter((p): p is Patron => p != null)
}
