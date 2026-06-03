/*
 * Monthly HABIT detectors for the Mes segment — month-scale habits that
 * only emerge over ~30 days: your movement cadence (which days you train,
 * how often) and the recurring SHAPE of your week (weekdays vs weekend).
 * Deterministic, no AI. Returns `Patron`s the existing card + detail
 * screen render. Voice rules per features/patterns/CLAUDE.md.
 */
import type { DailySignals } from './types'
import { deriveDimensions } from './dimensions'
import type { DimensionContext } from './types'
import type { PairedData, Patron, WeekdayData } from './types'
import { dayBrightness } from './week'

const MON_NAMES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const
const MIN_DAYS = 12
/** Trained days needed before we'll describe a cadence. */
const MIN_TRAINED = 6
/** Brightness gap weekday-vs-weekend must clear to name a "shape". */
const SHAPE_GAP = 0.1

function monIdx(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
}
function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}
function plural(name: string): string {
  return name === 'sábado' || name === 'domingo' ? `${name}s` : name
}

/* ── 1 · training cadence — when (and how often) you move ──────────── */
function detectTrainingCadence(history: readonly DailySignals[]): Patron | null {
  const days = history.filter((s) => s.day)
  const trained = days.filter((s) => s.trained)
  if (trained.length < MIN_TRAINED) return null

  // Trained RATE per weekday (0..1).
  const total = Array.from({ length: 7 }, () => 0)
  const hit = Array.from({ length: 7 }, () => 0)
  for (const s of days) {
    const wd = monIdx(s.day!)
    total[wd]! += 1
    if (s.trained) hit[wd]! += 1
  }
  const rate = total.map((t, i) => (t ? hit[i]! / t : 0))
  let focus = 0
  for (let i = 1; i < 7; i++) if (rate[i]! > rate[focus]!) focus = i

  const wdTrained = days.filter((s) => monIdx(s.day!) < 5 && s.trained).length
  const weTrained = days.filter((s) => monIdx(s.day!) >= 5 && s.trained).length
  // Three honest shapes — the legend AND the voz both read from this, so
  // the prose can never claim "entre semana" over weekend-leaning data.
  const shape: 'weekday' | 'weekend' | 'spread' =
    wdTrained >= weTrained * 2 ? 'weekday' : weTrained >= wdTrained * 2 ? 'weekend' : 'spread'

  // Build the weeks proof from the trained flag.
  const weeksMap = new Map<string, number[]>()
  for (const s of days) {
    const d = new Date(`${s.day}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - monIdx(s.day!))
    const key = d.toISOString().slice(0, 10)
    if (!weeksMap.has(key)) weeksMap.set(key, Array(7).fill(0))
    weeksMap.get(key)![monIdx(s.day!)] = s.trained ? 1 : 0
  }
  const weeks = [...weeksMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-4)
    .map(([, bars], i) => ({ label: `sem ${i + 1}`, bars }))
  const data: WeekdayData = { kind: 'weekday', focus, week: rate, weeks }

  return {
    id: 'training-cadence',
    category: 'recurrencia',
    title: 'Tu semana de movimiento',
    emphasis: 'movimiento',
    detail: 'Una forma que vuelve en tu ritmo.',
    data,
    since: 'Leído en todo tu mes.',
    confidence: trained.length >= 12 ? 'alta' : 'media',
    caption: 'Tus entrenos, día por día.',
    legend:
      shape === 'weekday'
        ? 'Te mueves casi siempre entre semana. El fin de semana suele quedar para descansar.'
        : shape === 'weekend'
          ? 'Te mueves sobre todo el fin de semana. Entre semana el cuerpo descansa.'
          : 'Tu movimiento se reparte a lo largo de la semana.',
    voz:
      shape === 'weekday'
        ? 'Tu cuerpo encontró un ritmo. Entre semana se mueve; cuando toca, descansa.'
        : shape === 'weekend'
          ? 'Tu cuerpo encontró un ritmo. El fin de semana se mueve; entre semana descansa.'
          : 'Tu cuerpo encontró un ritmo, repartido por la semana a su manera.',
    correlacion: `Los ${plural(MON_NAMES[focus]!)} es cuando más te mueves.`,
    experimento: {
      hint: 'Tu ritmo ya está ahí. A veces solo hace falta verlo.',
      action: 'Ver mi movimiento',
    },
  }
}

/* ── 2 · the shape of your week — weekdays vs weekend, all month ───── */
function detectWeeklyShape(
  history: readonly DailySignals[],
  ctx?: DimensionContext,
): Patron | null {
  const wd: number[] = []
  const we: number[] = []
  for (const s of history) {
    if (!s.day) continue
    const b = dayBrightness(deriveDimensions(s, ctx))
    ;(monIdx(s.day) >= 5 ? we : wd).push(b)
  }
  if (wd.length < 6 || we.length < 4) return null
  const wdAvg = mean(wd)
  const weAvg = mean(we)
  if (Math.abs(wdAvg - weAvg) < SHAPE_GAP) return null

  const weekdayBrighter = wdAvg > weAvg
  const data: PairedData = {
    kind: 'paired',
    groups: [
      { label: 'Entre semana', avg: Math.round(wdAvg * 100), unit: '' },
      { label: 'Fin de semana', avg: Math.round(weAvg * 100), unit: '' },
    ],
  }
  return {
    id: 'weekly-shape',
    category: 'comparacion',
    title: 'Tu semana tiene una forma',
    emphasis: 'forma',
    detail: 'Se dibuja igual en tu ritmo.',
    data,
    since: 'Leído en todo tu mes.',
    confidence: Math.min(wd.length, we.length) >= 8 ? 'alta' : 'media',
    caption: 'Tu semana, entre semana y fin de semana.',
    legend: weekdayBrighter
      ? 'Entre semana tu semana enciende; el fin de semana afloja.'
      : 'El fin de semana enciende; entre semana es más quieto.',
    voz: 'Hay una forma en tu semana que vuelve y vuelve. Tu cuerpo tiene su pulso.',
    correlacion: weekdayBrighter
      ? 'Tus días entre semana van por encima del fin de semana.'
      : 'Tus fines de semana van por encima de tus días entre semana.',
    experimento: {
      hint: 'Tu semana tiene su pulso. Conocerlo es trabajar con él, no contra él.',
      action: 'Ver la forma de mi semana',
    },
  }
}

/** All month-scale habit patterns. Empty until there's enough month. */
export function detectMonthPatterns(
  history: readonly DailySignals[],
  ctx?: DimensionContext,
): Patron[] {
  if (history.filter((s) => s.day).length < MIN_DAYS) return []
  return [detectTrainingCadence(history), detectWeeklyShape(history, ctx)].filter(
    (p): p is Patron => p != null,
  )
}
