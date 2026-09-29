/*
 * El PAQUETE DE HECHOS del chat del patrón dominante (docs/orbita-maturity-spec.md,
 * "chat con paquete de hechos"). PURO y determinista.
 *
 * La IA no ve registros ni detecta nada: recibe estos hechos ya calculados y
 * solo los pone en palabras. Cada hecho trae su texto determinista (con los
 * números reales) y una pregunta de reserva; si la IA falla o el backstop la
 * rechaza, el chat muestra el texto tal cual. Un hecho sin muestra suficiente
 * (≥ 3 días por lado) no nace: no se publica una comparación con un lado vacío.
 *
 * También vive aquí lo fijo del chat: la apertura, el foco y el estado de la
 * semana (el cierre ya no lo redacta la IA).
 */
import { dayQuality } from './day-quality.ts'
import { isDeficitDay } from './deficit.ts'
import type { DailySignals } from './types.ts'
import { WATER_GOAL_GLASSES } from './water.ts'

/** Forma mínima del combo (estructural con month-built.WinningCombo, sin importarlo
 *  para no crear un ciclo: month-built delega su palanca aquí). */
export type ComboShape = {
  signals: { key: string; label: string }[]
  occurrences: number
  deficits: number
  days: string[]
  restDays: number
  restDeficits: number
}

export type ComboOpts = {
  calorieTarget?: number | null
  proteinTarget?: number | null
  waterGoalGlasses?: number | null
}

export type ComboFact = {
  /** Estable entre renders ("sin:sueno", "misses", "weekday"…). */
  id: string
  /** La respuesta determinista, con los números reales. Es el PISO del chat. */
  text: string
  /** La pregunta de reserva si la IA no da chips. */
  question: string
  /** Días de la evidencia (para tocarlos desde la respuesta). */
  days: string[]
}

const MIN_SIDE = 3
const SLEEP_7H_MIN = 420

/* ── Vocabulario por hábito ──────────────────────────────────────────── */

/** Infinitivo: "dormir 7 horas o más y entrenar el mismo día". */
const HABIT_PHRASE: Record<string, string> = {
  sueno: 'dormir 7 horas o más',
  cuerpo: 'entrenar',
  proteina: 'llegar a tu proteína',
  agua: 'completar tu agua',
}
/** Pasado: "los días que solo entrenaste". */
const HABIT_PAST: Record<string, string> = {
  sueno: 'dormiste 7 horas o más',
  cuerpo: 'entrenaste',
  proteina: 'llegaste a tu proteína',
  agua: 'completaste tu agua',
}
/** Sustantivo corto: "sin el entreno". */
const HABIT_NOUN: Record<string, string> = {
  sueno: 'dormir 7 horas',
  cuerpo: 'entrenar',
  proteina: 'tu proteína',
  agua: 'tu agua',
}
/** Primera persona, para la pregunta: "¿Y si solo entreno?". */
const HABIT_Q: Record<string, string> = {
  sueno: 'duermo bien',
  cuerpo: 'entreno',
  proteina: 'llego a mi proteína',
  agua: 'completo mi agua',
}
const HABIT_TREND_Q: Record<string, string> = {
  sueno: '¿Duermo igual que antes?',
  cuerpo: '¿Entreno igual que antes?',
  proteina: '¿Llego a mi proteína igual que antes?',
  agua: '¿Tomo agua igual que antes?',
}

const WEEKDAY_PLURAL = [
  'los lunes',
  'los martes',
  'los miércoles',
  'los jueves',
  'los viernes',
  'los sábados',
  'los domingos',
]
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/* ── Helpers ─────────────────────────────────────────────────────────── */

