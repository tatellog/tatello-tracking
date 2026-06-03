/*
 * Deterministic Semana engine — turns real `daily_signals` rows into the
 * week diagram + a written reading, with NO AI. Mirrors the shape the
 * mock builders produced (`mock.ts`), so WeekSegment can swap mock → real
 * transparently. The per-day brightness reuses the same Día heuristics
 * (`deriveDimensions` in logic.ts); the week voice is a small template
 * driven entirely by the real numbers.
 *
 * Pattern detection lives in week-patterns.ts.
 */
import type { DailySignals } from './api'
import {
  deriveDimensions,
  TONE_BRILLANTE,
  TONE_FORMACION,
  type Dimension,
  type DimensionContext,
} from './logic'
import { buildArquetipoSemana, type DiaSemana, type VozParte } from './mock'

const WEEKDAY_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const
const WEEKDAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const

/** Friendly dimension nouns for the per-day note (no article). */
const DIM_NOUN: Record<Dimension['key'], string> = {
  cuerpo: 'cuerpo',
  energia: 'energía',
  mente: 'mente',
  sueno: 'sueño',
  alimento: 'comida',
  ciclo: 'ciclo',
}

/** Sunday-first weekday index (0..6) of a `YYYY-MM-DD` local-date string.
 *  Parsed as UTC midnight so the device timezone never shifts the day. */
function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay()
}

/** A day's single brightness = the mean of its six dimensions. A day with
 *  no signal sits at the dimension floor (≈0.14), never zero — "forming",
 *  not "dead" (docs §8). */
export function dayBrightness(dims: Dimension[]): number {
  return dims.reduce((s, d) => s + d.brightness, 0) / dims.length
}

/** One-word identity for a day, by overall brightness. Deterministic
 *  rhythm word — never a grade. */
function dayArchetype(b: number): string {
  if (b >= 0.72) return 'brillante'
  if (b >= 0.58) return 'presente'
  if (b >= 0.42) return 'tibia'
  if (b >= 0.28) return 'callada'
  return 'quieta'
}

function capitalize(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s
}

/** A short, warm note for a day — names the brightest dimension(s) that
 *  are en luz; stays quiet when nothing is. Past vs present voice. */
function dayNote(sig: DailySignals | null, dims: Dimension[], isToday: boolean): string {
  if (sig == null) {
    return isToday ? 'Hoy todavía no hay registros.' : 'Sin registros este día.'
  }
  const bright = dims
    .filter((d) => d.brightness >= TONE_BRILLANTE)
    .sort((a, b) => b.brightness - a.brightness)
    .slice(0, 2)
    .map((d) => DIM_NOUN[d.key])
  if (bright.length === 0) {
    return isToday ? 'Hoy va en voz baja. La luz aún no llega.' : 'Una jornada callada.'
  }
  const joined = bright.length === 2 ? `${bright[0]} y ${bright[1]}` : bright[0]!
  return isToday ? `Hoy, ${joined} en luz.` : `${capitalize(joined)} en luz.`
}

/** Build the real 7-day week from the week's `daily_signals` rows. Rows
 *  only exist for days that have data, so missing days fall to the floor
 *  via `deriveDimensions(null)`. Future days are blank stations. */
export function buildWeekDaysReal(
  signals: readonly DailySignals[],
  todayIdx: number,
  ctx?: DimensionContext,
): DiaSemana[] {
  const byIdx = new Map<number, DailySignals>()
  for (const s of signals) {
    if (s.day) byIdx.set(weekdayOf(s.day), s)
  }

  return Array.from({ length: 7 }, (_, i): DiaSemana => {
    if (i > todayIdx) {
      return {
        label: WEEKDAY_LABELS[i]!,
        weekday: WEEKDAY_NAMES[i]!,
        brightness: 0,
        today: false,
        archetype: '',
        dimEnLuz: 0,
        drift: 0,
        note: 'Aún no llega.',
      }
    }
    const sig = byIdx.get(i) ?? null
    const dims = deriveDimensions(sig, ctx)
    const brightness = dayBrightness(dims)
    const isToday = i === todayIdx
    return {
      label: WEEKDAY_LABELS[i]!,
      weekday: WEEKDAY_NAMES[i]!,
      brightness,
      today: isToday,
      archetype: dayArchetype(brightness),
      dimEnLuz: dims.filter((d) => d.brightness >= TONE_BRILLANTE).length,
      drift: dims.filter((d) => d.brightness < TONE_FORMACION).length,
      note: dayNote(sig, dims, isToday),
    }
  })
}

/** The opener part-list keyed by the week's rhythm (the same emphasis
 *  word `buildArquetipoSemana` derives from the real brightness shape). */
function vozOpener(emphasis: string): VozParte[] {
  switch (emphasis) {
    case 'sube':
      return [{ text: 'La semana viene ' }, { text: 'subiendo', tone: 'accent' }, { text: '. ' }]
    case 'afloja':
      return [{ text: 'La semana viene ' }, { text: 'aflojando', tone: 'accent' }, { text: '. ' }]
    case 'pareja':
      return [
        { text: 'La semana se mantiene ' },
        { text: 'pareja', tone: 'accent' },
        { text: '. ' },
      ]
    case 'vaivén':
      return [{ text: 'La semana va y ' }, { text: 'viene', tone: 'accent' }, { text: '. ' }]
    default:
      return [{ text: 'La semana apenas ' }, { text: 'arranca', tone: 'accent' }, { text: '. ' }]
  }
}

/** Assemble the Voz de Semana from the REAL days — opener by rhythm,
 *  an honest en-luz count, today's word, and a future-closer. All driven
 *  by the numbers; no templates per weekday. */
export function buildVozSemanaReal(
  days: readonly DiaSemana[],
  todayIdx: number,
): {
  parts: readonly VozParte[]
  signature: { confidence: 'alta' | 'media' | 'baja'; scope: string }
} {
  const arq = buildArquetipoSemana(days, todayIdx)
  const parts: VozParte[] = [...vozOpener(arq.emphasis)]

  if (arq.daysEnLuz > 0) {
    parts.push({ text: `${arq.daysEnLuz} de tus ${arq.daysRead} días ` })
    parts.push({ text: 'en luz', tone: 'accent' })
    parts.push({ text: '. ' })
  }

  const todayWord = days[todayIdx]?.archetype
  if (todayWord) {
    parts.push({ text: 'Hoy, ' })
    parts.push({ text: todayWord, tone: 'accent' })
    parts.push({ text: '. ' })
  }

  if (todayIdx < 6) {
    parts.push({ text: 'El resto ' })
    parts.push({ text: 'aún se escribe', tone: 'accent' })
    parts.push({ text: '.' })
  }

  const daysRead = todayIdx + 1
  const confidence: 'alta' | 'media' | 'baja' =
    daysRead >= 5 ? 'alta' : daysRead >= 3 ? 'media' : 'baja'
  return {
    parts,
    signature: { confidence, scope: `${daysRead} ${daysRead === 1 ? 'día leído' : 'días leídos'}` },
  }
}
