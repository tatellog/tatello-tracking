/*
 * "Lo que no sabías de tu mes" — detectores de sorpresa + el ranker que elige
 * UN protagonista (docs/orbita-maturity-spec.md, etapa 3). PURO y determinista.
 *
 * El protagonista es lo que ella NO sabía, no lo que más se repite: "entrenar
 * coincide con déficit" ya lo sabe. puntaje = efecto × evidencia × novedad.
 *   · efecto    — tamaño normalizado (380 kcal pesa más que 40).
 *   · evidencia — la muestra del lado más chico (≥ 3 por lado, siempre).
 *   · novedad   — se castiga lo esperado, se premia lo que tiene retraso
 *                 (anoche → hoy) y lo que contradice una creencia común
 *                 ("no es el fin de semana, es el jueves"), se castiga lo ya
 *                 mostrado como protagonista.
 * Sin candidato sobre el umbral no hay protagonista: nunca se fuerza.
 *
 * El sueño de un día es la noche ANTERIOR (sleep_logs se atribuye al día en
 * que despertó). Promedios de calorías y proteína: solo días COMPLETOS
 * (day-quality); tasas de déficit: todos los días con comida (decisión dueña).
 */
import { isDeficitDay } from './deficit.ts'
import { dayQuality } from './day-quality.ts'
import { lateBedtimeEffect } from './bedtime.ts'
import type { DailySignals } from './types.ts'

export type SurpriseId =
  | 'short-night'
  | 'protein-training'
  | 'steps-deficit'
  | 'weekday-break'
  | 'rescue'
  | 'late-bedtime'

export type SurpriseRow = { label: string; value: string; strong?: boolean }

export type Surprise = {
  id: SurpriseId
  /** La frase del hallazgo, dicha (nunca el número pelón). */
  headline: string
  /** La comparación que lo prueba: dos filas, la fuerte primero. */
  rows: SurpriseRow[]
  /** Días de la evidencia (el lado "fuerte"). */
  days: string[]
  /** 0..1, ya normalizado por detector. */
  effect: number
  /** Muestra del lado más chico de la comparación. */
  minSide: number
  /** Lo que casi todas ya saben (entrenar ↔ déficit, moverse ↔ déficit…). */
  expected: boolean
  /** Efecto con retraso (anoche → hoy, ayer → hoy): premiado. */
  delayed: boolean
  /** Contradice una creencia común (el día que se rompe NO es finde). */
  contradicts: boolean
  /** La evidencia sale del smartwatch (hora de dormirse, pasos): la tarjeta
   *  lo dice, para que nunca parezca que Stelar lo adivinó. */
  fromWatch?: boolean
}

export type SurpriseOpts = {
  calorieTarget?: number | null
  proteinTarget?: number | null
  /** Hora de dormirse por noche (día en que despertó → minutos desde las
   *  6 pm, ver `bedtimeOffsetMinutes`). Solo existe con reloj. */
  bedtimes?: ReadonlyMap<string, number>
}

const MIN_SIDE = 3
const SHORT_NIGHT = 360 // < 6 h
const GOOD_NIGHT = 420 // ≥ 7 h
const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const WEEKDAYS_PLURAL = [
  'los lunes',
  'los martes',
  'los miércoles',
  'los jueves',
  'los viernes',
  'los sábados',
  'los domingos',
]

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const fmt = (n: number) => Math.round(n).toLocaleString('es-MX')
const weekdayMon = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Un día por fecha, ordenado. */
function byDay(signals: readonly DailySignals[]): DailySignals[] {
  const m = new Map<string, DailySignals>()
  for (const s of signals) if (s.day) m.set(s.day, s)
  return [...m.values()].sort((a, b) => (a.day! < b.day! ? -1 : 1))
}

const hasFood = (s: DailySignals) => s.calories != null && s.calories > 0
const complete = (s: DailySignals) => dayQuality(s) === 'completo'

/* ── Detectores ─────────────────────────────────────────────────────── */

/** ¿La mayoría de estos días trae el sueño del reloj? */
function fromWatchMostly(days: readonly DailySignals[]): boolean {
  if (days.length === 0) return false
  return days.filter((s) => s.sleep_source === 'wearable').length * 2 > days.length
}