function weekdayMon(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
}
function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** "3 sep". */
export function fmtShortDate(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1] ?? ''}`
}
const veces = (n: number) => (n === 1 ? 'vez' : 'veces')
const dias = (n: number) => (n === 1 ? 'día' : 'días')

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

/** Un día por fecha (la vista puede traer duplicados), con comida registrada. */
function foodByDay(signals: readonly DailySignals[]): DailySignals[] {
  const map = new Map<string, DailySignals>()
  for (const s of signals) {
    if (!s.day || s.calories == null || s.calories <= 0) continue
    map.set(s.day, s)
  }
  return [...map.values()].sort((a, b) => (a.day! < b.day! ? -1 : 1))
}

/** Predicado por hábito (misma regla que month-built.winningCombo). */
function habitTest(key: string, opts: ComboOpts): (s: DailySignals) => boolean {
  const pt = opts.proteinTarget ?? null
  const wg = Math.max(1, opts.waterGoalGlasses ?? WATER_GOAL_GLASSES)
  switch (key) {
    case 'sueno':
      return (s) => s.sleep_minutes != null && s.sleep_minutes >= SLEEP_7H_MIN
    case 'proteina':
      return (s) => pt != null && pt > 0 && s.protein_g != null && s.protein_g >= pt
    case 'cuerpo':
      return (s) => s.trained === true
    case 'agua':
      return (s) => (s.water_glasses ?? 0) >= wg
    default:
      return () => false
  }
}

export function comboMatches(combo: ComboShape, opts: ComboOpts): (s: DailySignals) => boolean {
  const preds = combo.signals.map((sig) => habitTest(sig.key, opts))
  return (s) => preds.length > 0 && preds.every((p) => p(s))
}

/* ── Lo fijo del chat ────────────────────────────────────────────────── */

/** "dormir 7 horas o más y entrenar" (sin mayúscula ni punto). */
export function comboHabitList(combo: ComboShape): string {
  return joinList(combo.signals.map((s) => HABIT_PHRASE[s.key] ?? s.label.toLowerCase()))
}

/** La apertura fija: el patrón, su evidencia contada y el punto de comparación. */
export function comboOpening(combo: ComboShape): string[] {
  const n = combo.occurrences
  const m = combo.deficits
  const first = combo.days[0]
  const last = combo.days[combo.days.length - 1]
  const span =
    first && last && first !== last
      ? `Pasó ${n} ${dias(n)} entre el ${fmtShortDate(first)} y el ${fmtShortDate(last)}.`
      : `Pasó ${n} ${dias(n)}.`
  const closed = m >= n ? `En los ${n} cerraste en déficit.` : `En ${m} cerraste en déficit.`
  const lines = [
    `Tu patrón más repetido: ${comboHabitList(combo)} el mismo día.`,
    `${span} ${closed}`,
  ]
  if (combo.restDays >= MIN_SIDE) {
    lines.push(
      `${comboWithoutLabel(combo)}: ${combo.restDeficits} de ${combo.restDays} en déficit.`,
    )
  }
  return lines
}

/** El foco de la semana: el hábito junto, sin cifras ni orden. */
export function comboFocus(combo: ComboShape): string {
  const list = comboHabitList(combo)
  return `Juntar en un mismo día ${list}.`
}

/* ── La tarjeta del patrón (se lee en 2 segundos) ────────────────────── */

/** Presente, segunda persona: "Cuando duermes 7 horas y entrenas…". */
const HABIT_PRESENT: Record<string, string> = {
  sueno: 'duermes 7 horas',
  cuerpo: 'entrenas',
  proteina: 'llegas a tu proteína',
  agua: 'completas tu agua',
}

/** Cuánto más seguido cierra en déficit con el patrón que sin él, en palabras
 *  honestas. Nunca exagera: "el doble" solo si de verdad es el doble. */
export function comboLift(combo: ComboShape): string {
  const rate = combo.occurrences > 0 ? combo.deficits / combo.occurrences : 0
  const rest = combo.restDays > 0 ? combo.restDeficits / combo.restDays : 0
  if (rest <= 0) return 'mucho más seguido'
  const ratio = rate / rest
  if (ratio >= 2.5) return 'más del doble'
  if (ratio >= 1.95) return 'el doble'
  if (ratio >= 1.6) return 'casi el doble'
  return 'más seguido'
}

/** El número grande de la tarjeta: cuántas veces más seguido cierra en déficit
 *  con el patrón. Honesto: "2×" solo si de verdad es el doble; debajo de 1.6
 *  se dice la razón exacta ("1,4×"), nunca se redondea hacia arriba. */
export function comboLiftBadge(combo: ComboShape): string {
  const rate = combo.occurrences > 0 ? combo.deficits / combo.occurrences : 0
  const rest = combo.restDays > 0 ? combo.restDeficits / combo.restDays : 0
  if (rest <= 0) return 'mucho más'
  const ratio = rate / rest
  if (ratio >= 2.5) return 'más de 2×'
  if (ratio >= 1.95) return '2×'
  if (ratio >= 1.6) return 'casi 2×'
  return `${(Math.floor(ratio * 10) / 10).toFixed(1).replace('.', ',')}×`
}

/** La semana en puntos: llenos = días que ya lo juntaste; el total es lo que
 *  suelen tener tus mejores semanas. Sin referencia, solo lo hecho. Máx. 7. */
export function comboWeekDots(week: ComboWeek | null): boolean[] {
  if (!week) return []
  const total = Math.min(7, Math.max(week.typical ?? 0, week.done))
  return Array.from({ length: total }, (_, i) => i < week.done)
}

/** El titular: el hallazgo dicho, no el hábito. */
export function comboHeadline(combo: ComboShape): string {
  const list = joinList(combo.signals.map((s) => HABIT_PRESENT[s.key] ?? s.label.toLowerCase()))
  return `Cuando ${list}, cierras en déficit ${comboLift(combo)}.`
}

/** Cada hábito en corto, para nombrarlo en las filas y en la semana. */
const HABIT_SHORT: Record<string, string> = {
  sueno: 'sueño de 7 h',
  cuerpo: 'entreno',
  proteina: 'tu proteína',
  agua: 'tu agua completa',
}

/** "Con sueño de 7 h y entreno": la fila del combo NOMBRA los hábitos. Una
 *  usuaria real no entendió "Con los dos" y tuvo que preguntar (28 sep 2026). */
export function comboGroupLabel(combo: ComboShape): string {
  return `Con ${joinList(combo.signals.map((s) => HABIT_SHORT[s.key] ?? s.label.toLowerCase()))}`
}

/** "Tus demás días": el resto, sin acertijo ("Sin los dos" tampoco se leía). */
export function comboWithoutLabel(_combo: ComboShape): string {
  return 'Tus demás días'
}

/** Puntos de una fila de evidencia: un punto por día (lleno = déficit). Con más
 *  días que `max` se escala en proporción; el conteo real va al lado. */
export function evidenceDots(total: number, filled: number, max = 12): boolean[] {
  if (total <= 0) return []
  const n = Math.min(total, max)
  const on = total <= max ? filled : Math.round((filled / total) * n)
  return Array.from({ length: n }, (_, i) => i < on)
}

/** El gancho de la semana en la tarjeta: lo que llevas contra tus mejores semanas. */
export function comboWeekHook(week: ComboWeek | null): string | null {
  if (!week) return null
  const { done, typical } = week
  if (typical == null) {
    return done > 0 ? `Esta semana lo juntaste ${done} ${veces(done)}.` : null
  }
  if (done >= typical) {
    return `Esta semana ya lo juntaste ${done} ${veces(done)}, como tus mejores semanas.`
  }
  return done === 0
    ? `Esta semana todavía no lo juntas. Tus mejores semanas, ${typical}.`
    : `Esta semana lo juntaste ${done} ${veces(done)}. Tus mejores semanas, ${typical}.`
}

/* ── Hoy (la fila viva de la tarjeta) ──────────────────────────────── */

/** Estado de un hábito hoy:
 *  · on     → ya se cumplió
 *  · open   → todavía se puede (sin registro, o proteína/agua a medio día)
 *  · rest   → marcó descanso: no hay entreno que pedir (ni ✓ falso)
 *  · closed → ya quedó registrado sin llegar (dormiste menos de 7 h): no se
 *             puede cambiar hoy, así que tampoco se pide registrar */
export type ComboHabitStatus = 'on' | 'open' | 'rest' | 'closed'

export type ComboTodayHabit = {
  key: string
  status: ComboHabitStatus
  /** Lo que pasó, dicho corto ("7 h 30", "Fuerza", "96 g"); null si nada. */
  value: string | null
  /** Lo encendió el reloj (la tarjeta lleva su ícono). */
  fromWatch: boolean
}

function fmtSleep(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m}`
}

