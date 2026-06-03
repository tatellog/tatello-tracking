/*
 * Late-night eating pattern for the Semana segment — the recurring,
 * revisitable card behind the one-shot night_eating reveal. Deterministic,
 * no AI. Looks at meal TIMES (which daily_signals doesn't carry), buckets
 * the late ones by weekday, and — if they cluster enough — emits a real
 * `Patron` the PatternCard + detail screen already render.
 *
 * "Night" is 21:00–04:59 LOCAL: late evenings AND the 1–3 AM meals (whose
 * clock hour is small, not >=21). Hours are computed in the user's fixed
 * timezone (America/Mexico_City = UTC-6), the same convention as the rest
 * of the app, so it's deterministic regardless of device timezone.
 *
 * Voice rules (features/patterns/CLAUDE.md): the subject is the night, not
 * the user; no clinical words; no duration counts in the headline.
 */
import type { Meal } from './types'

import type { Patron, WeekdayData } from './types'

/** Mexico City is fixed UTC-6 year-round (no DST since 2022). */
const TZ_OFFSET_HOURS = -6
/** Night window: 22:00 through 04:59 local. Starts at 10pm (not 9) so an
 *  ordinary 9pm dinner isn't counted as "eating late" — only genuinely
 *  late evenings and the 1–4 AM meals. */
const NIGHT_FROM = 22
const NIGHT_TO = 4
/** Minimum late nights overall before we'll name it. */
const MIN_LATE_MEALS = 4
/** The peak weekday must carry at least this many to be the focus. */
const MIN_FOCUS = 2
/*
 * Severe ceiling. A near-daily late-eating pattern sustained for weeks is
 * exactly the case the manifiesto's red line carves out: Stelar must NOT
 * coach it cheerfully. The clinical referral flow (severe_signals table +
 * professional resources) is pre-launch TODO — see features/patterns/
 * logic.ts. Until it exists, we SUPPRESS the normal card above this
 * threshold rather than name a sensitive pattern as a light "órbita".
 */
const SEVERE_TOTAL = 24

const MON_NAMES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const

function plural(monName: string): string {
  return monName === 'sábado' || monName === 'domingo' ? `${monName}s` : monName
}

/** Local hour + Monday-first weekday of a UTC timestamp, in CDMX time. */
function localParts(consumedAt: string): { hour: number; wd: number } {
  const t = new Date(consumedAt).getTime() + TZ_OFFSET_HOURS * 3600_000
  const d = new Date(t)
  const hour = d.getUTCHours()
  const wd = (d.getUTCDay() + 6) % 7 // 0=Mon … 6=Sun
  return { hour, wd }
}

function isNight(hour: number): boolean {
  return hour >= NIGHT_FROM || hour <= NIGHT_TO
}

/** Group a late meal into the Monday-start week key it belongs to. */
function weekKey(consumedAt: string): string {
  const t = new Date(consumedAt).getTime() + TZ_OFFSET_HOURS * 3600_000
  const d = new Date(t)
  const wd = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - wd)
  return d.toISOString().slice(0, 10)
}

function confidenceFor(n: number): 'alta' | 'media' | 'baja' {
  return n >= 6 ? 'alta' : n >= 4 ? 'media' : 'baja'
}

/**
 * The late-night pattern, or null when the nights don't cluster enough to
 * be honest. `meals` is any window of recent meals (≈5 weeks).
 */
export function detectNightPattern(meals: readonly Meal[]): Patron | null {
  const lateByWd = Array.from({ length: 7 }, () => 0)
  const weeksMap = new Map<string, number[]>()
  let total = 0

  for (const m of meals) {
    if (!m.consumed_at) continue
    const { hour, wd } = localParts(m.consumed_at)
    if (!isNight(hour)) continue
    total += 1
    lateByWd[wd]! += 1
    const key = weekKey(m.consumed_at)
    if (!weeksMap.has(key)) weeksMap.set(key, Array(7).fill(0))
    weeksMap.get(key)![wd]! += 1
  }

  if (total < MIN_LATE_MEALS) return null
  // Severe (near-daily, sustained) → not the cheerful card. Suppress
  // until the referral flow exists (manifiesto red line).
  if (total >= SEVERE_TOTAL) return null

  // Peak weekday — where the late nights gather.
  let focus = 0
  for (let i = 1; i < 7; i++) if (lateByWd[i]! > lateByWd[focus]!) focus = i
  if (lateByWd[focus]! < MIN_FOCUS) return null

  // Normalise per-weekday counts to 0..1 for the glyph + chart.
  const max = Math.max(...lateByWd, 1)
  const week = lateByWd.map((c) => c / max)
  const weeks = [...weeksMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-4)
    .map(([, bars], i) => ({ label: `sem ${i + 1}`, bars: bars.map((c) => c / max) }))

  const focusName = MON_NAMES[focus]!
  const data: WeekdayData = { kind: 'weekday', focus, week, weeks }

  return {
    id: 'night-eating',
    category: 'recurrencia',
    title: '¿Las noches piden más?',
    emphasis: 'noches',
    // No raw count (manifiesto: contar = factura). Feel the recurrence.
    detail: 'Vuelve, semana tras semana.',
    data,
    since: 'Se repite en tu ritmo.',
    confidence: confidenceFor(total),
    caption: 'Tus noches tardías, semana a semana.',
    legend: `Tus comidas más tardías caen los ${plural(focusName)}, ya entrada la noche.`,
    voz: 'Las noches piden más, una y otra vez. No hay que arreglarlo hoy · solo verlo.',
    correlacion: `Los ${plural(focusName)} es cuando más se repite.`,
    experimento: {
      // Open observation, not an instruction (no imperative to the user).
      hint: 'A veces la noche empieza temprano, en un día que pidió poco.',
      action: 'Ver mis noches',
    },
  }
}