/** Noche corta (< 6 h) → las calorías de ESE día, contra noches de 7 h o más. */
export function shortNightEffect(signals: readonly DailySignals[]): Surprise | null {
  const days = byDay(signals).filter(complete)
  const short = days.filter((s) => s.sleep_minutes != null && s.sleep_minutes < SHORT_NIGHT)
  const good = days.filter((s) => s.sleep_minutes != null && s.sleep_minutes >= GOOD_NIGHT)
  if (short.length < MIN_SIDE || good.length < MIN_SIDE) return null
  const a = avg(short.map((s) => s.calories!))
  const b = avg(good.map((s) => s.calories!))
  const diff = a - b
  if (diff < 150) return null // solo cuando la noche corta PIDE más; lo contrario no es hallazgo
  return {
    id: 'short-night',
    headline: `Después de dormir menos de 6 horas, tu cuerpo pide unas ${fmt(diff)} kcal más ese día.`,
    rows: [
      { label: 'Tras dormir menos de 6 h', value: `${fmt(a)} kcal`, strong: true },
      { label: 'Tras dormir 7 h o más', value: `${fmt(b)} kcal` },
    ],
    days: short.map((s) => s.day!),
    effect: clamp01(diff / 400),
    minSide: Math.min(short.length, good.length),
    expected: false,
    delayed: true,
    contradicts: false,
    // La mayoría de esas noches las contó el reloj: la tarjeta lo dice.
    fromWatch: fromWatchMostly([...short, ...good]),
  }
}

/** Proteína en días con entreno contra días sin entreno. Lo sorprendente es
 *  que los días que entrena coma MENOS proteína. */
export function proteinTrainingGap(signals: readonly DailySignals[]): Surprise | null {
  const days = byDay(signals).filter((s) => complete(s) && s.protein_g != null && s.protein_g > 0)
  const train = days.filter((s) => s.trained === true)
  const rest = days.filter((s) => s.trained !== true)
  if (train.length < MIN_SIDE || rest.length < MIN_SIDE) return null
  const a = avg(train.map((s) => s.protein_g!))
  const b = avg(rest.map((s) => s.protein_g!))
  const diff = a - b
  if (Math.abs(diff) < 15) return null
  const less = diff < 0
  return {
    id: 'protein-training',
    headline: less
      ? `Los días que entrenas comes unos ${fmt(-diff)} g menos de proteína que cuando descansas.`
      : `Los días que entrenas comes unos ${fmt(diff)} g más de proteína que cuando descansas.`,
    rows: [
      { label: 'Días con entreno', value: `${fmt(a)} g`, strong: true },
      { label: 'Días sin entreno', value: `${fmt(b)} g` },
    ],
    days: train.map((s) => s.day!),
    effect: clamp01(Math.abs(diff) / 40),
    minSide: Math.min(train.length, rest.length),
    // Comer más proteína cuando entrena es lo esperado; comer menos, no.
    expected: !less,
    delayed: false,
    contradicts: less,
  }
}

/** Pasos contra déficit: la mitad de días con más pasos contra la otra mitad. */
export function stepsDeficit(
  signals: readonly DailySignals[],
  opts: SurpriseOpts,
): Surprise | null {
  const target = opts.calorieTarget ?? null
  if (target == null || target <= 0) return null
  const days = byDay(signals).filter((s) => hasFood(s) && (s.steps ?? 0) > 0)
  if (days.length < MIN_SIDE * 2) return null
  const sorted = [...days].sort((x, y) => (x.steps ?? 0) - (y.steps ?? 0))
  const cut = sorted[Math.floor(sorted.length / 2)]!.steps!
  const high = days.filter((s) => s.steps! >= cut)
  const low = days.filter((s) => s.steps! < cut)
  if (high.length < MIN_SIDE || low.length < MIN_SIDE) return null
  const hd = high.filter((s) => isDeficitDay(s.calories, target)).length
  const ld = low.filter((s) => isDeficitDay(s.calories, target)).length
  const diff = hd / high.length - ld / low.length
  if (diff < 0.2) return null
  // Hacia abajo: "X pasos o más" siempre es verdad para esos días.
  const steps = (Math.floor(cut / 500) * 500).toLocaleString('es-MX')
  return {
    id: 'steps-deficit',
    headline: `Tus días de ${steps} pasos o más cierran en déficit más seguido.`,
    rows: [
      { label: `${steps} pasos o más`, value: `${hd} de ${high.length}`, strong: true },
      { label: 'Menos pasos', value: `${ld} de ${low.length}` },
    ],
    days: high.map((s) => s.day!),
    effect: clamp01(diff / 0.5),
    minSide: Math.min(high.length, low.length),
    expected: true, // moverse ↔ déficit: ya lo intuye
    delayed: false,
    contradicts: false,
    fromWatch: true,
  }
}

/** El día de la semana que se rompe: la tasa de déficit más baja contra el
 *  resto. Si NO es fin de semana, contradice la creencia común. */