const WORKOUT_NAME: Record<string, string> = {
  fuerza: 'Fuerza',
  cardio: 'Cardio',
  caminata: 'Caminata',
}

/** Cómo va cada hábito del combo HOY, en el orden del combo. Nombra lo que
 *  pasó; nunca receta lo que falta. */
export function comboToday(
  signals: readonly DailySignals[],
  combo: ComboShape,
  opts: ComboOpts,
  todayIso: string,
): ComboTodayHabit[] {
  const s = signals.find((x) => x.day === todayIso)
  return combo.signals.map((sig): ComboTodayHabit => {
    const on = s ? habitTest(sig.key, opts)(s) : false
    const source =
      sig.key === 'sueno' ? s?.sleep_source : sig.key === 'cuerpo' ? s?.workout_source : null
    const fromWatch = on && source === 'wearable'
    switch (sig.key) {
      case 'sueno': {
        const min = s?.sleep_minutes ?? null
        return {
          key: sig.key,
          status: on ? 'on' : min != null && min > 0 ? 'closed' : 'open',
          value: min != null && min > 0 ? fmtSleep(min) : null,
          fromWatch,
        }
      }
      case 'cuerpo':
        return {
          key: sig.key,
          status: on ? 'on' : s?.rested ? 'rest' : 'open',
          value: on
            ? (WORKOUT_NAME[s?.workout_type ?? ''] ?? 'Hecho')
            : s?.rested
              ? 'Descanso'
              : null,
          fromWatch,
        }
      case 'proteina': {
        const g = s?.protein_g != null && s.protein_g > 0 ? Math.round(s.protein_g) : null
        return {
          key: sig.key,
          status: on ? 'on' : 'open',
          value: g != null ? `${g} g` : null,
          fromWatch,
        }
      }
      case 'agua': {
        const v = s?.water_glasses ?? 0
        return {
          key: sig.key,
          status: on ? 'on' : 'open',
          value: v > 0 ? `${v} ${v === 1 ? 'vaso' : 'vasos'}` : null,
          fromWatch,
        }
      }
      default:
        return { key: sig.key, status: on ? 'on' : 'open', value: null, fromWatch }
    }
  })
}

