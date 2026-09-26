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
    lines.push(`Tus otros días: ${combo.restDeficits} de ${combo.restDays} en déficit.`)
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

/** El titular: el hallazgo dicho, no el hábito. */
export function comboHeadline(combo: ComboShape): string {
  const list = joinList(combo.signals.map((s) => HABIT_PRESENT[s.key] ?? s.label.toLowerCase()))
  return `Cuando ${list}, cierras en déficit ${comboLift(combo)}.`
}

/** "Con los dos" / "Con los tres": la fila del combo en la evidencia. */
export function comboGroupLabel(combo: ComboShape): string {
  const n = combo.signals.length
  return n === 2
    ? 'Con los dos'
    : n === 3
      ? 'Con los tres'
      : n === 4
        ? 'Con los cuatro'
        : 'Con esto'
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

/** La línea de estado bajo el foco. Sin culpa: si ya no alcanza, lo dice y suma igual. */
export function comboWeekLine(week: ComboWeek | null): string | null {
  if (!week) return null
  const { done, typical, daysLeft, state } = week
  switch (state) {
    case 'reached':
      return `Esta semana ya lo juntaste ${done} ${veces(done)}, lo que suelen tener tus mejores semanas.`
    case 'onTrack':
      return done === 0
        ? `Tus mejores semanas lo juntan ${typical} ${veces(typical!)}. Esta semana todavía caben: quedan ${daysLeft} ${dias(daysLeft)}.`
        : `Esta semana van ${done} de ${typical}. Quedan ${daysLeft} ${dias(daysLeft)}.`
    case 'short':
      return done === 0
        ? 'Esta semana ya no llega a lo de tus mejores semanas. Cada día que lo juntes suma igual.'
        : `Esta semana van ${done}. Ya no llega a ${typical}, y cada día que lo juntes suma igual.`
    case 'noRef':
      return done === 0
        ? `Esta semana todavía no coincide. Quedan ${daysLeft} ${dias(daysLeft)}.`
        : `Esta semana ya lo juntaste ${done} ${veces(done)}.`
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