export function weekdayBreak(
  signals: readonly DailySignals[],
  opts: SurpriseOpts,
): Surprise | null {
  const target = opts.calorieTarget ?? null
  if (target == null || target <= 0) return null
  const days = byDay(signals).filter(hasFood)
  let worst: { wd: number; d: number; n: number; rate: number } | null = null
  for (let wd = 0; wd < 7; wd++) {
    const on = days.filter((s) => weekdayMon(s.day!) === wd)
    if (on.length < MIN_SIDE) continue
    const d = on.filter((s) => isDeficitDay(s.calories, target)).length
    const rate = d / on.length
    if (!worst || rate < worst.rate) worst = { wd, d, n: on.length, rate }
  }
  if (!worst) return null
  const rest = days.filter((s) => weekdayMon(s.day!) !== worst!.wd)
  if (rest.length < MIN_SIDE) return null
  const rd = rest.filter((s) => isDeficitDay(s.calories, target)).length
  const diff = rd / rest.length - worst.rate
  if (diff < 0.3) return null
  const weekend = worst.wd >= 5
  const name = WEEKDAYS[worst.wd]!
  return {
    id: 'weekday-break',
    headline: weekend
      ? `El día que más se te complica es el ${name}.`
      : `No es el fin de semana: el día que más se te complica es el ${name}.`,
    rows: [
      {
        label: `${WEEKDAYS_PLURAL[worst.wd]!.charAt(0).toUpperCase()}${WEEKDAYS_PLURAL[worst.wd]!.slice(1)}`,
        value: `${worst.d} de ${worst.n}`,
        strong: true,
      },
      { label: 'El resto de la semana', value: `${rd} de ${rest.length}` },
    ],
    days: days.filter((s) => weekdayMon(s.day!) === worst!.wd).map((s) => s.day!),
    effect: clamp01(diff / 0.5),
    minSide: Math.min(worst.n, rest.length),
    expected: weekend, // "el finde se me complica" ya lo sabe
    delayed: false,
    contradicts: !weekend,
  }
}

/** El rescate: después de un día sobre la meta, ¿cierra en déficit al día
 *  siguiente más que su tasa de siempre? Un hallazgo de resiliencia. */
export function rescueAfterOver(
  signals: readonly DailySignals[],
  opts: SurpriseOpts,
): Surprise | null {
  const target = opts.calorieTarget ?? null
  if (target == null || target <= 0) return null
  const days = byDay(signals).filter(hasFood)
  const map = new Map(days.map((s) => [s.day!, s]))
  const after: DailySignals[] = []
  for (const s of days) {
    if ((s.calories ?? 0) <= target) continue
    const next = map.get(addDaysIso(s.day!, 1))
    if (next) after.push(next)
  }
  if (after.length < MIN_SIDE || days.length < MIN_SIDE * 2) return null
  const ad = after.filter((s) => isDeficitDay(s.calories, target)).length
  const base = days.filter((s) => isDeficitDay(s.calories, target)).length
  const diff = ad / after.length - base / days.length
  if (diff < 0.15) return null
  return {
    id: 'rescue',
    headline: 'Después de un día sobre tu meta, al día siguiente vuelves más seguido al déficit.',
    rows: [
      { label: 'El día después', value: `${ad} de ${after.length}`, strong: true },
      { label: 'Tus días en general', value: `${base} de ${days.length}` },
    ],
    days: after.map((s) => s.day!),
    effect: clamp01(diff / 0.5),
    minSide: Math.min(after.length, days.length),
    expected: false,
    delayed: true,
    contradicts: false,
  }
}

/* ── El ranker ──────────────────────────────────────────────────────── */

/** Debajo de esto no hay protagonista: "tus días se parecieron entre sí". */
export const SURPRISE_MIN_SCORE = 0.12

export function surpriseScore(s: Surprise, shownIds: readonly string[] = []): number {
  const evidence = s.minSide / (s.minSide + 4) // 3 → 0.43, 8 → 0.67, 16 → 0.8
  let novelty = 1
  if (s.expected) novelty *= 0.4
  if (s.delayed) novelty *= 1.3
  if (s.contradicts) novelty *= 1.2
  if (shownIds.includes(s.id)) novelty *= 0.5
  return s.effect * evidence * novelty
}

export type SurpriseRanking = { hero: Surprise | null; others: Surprise[] }

/** Todos los candidatos → UN protagonista y hasta dos secundarios. */
export function rankSurprises(
  signals: readonly DailySignals[],
  opts: SurpriseOpts,
  shownIds: readonly string[] = [],
): SurpriseRanking {
  const candidates = [
    shortNightEffect(signals),
    proteinTrainingGap(signals),
    stepsDeficit(signals, opts),
    weekdayBreak(signals, opts),
    rescueAfterOver(signals, opts),
    lateBedtimeEffect(signals, opts),
  ].filter((s): s is Surprise => s != null)
  const scored = candidates
    .map((s) => ({ s, score: surpriseScore(s, shownIds) }))
    .filter((x) => x.score >= SURPRISE_MIN_SCORE)
    .sort((a, b) => b.score - a.score)
  return { hero: scored[0]?.s ?? null, others: scored.slice(1, 3).map((x) => x.s) }
}