/* ── Tu día fuerte (sep 2026): la prueba en kcal y tus días reales ────── */

/** Cuánto quedas contra tu meta de calorías, en promedio: los días con el
 *  patrón contra tus demás días (negativo = abajo de la meta). La moneda que
 *  ella siente, en vez de dos proporciones que hay que comparar. Null sin meta
 *  o con menos de 3 días por lado (una comparación con un lado vacío no nace). */
export type ComboKcalGap = { withAvg: number; restAvg: number; withDays: number; restDays: number }

export function comboKcalGap(
  signals: readonly DailySignals[],
  combo: ComboShape,
  opts: ComboOpts,
): ComboKcalGap | null {
  const target = opts.calorieTarget ?? null
  if (target == null || target <= 0) return null
  const matches = comboMatches(combo, opts)
  // Solo días COMPLETOS: un día a medio registrar (300 kcal anotadas) hundía
  // el promedio de "otros días" y la prueba desmentía el patrón.
  const food = foodByDay(signals).filter((s) => dayQuality(s) === 'completo')
  const withD = food.filter(matches)
  const rest = food.filter((s) => !matches(s))
  if (withD.length < MIN_SIDE || rest.length < MIN_SIDE) return null
  const avgDelta = (xs: DailySignals[]) =>
    Math.round(xs.reduce((a, s) => a + (s.calories! - target), 0) / xs.length / 10) * 10
  const withAvg = avgDelta(withD)
  const restAvg = avgDelta(rest)
  // La prueba nunca contradice el hallazgo: si en kcal no se nota (o sale al
  // revés), no se publica y la tarjeta cae al conteo de días en déficit.
  if (withAvg >= restAvg) return null
  return { withAvg, restAvg, withDays: withD.length, restDays: rest.length }
}

