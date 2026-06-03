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
import { deriveDimensions, TONE_BRILLANTE, TONE_FORMACION } from './dimensions'
import { buildArquetipoSemana } from './arquetipo'
import type {
  DailySignals,
  DiaSemana,
  Dimension,
  DimensionContext,
  Patron,
  VozParte,
  WeekObservation,
  WeekRecap,
} from './types'

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

/* ── Esta semana, en números — the Semana "registros" recap ──────────
 * This week's log totals (Sunday-first, only the days up to today). Sleep
 * and water are averaged over the days that actually carry that signal, so
 * a day you didn't log sleep doesn't drag the average down — null when no
 * day carries it (the UI shows "—", never a 0 that reads as failure). */
export function buildWeekRecap(signals: readonly DailySignals[], todayIdx: number): WeekRecap {
  const byIdx = new Map<number, DailySignals>()
  for (const s of signals) {
    if (s.day) byIdx.set(weekdayOf(s.day), s)
  }
  let entrenos = 0
  let meals = 0
  let sleepSum = 0
  let sleepN = 0
  let waterSum = 0
  let waterN = 0
  for (let i = 0; i <= todayIdx && i < 7; i++) {
    const s = byIdx.get(i)
    if (s == null) continue
    if (s.trained) entrenos += 1
    if (s.meal_count) meals += s.meal_count
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
    meals,
    sleepAvgMin: sleepN ? Math.round(sleepSum / sleepN) : null,
    waterAvg: waterN ? Math.round((waterSum / waterN) * 10) / 10 : null,
  }
}

/* ── Lo que noté esta semana — within-week micro-observations ─────────
 * Concrete, day-named facts about THIS week (not month recurrences): the
 * days you moved, hit protein, went over your calorie target, slept short,
 * or ran low on energy. Honest but never a verdict — "tu comida pasó tu
 * objetivo", not "comiste de más". Only the days actually logged count;
 * future days are ignored. Capped so it stays a glance, wins lead. */
const SLEEP_SHORT_MIN = 390 // < 6.5 h reads as a short night
const LOW_ENERGY = 2 // energy ≤ 2 (of 5)
const OBS_MAX = 4
/* A watch covering this many logged days has SATURATED the week — sustained,
 * not a casual note. The manifiesto's red line says the answer there is
 * support, not a day-by-day amplification, so we suppress it (a real referral
 * flow lives outside this glance). */
const SATURATION = 5
/* At most this many "watch" lines, so the card never reads as a balance of
 * carencias — wins always lead. */
const MAX_WATCHES = 2

/** "N día" / "N días". */
function dCount(n: number): string {
  return `${n} ${n === 1 ? 'día' : 'días'}`
}

type Lived = { idx: number; s: DailySignals }

