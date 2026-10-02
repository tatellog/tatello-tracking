/*
 * Detalle de sueño — lógica PURA de la pantalla "Tu sueño" (sin RN ni
 * Supabase). Etapas de una noche, las últimas 7 noches y lo normal para ti.
 */
import type { SleepNight } from './api'

export type StageKey = 'deep' | 'core' | 'rem' | 'awake'

export type StageSegment = { key: StageKey; label: string; minutes: number; share: number }

const STAGE_LABEL: Record<StageKey, string> = {
  deep: 'Profundo',
  core: 'Ligero',
  rem: 'REM',
  awake: 'Despierta',
}

/** Las etapas de la noche en orden, con su parte del total; null sin etapas. */
export function stageSegments(
  night: Pick<SleepNight, 'deep_minutes' | 'core_minutes' | 'rem_minutes' | 'awake_minutes'>,
): StageSegment[] | null {
  const raw: [StageKey, number | null][] = [
    ['deep', night.deep_minutes],
    ['core', night.core_minutes],
    ['rem', night.rem_minutes],
    ['awake', night.awake_minutes],
  ]
  if (raw.every(([, m]) => m == null)) return null
  const total = raw.reduce((a, [, m]) => a + (m ?? 0), 0)
  if (total <= 0) return null
  return raw.map(([key, m]) => ({
    key,
    label: STAGE_LABEL[key],
    minutes: m ?? 0,
    share: (m ?? 0) / total,
  }))
}

export type NightBar = { day: string; initial: string; minutes: number | null; selected: boolean }

const INITIALS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

export function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Las 7 noches que terminan en `day` (días en que despertó), de la más vieja
 *  a la vista. `minutesByDay` ya trae el merge manual/reloj de daily_signals. */
export function lastSevenNights(
  day: string,
  minutesByDay: ReadonlyMap<string, number>,
): NightBar[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDaysIso(day, i - 6)
    const m = minutesByDay.get(d)
    return {
      day: d,
      initial: INITIALS[new Date(`${d}T00:00:00Z`).getUTCDay()]!,
      minutes: m != null && m > 0 ? m : null,
      selected: d === day,
    }
  })
}

/** Lo normal para ti: la mediana de las noches con dato (mín. 3), redondeada
 *  a 5 min. Mediana y no promedio: una noche rara no mueve "lo normal". */
export function usualSleep(minutes: readonly number[]): number | null {
  const xs = minutes.filter((m) => m > 0).sort((a, b) => a - b)
  if (xs.length < 3) return null
  const mid = Math.floor(xs.length / 2)
  const med = xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2
  return Math.round(med / 5) * 5
}

/** "11:48 pm" en la zona de la usuaria. */
export function clockTime(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(iso))
  const h = parts.find((p) => p.type === 'hour')?.value ?? ''
  const m = parts.find((p) => p.type === 'minute')?.value ?? ''
  const ap = (parts.find((p) => p.type === 'dayPeriod')?.value ?? '').toLowerCase()
  return `${h}:${m} ${ap}`
}

/** "7:05" — la etiqueta compacta sobre cada barra. */
export function barLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

/* ── Hora de dormir (la "highlight" del detalle de sueño) ─────────────── */

/** Minutos desde el MEDIODÍA local de la hora de dormir (12:00 → 0, 1:15 am →
 *  795): así una noche que cruza la medianoche promedia bien con las demás. */
export function bedtimeMinutes(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return (h * 60 + m - 12 * 60 + 1440) % 1440
}

/** "12:49 am" desde minutos-después-del-mediodía. */
export function bedtimeLabel(minutesAfterNoon: number): string {
  const total = (Math.round(minutesAfterNoon) + 12 * 60) % 1440
  const h24 = Math.floor(total / 60)
  const m = total % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`
}

export type BedtimeBar = { day: string; minutes: number | null; selected: boolean }

export type BedtimeRead = {
  bars: BedtimeBar[]
  /** Promedio de tus noches ANTERIORES (sin la vista); null con menos de 3. */
  average: number | null
  last: number | null
  /** Positivo = más tarde que tu promedio (minutos, redondeado). */
  diff: number | null
}

/** Las últimas `n` noches que terminan en `day`, con su hora de dormir. */
export function bedtimeRead(
  nights: readonly { sleep_date: string; bedtime_at: string | null }[],
  day: string,
  tz: string,
  n = 14,
): BedtimeRead {
  const byDay = new Map(nights.map((x) => [x.sleep_date, x.bedtime_at]))
  const bars: BedtimeBar[] = Array.from({ length: n }, (_, i) => {
    const d = addDaysIso(day, i - (n - 1))
    const at = byDay.get(d)
    return { day: d, minutes: at ? bedtimeMinutes(at, tz) : null, selected: d === day }
  })
  const prior = bars.filter((b) => !b.selected && b.minutes != null).map((b) => b.minutes!)
  const average = prior.length >= 3 ? prior.reduce((a, x) => a + x, 0) / prior.length : null
  const last = bars[bars.length - 1]?.minutes ?? null
  return {
    bars,
    average,
    last,
    diff: average != null && last != null ? Math.round(last - average) : null,
  }
}