/** "−310 kcal" / "+80 kcal" (signo tipográfico, miles con coma). */
export function fmtKcalDelta(n: number): string {
  const abs = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${n < 0 ? '−' : n > 0 ? '+' : ''}${abs} kcal`
}

const DOW_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const WORKOUT_SHORT: Record<string, string> = {
  fuerza: 'Fuerza',
  cardio: 'Cardio',
  caminata: 'Caminata',
}

export type ComboDayCard = {
  day: string
  /** "mar 16" */
  label: string
  sleepMinutes: number | null
  /** "Fuerza" / "Entreno" (null si ese día no entrenó). */
  workout: string | null
  /** Calorías contra la meta (negativo = abajo); null sin día completo o sin meta. */
  kcalDelta: number | null
  /** Cerró en déficit (la misma regla del hallazgo); null sin comida o sin meta. */
  deficit: boolean | null
  proteinG: number | null
}

/** Tus días reales con el patrón, el más reciente primero: la prueba como
 *  recuerdos ("ah sí, ese jueves") en vez de estadística. Máx. `max`. */
export function comboDayCards(
  signals: readonly DailySignals[],
  combo: ComboShape,
  opts: ComboOpts,
  max = 8,
): ComboDayCard[] {
  const target = opts.calorieTarget ?? null
  const byDay = new Map<string, DailySignals>()
  for (const s of signals) if (s.day) byDay.set(s.day, s)
  return [...combo.days]
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, max)
    .map((day) => {
      const s = byDay.get(day)
      // Un día a medio registrar no dice cuánto quedaste: sin número.
      const kcal = s && dayQuality(s) === 'completo' ? s.calories : null
      return {
        day,
        label: `${DOW_SHORT[weekdayMon(day)]} ${Number(day.slice(8, 10))}`,
        sleepMinutes: s?.sleep_minutes ?? null,
        workout: s?.trained ? (WORKOUT_SHORT[s.workout_type ?? ''] ?? 'Entreno') : null,
        kcalDelta: kcal != null && target != null && target > 0 ? kcal - target : null,
        deficit:
          s?.calories != null && s.calories > 0 && target != null && target > 0
            ? isDeficitDay(s.calories, target)
            : null,
        proteinG: s?.protein_g != null && s.protein_g > 0 ? Math.round(s.protein_g) : null,
      }
    })
}

/* ── El estado de la semana (criterio Apple: meta de TUS datos + lo que falta) ── */

export type ComboWeekState = 'reached' | 'onTrack' | 'short' | 'noRef'
export type ComboWeek = {
  /** Días de esta semana (lun a hoy) en que la combinación coincidió. */
  done: number
  /** Lo que suelen tener tus semanas fuertes en déficit; null sin referencia. */
  typical: number | null
  /** Días que quedan en la semana, contando hoy. */
  daysLeft: number
  state: ComboWeekState
}

export function comboWeek(
  signals: readonly DailySignals[],
  combo: ComboShape,
  opts: ComboOpts,
  todayIso: string,
): ComboWeek | null {
  const target = opts.calorieTarget ?? null
  if (target == null || target <= 0) return null
  const matches = comboMatches(combo, opts)
  const food = foodByDay(signals)
  const monday = addDaysIso(todayIso, -weekdayMon(todayIso))
  const done = food.filter((s) => s.day! >= monday && s.day! <= todayIso && matches(s)).length
  const daysLeft = 7 - weekdayMon(todayIso)

  // typical = días-de-combo por semana en sus semanas fuertes en déficit.
  const byWeek = new Map<string, { combo: number; food: number; deficit: number }>()
  for (const s of food) {
    const wk = addDaysIso(s.day!, -weekdayMon(s.day!))
    const e = byWeek.get(wk) ?? { combo: 0, food: 0, deficit: 0 }
    e.food += 1
    if (matches(s)) e.combo += 1
    if (isDeficitDay(s.calories, target)) e.deficit += 1
    byWeek.set(wk, e)
  }
  const strong = [...byWeek.values()].filter(
    (e) => e.food >= 3 && e.combo >= 1 && e.deficit / e.food >= 0.5,
  )
  if (strong.length < 2) return { done, typical: null, daysLeft, state: 'noRef' }
  const counts = strong.map((e) => e.combo).sort((a, b) => a - b)
  const typical = Math.max(1, counts[Math.floor(counts.length / 2)]!)
  const state: ComboWeekState =
    done >= typical ? 'reached' : typical - done > daysLeft ? 'short' : 'onTrack'
  return { done, typical, daysLeft, state }
}

/** La línea de estado bajo el foco. Sin culpa ni cuenta regresiva (nada de
 *  "quedan N días"): si ya no alcanza, lo dice y suma igual. */
export function comboWeekLine(week: ComboWeek | null): string | null {
  if (!week) return null
  const { done, typical, state } = week
  switch (state) {
    case 'reached':
      return `Esta semana ya lo juntaste ${done} ${veces(done)}, lo que suelen tener tus mejores semanas.`
    case 'onTrack':
      return done === 0
        ? `Tus mejores semanas lo juntan ${typical} ${veces(typical!)}. Esta semana todavía cabe.`
        : `Esta semana van ${done} de ${typical}.`
    case 'short':
      return done === 0
        ? 'Esta semana ya no llega a lo de tus mejores semanas. Cada día que lo juntes suma igual.'
        : `Esta semana van ${done}. Ya no llega a ${typical}, y cada día que lo juntes suma igual.`
    case 'noRef':
      return done === 0
        ? 'Esta semana todavía no coincide.'
        : `Esta semana ya lo juntaste ${done} ${veces(done)}.`
  }
}

/** La semana de la tarjeta como MEDIDOR (sep 2026, "no cuadra"): estrellas por
 *  encender contra tus mejores semanas, tipo anillo. Solo cuenta lo que sí
 *  pasó: nunca abre con "0", nunca cuenta días que quedan. Sin referencia, solo
 *  lo encendido y sin meta. */
export type ComboWeekMeter = {
  /** Llenas = días que ya lo juntaste; el total, lo de tus mejores semanas. */
  stars: boolean[]
  /** "1 de 2" (null cuando no hay nada que contar). */
  count: string | null
  note: string | null
  /** Ya es una de tus mejores semanas (va en oro). */
  reached: boolean
}

export function comboWeekMeter(week: ComboWeek | null): ComboWeekMeter | null {
  if (!week) return null
  const { done, typical, state } = week
  const stars = comboWeekDots(week)
  if (typical == null) {
    return {
      stars,
      count: null,
      note: done > 0 ? `${done} ${veces(done)} esta semana` : null,
      reached: false,
    }
  }
  const count = done > 0 ? `${done} de ${typical}` : null
  switch (state) {
    case 'reached':
      return { stars, count: null, note: 'Ya es una de tus mejores semanas.', reached: true }
    case 'short':
      return { stars, count, note: 'Cada día que lo juntes suma.', reached: false }
    default:
      return {
        stars,
        count,
        note:
          done > 0 && typical - done === 1
            ? 'Con uno más, igualas tus mejores semanas.'
            : `Tus mejores semanas lo juntan ${typical} ${veces(typical)}.`,
        reached: false,
      }
  }
}

/* ── Los hechos ─────────────────────────────────────────────────────── */

export function comboFacts(
  signals: readonly DailySignals[],
  combo: ComboShape,
  opts: ComboOpts,
  todayIso: string,
): ComboFact[] {
  const target = opts.calorieTarget ?? null
  if (target == null || target <= 0) return []
  const food = foodByDay(signals)
  const matches = comboMatches(combo, opts)
  const inDeficit = (s: DailySignals) => isDeficitDay(s.calories, target)
  const comboDays = food.filter(matches)
  const facts: ComboFact[] = []
  const keys = combo.signals.map((s) => s.key)

  // F2 · sin uno de los hábitos: ¿qué pasa cuando la combinación queda a medias?
  for (const k of keys) {
    const others = keys.filter((o) => o !== k)
    if (others.length === 0) continue
    const tests = others.map((o) => habitTest(o, opts))
    const hasK = habitTest(k, opts)
    const days = food.filter((s) => tests.every((t) => t(s)) && !hasK(s))
    if (days.length < MIN_SIDE) continue
    const d = days.filter(inDeficit).length
    const n = days.length
    const single = others.length === 1
    facts.push({
      id: `sin:${k}`,
      text: single
        ? `Los días que solo ${HABIT_PAST[others[0]!] ?? others[0]}, sin ${HABIT_NOUN[k] ?? k}: ${d} de ${n} cerraron en déficit.`
        : `Los días con todo menos ${HABIT_NOUN[k] ?? k}: ${d} de ${n} cerraron en déficit.`,
      question: single
        ? `¿Y si solo ${HABIT_Q[others[0]!] ?? others[0]}?`
        : `¿Y sin ${HABIT_NOUN[k] ?? k}?`,
      days: days.map((s) => s.day!),
    })
  }

  // F3 · los días con la combinación que NO cerraron en déficit.
  if (comboDays.length >= MIN_SIDE) {
    const misses = comboDays.filter((s) => !inDeficit(s))
    const n = comboDays.length
    if (misses.length === 0) {
      facts.push({
        id: 'misses',
        text: `Los ${n} días que lo juntaste cerraron en déficit. Ninguno se salió.`,
        question: '¿Alguna vez no funcionó?',
        days: [],
      })
    } else {
      const over = misses.filter((s) => (s.calories ?? 0) > target).length
      const under = misses.length - over
      const parts: string[] = []
      if (over > 0) parts.push(`${over} ${over === 1 ? 'pasó' : 'pasaron'} tu meta`)
      if (under > 0)
        parts.push(`${under} ${under === 1 ? 'quedó' : 'quedaron'} debajo de tu rango sano`)
      facts.push({
        id: 'misses',
        text: `De tus ${n} días con este patrón, ${misses.length} no cerraron en déficit: ${joinList(parts)}.`,
        question: '¿Y los días que no funcionó?',
        days: misses.map((s) => s.day!),
      })
    }
  }

  // F4 · en qué días de la semana cae.
  if (comboDays.length >= 5) {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    for (const s of comboDays) counts[weekdayMon(s.day!)]! += 1
    const n = comboDays.length
    const weekend = counts[5]! + counts[6]!
    const top = counts.indexOf(Math.max(...counts))
    const c = counts[top]!
    let text: string | null = null
    if (c >= MIN_SIDE && c / n >= 0.35) {
      text = `Donde más aparece es ${WEEKDAY_PLURAL[top]}: ${c} de sus ${n} días.`
    } else if (weekend === 0 && n >= 6) {
      text = `Tus ${n} días con este patrón fueron entre semana. Ninguno cayó en fin de semana.`
    }
    if (text) {
      facts.push({ id: 'weekday', text, question: '¿Qué días me pasa más?', days: [] })
    }
  }

  // F5 · reciente contra antes (dos semanas contra las dos anteriores).
  {
    const from = addDaysIso(todayIso, -13)
    const prevFrom = addDaysIso(todayIso, -27)
    const a = comboDays.filter((s) => s.day! >= from && s.day! <= todayIso).length
    const b = comboDays.filter((s) => s.day! >= prevFrom && s.day! < from).length
    const prevHasData = food.some((s) => s.day! >= prevFrom && s.day! < from)
    if (a + b >= MIN_SIDE && prevHasData) {
      facts.push({
        id: 'recency',
        text: `En las últimas dos semanas lo juntaste ${a} ${veces(a)}; en las dos anteriores, ${b}.`,
        question: '¿Lo hago más que antes?',
        days: [],
      })
    }
  }

  // F7 · cada hábito, estos 30 días contra los 30 anteriores (el de mayor cambio).
  {
    const from = addDaysIso(todayIso, -29)
    const prevFrom = addDaysIso(todayIso, -59)
    const all = new Map<string, DailySignals>()
    for (const s of signals) if (s.day) all.set(s.day, s)
    const rows = [...all.values()]
    const prevRows = rows.filter((s) => s.day! >= prevFrom && s.day! < from)
    const curRows = rows.filter((s) => s.day! >= from && s.day! <= todayIso)
    if (prevRows.length >= 10 && curRows.length >= 10) {
      let best: { k: string; a: number; b: number } | null = null
      for (const k of keys) {
        const t = habitTest(k, opts)
        const a = curRows.filter(t).length
        const b = prevRows.filter(t).length
        if (Math.abs(a - b) < 2) continue
        if (!best || Math.abs(a - b) > Math.abs(best.a - best.b)) best = { k, a, b }
      }
      if (best) {
        facts.push({
          id: `trend:${best.k}`,
          text: `Días que ${HABIT_PAST[best.k] ?? best.k}: ${best.a} en los últimos 30, ${best.b} en los 30 anteriores.`,
          question: HABIT_TREND_Q[best.k] ?? '¿Cambió algo?',
          days: [],
        })
      }
    }
  }

  return facts
}

/* ── El día tocado desde el chat ─────────────────────────────────────── */

export type ComboDayDetail = {
  date: string
  sleepMinutes: number | null
  trained: boolean
  workoutType: string | null
  /** null = sin comida registrada ese día (no se puede decir). */
  deficit: boolean | null
  comboHit: boolean
}

export function comboDayDetail(
  signals: readonly DailySignals[],
  combo: ComboShape,
  opts: ComboOpts,
  date: string,
): ComboDayDetail {
  const s = signals.find((x) => x.day === date) ?? null
  const target = opts.calorieTarget ?? null
  const hasFood = s != null && s.calories != null && s.calories > 0
  return {
    date,
    sleepMinutes: s?.sleep_minutes ?? null,
    trained: s?.trained === true,
    workoutType: s?.workout_type ?? null,
    deficit: hasFood && target != null && target > 0 ? isDeficitDay(s!.calories, target) : null,
    comboHit: s != null && comboMatches(combo, opts)(s),
  }
}