export function buildWeekObservations(
  signals: readonly DailySignals[],
  todayIdx: number,
  ctx?: DimensionContext,
): WeekObservation[] {
  const byIdx = new Map<number, DailySignals>()
  for (const s of signals) {
    if (s.day) byIdx.set(weekdayOf(s.day), s)
  }
  const lived: Lived[] = []
  for (let i = 0; i <= todayIdx && i < 7; i++) {
    const s = byIdx.get(i)
    if (s != null) lived.push({ idx: i, s })
  }
  const match = (fn: (s: DailySignals) => boolean | null | undefined): Lived[] =>
    lived.filter((d) => fn(d.s))

  const calTarget = ctx?.calorieTarget ?? null
  const protTarget = ctx?.proteinTarget ?? null
  const trained = match((s) => s.trained)
  const proteinHit = match(
    (s) => protTarget != null && s.protein_g != null && s.protein_g >= protTarget,
  )
  const foodOver = match((s) => calTarget != null && s.calories != null && s.calories > calTarget)
  const sleepShort = match((s) => s.sleep_minutes != null && s.sleep_minutes < SLEEP_SHORT_MIN)
  const energyLow = match((s) => s.energy != null && s.energy <= LOW_ENERGY)

  // Wins lead (manifiesto: register without guilt) and are listed freely.
  const wins: WeekObservation[] = []
  if (trained.length)
    wins.push({
      key: 'trained',
      dimension: 'cuerpo',
      state: 'win',
      title: 'Tu cuerpo, presente',
      emphasis: 'presente',
      tag: 'esta semana',
      detail: `Te moviste ${dCount(trained.length)}.`,
      days: trained.map((d) => d.idx),
      entries: trained.map((d) => ({ dayIdx: d.idx, value: 'entreno' })),
      voz: 'Tu cuerpo dijo presente. Cada día que te moviste deja huella.',
    })
  if (proteinHit.length)
    wins.push({
      key: 'protein',
      dimension: 'alimento',
      state: 'win',
      title: 'Tu proteína, en su lugar',
      emphasis: 'proteína',
      tag: 'esta semana',
      detail: `La alcanzaste ${dCount(proteinHit.length)}.`,
      days: proteinHit.map((d) => d.idx),
      entries: proteinHit.map((d) => ({ dayIdx: d.idx, value: `${Math.round(d.s.protein_g!)} g` })),
      voz: 'Tu proteína estuvo donde la querías. Es lo que sostiene tu cambio.',
    })

  // Watches — gentle, and suppressed when they saturate the week (red line).
  const watches: WeekObservation[] = []
  const addWatch = (matched: Lived[], o: WeekObservation): void => {
    if (matched.length > 0 && matched.length < SATURATION) watches.push(o)
  }
  addWatch(foodOver, {
    key: 'food-over',
    dimension: 'alimento',
    state: 'watch',
    title: 'La mesa pidió más',
    emphasis: 'más',
    tag: 'esta semana',
    detail: `${dCount(foodOver.length)} por encima de tu objetivo.`,
    days: foodOver.map((d) => d.idx),
    entries: foodOver.map((d) => ({
      dayIdx: d.idx,
      value: `${d.s.calories} cal`,
      delta: calTarget != null ? `+${d.s.calories! - calTarget}` : undefined,
    })),
    voz: 'Algunos días la mesa pidió más. El resto sostuviste tu ritmo.',
  })
  addWatch(sleepShort, {
    key: 'sleep-short',
    dimension: 'sueno',
    state: 'watch',
    title: 'Noches más cortas',
    emphasis: 'cortas',
    tag: 'esta semana',
    detail: `${dCount(sleepShort.length)} la noche se acortó.`,
    days: sleepShort.map((d) => d.idx),
    entries: sleepShort.map((d) => ({
      dayIdx: d.idx,
      value: `${(d.s.sleep_minutes! / 60).toFixed(1)} h`,
    })),
    voz: 'Algunas noches se quedaron cortas. El descanso también mueve tu cambio.',
  })
  addWatch(energyLow, {
    key: 'energy-low',
    dimension: 'energia',
    state: 'watch',
    title: 'Tu energía, en bajo',
    emphasis: 'bajo',
    tag: 'esta semana',
    detail: `${dCount(energyLow.length)} tu energía estuvo baja.`,
    days: energyLow.map((d) => d.idx),
    entries: energyLow.map((d) => ({ dayIdx: d.idx, value: `${d.s.energy}/5` })),
    voz: 'Tu energía bajó algunos días. ¿Algo te pesó esta semana?',
  })

  return [...wins, ...watches.slice(0, MAX_WATCHES)].slice(0, OBS_MAX)
}

/** Sunday-first weekday names ['Domingo'..'Sábado'] — exported so the
 *  observation card + detail can label days from an observation's `days`. */
export const WEEKDAY_NAMES_FULL = WEEKDAY_NAMES

export type { WeekObservation, WeekObservationEntry } from './types'

/* ── Lo que viene — Semana's bridge to the Mes patterns ──────────────
 * A gentle heads-up for the SOONEST upcoming day this week that carries
 * a known recurring pattern (from the Mes). Never a warning or a command
 * — just "el finde suele pedir más", a knowing nudge. Returns null when
 * nothing relevant is still ahead this week.
 *
 * `todayGetDay` is JS getDay (0=Sun … 6=Sat); the week is Sunday-first,
 * so the days still ahead are today+1 … Saturday. */
const DAY_BY_MON = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const

export function buildWeekAhead(patterns: readonly Patron[], todayGetDay: number): string | null {
  const monOf = (g: number): number => (g + 6) % 7
  const phraseFor = (p: Patron): { focus: number | 'weekend'; text: string } | null => {
    // Weekend phrase is about RHYTHM, never anticipating food/intake — a
    // forward-projected "el finde pide más en la mesa" would cross into
    // anticipated calorie control (manifiesto). The food pattern stays a
    // retrospective read in Mes.
    if (p.id === 'weekend-food')
      return { focus: 'weekend', text: 'El finde suele moverse a otro ritmo.' }
    if (p.data.kind !== 'weekday') return null
    const f = p.data.focus
    const d = DAY_BY_MON[f]
    if (d == null) return null
    if (p.id.startsWith('weekday-tension'))
      return { focus: f, text: `El ${d} suele pedir más de vos.` }
    if (p.id.startsWith('low-sleep')) return { focus: f, text: `El ${d} la noche suele acortarse.` }
    if (p.id.startsWith('weekday-low'))
      return { focus: f, text: `El ${d} suele costar un poco más.` }
    if (p.id.startsWith('weekday-high')) return { focus: f, text: `El ${d} suele encenderse.` }
    return null
  }
  // The soonest upcoming day wins (outer loop by day).
  for (let g = todayGetDay + 1; g <= 6; g++) {
    const mon = monOf(g)
    for (const p of patterns) {
      const ph = phraseFor(p)
      if (!ph) continue
      if (ph.focus === 'weekend' && g === 6) return ph.text
      if (ph.focus === mon) return ph.text
    }
  }
  return null
}
