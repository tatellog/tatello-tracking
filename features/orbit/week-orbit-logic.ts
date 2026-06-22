/*
 * Órbita · Semana — "¿Qué se repitió esta semana?"
 *
 * La vista responde con EVIDENCIA, no predicción ni IA: cuántos días
 * apareció cada hábito esta semana (lunes→hoy). Todo se deriva de forma
 * determinística de daily_signals. Cinco dimensiones — Movimiento,
 * Comida, Proteína, Agua, Sueño — cada una con su conteo de días
 * presentes; ese conteo dimensiona la galaxia y ordena los bloques.
 *
 * Lógica pura y testeable; la capa visual la consume en WeekSegment.
 * Semana ISO (lunes-primero) para que la línea L·M·M·J·V·S·D del diseño
 * calce con los datos. `todayIso` se inyecta para mantenerla pura.
 */
import type { DailySignals } from './api'
import { signalCount } from './week-logic'

export type WeekDimKey = 'movimiento' | 'comida' | 'proteina' | 'agua' | 'sueno'

/** El orden canónico — posiciones estables de los orbes en la galaxia. */
export const WEEK_DIM_ORDER: readonly WeekDimKey[] = [
  'movimiento',
  'comida',
  'proteina',
  'agua',
  'sueno',
]

const LABEL: Record<WeekDimKey, string> = {
  movimiento: 'Movimiento',
  comida: 'Comida',
  proteina: 'Proteína',
  agua: 'Agua',
  sueno: 'Sueño',
}

/** Contexto para resolver "presente": la meta de proteína hace que la
 *  dimensión Proteína cuente "alcanzaste tu meta", no solo "registraste". */
export type WeekDimCtx = { proteinTarget: number | null }

/** ¿La dimensión apareció ese día? Determinístico, sin umbrales de brillo:
 *  registro directo de la señal. */
const PRESENT: Record<WeekDimKey, (s: DailySignals, ctx: WeekDimCtx) => boolean> = {
  movimiento: (s) => s.trained === true,
  comida: (s) => (s.meal_count ?? 0) > 0,
  proteina: (s, ctx) =>
    ctx.proteinTarget != null
      ? s.protein_g != null && s.protein_g >= ctx.proteinTarget
      : (s.protein_g ?? 0) > 0,
  agua: (s) => (s.water_glasses ?? 0) > 0,
  sueno: (s) => s.sleep_minutes != null,
}

export type WeekDimension = {
  key: WeekDimKey
  label: string
  /** Días presentes esta semana. */
  present: number
  /** Días transcurridos de la semana (lun→hoy) — el denominador. */
  total: number
  /** present / total (0..1) — dimensiona el orbe. */
  ratio: number
}

/* ── fechas ISO (lunes-primero), puras y sin locale ──────────────── */

/** 1 = lunes … 7 = domingo, para un 'YYYY-MM-DD'. */
function isoWeekday(iso: string): number {
  const g = new Date(`${iso}T00:00:00Z`).getUTCDay() // 0=dom..6=sáb
  return g === 0 ? 7 : g
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** El lunes de la semana de `iso`. */
export function mondayOf(iso: string): string {
  return addDays(iso, -(isoWeekday(iso) - 1))
}

/** Rango [lunes, hoy] de la semana actual — para la query de señales. */
export function isoWeekRange(todayIso: string): { from: string; to: string } {
  return { from: mondayOf(todayIso), to: todayIso }
}

/** Rango de DOS semanas [lunes de la semana pasada, hoy] — para comparar la
 *  semana en curso con la anterior (Señal Naciente). */
export function isoTwoWeekRange(todayIso: string): { from: string; to: string } {
  return { from: addDays(mondayOf(todayIso), -7), to: todayIso }
}

/* ── dimensiones ─────────────────────────────────────────────────── */

/**
 * Las 5 dimensiones con su conteo de días presentes esta semana, en el
 * orden canónico (posiciones estables en la galaxia). `total` = días
 * transcurridos (lun→hoy); así a media semana "4/4" es honesto y no
 * "4/7" castigando los días que aún no llegan.
 */
export function buildWeekDimensions(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): WeekDimension[] {
  const monday = mondayOf(todayIso)
  const inWeek = signals.filter((s) => s.day != null && s.day >= monday && s.day <= todayIso)
  const total = isoWeekday(todayIso) // lun→hoy inclusivo
  return WEEK_DIM_ORDER.map((key) => {
    const present = inWeek.reduce((n, s) => (PRESENT[key](s, ctx) ? n + 1 : n), 0)
    return { key, label: LABEL[key], present, total, ratio: total > 0 ? present / total : 0 }
  })
}

/* ── "Lo que más se repitió" / "Lo que necesita atención" ─────────── */

export type WeekHighlight = {
  dim: WeekDimension
  /** Frase cálida de evidencia (sin prescribir). */
  line: string
}

const MOST_LINE: Record<WeekDimKey, string> = {
  movimiento: 'Tu cuerpo se movió la mayor parte de la semana.',
  comida: 'Registraste tus comidas casi todos los días.',
  proteina: 'Alcanzaste tu proteína de forma constante.',
  agua: 'Mantuviste tu agua de forma constante.',
  sueno: 'Registraste tu sueño de forma constante.',
}

/** La dimensión con MÁS días presentes (empate → orden canónico). `null`
 *  si nada apareció todavía. */
export function mostRepeated(dims: readonly WeekDimension[]): WeekHighlight | null {
  let top = dims[0]
  if (!top) return null
  for (const d of dims) if (d.present > top.present) top = d
  if (top.present === 0) return null
  return { dim: top, line: MOST_LINE[top.key] }
}

/** La dimensión con MENOS días presentes — la que pide atención. Se
 *  suprime cuando TODAS aparecieron todos los días (semana redonda: no
 *  hay nada que señalar) o cuando aún no hay ninguna evidencia. */
export function needsAttention(dims: readonly WeekDimension[]): WeekHighlight | null {
  let max = dims[0]
  let low = dims[0]
  if (!max || !low) return null
  for (const d of dims) {
    if (d.present > max.present) max = d
    if (d.present < low.present) low = d
  }
  if (max.present === 0) return null // sin evidencia: aún no hay "más/menos"
  if (low.present === low.total) return null // todo perfecto: nada que atender
  return { dim: low, line: 'Fue la dimensión menos presente esta semana.' }
}

/* ── Señal Naciente — qué emerge vs. la semana pasada ─────────────── */

export type RisingSignal = {
  key: WeekDimKey
  label: string
  /** Días presentes en la MISMA ventana (mismos días transcurridos) la
   *  semana pasada vs. esta. */
  last: number
  current: number
}

// Cuánto debe crecer para llamarlo "naciente" — evita celebrar ruido (0→1).
const MIN_RISE = 2

/**
 * La dimensión que MÁS creció respecto a la semana pasada, comparando la
 * misma ventana (lun→hoy esta semana vs. lun→mismo-día la anterior). Es la
 * "Señal Naciente" del glosario: un cambio que emerge en tus propios datos.
 * `signals` debe cubrir ambas semanas. `null` si la semana pasada no tiene
 * registros (nada con qué comparar) o si nada creció lo suficiente.
 */
export function risingSignal(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): RisingSignal | null {
  const lastTodayIso = addDays(todayIso, -7)
  const lastDims = buildWeekDimensions(signals, lastTodayIso, ctx)
  if (!lastDims.some((d) => d.present > 0)) return null // sin base de comparación

  const thisDims = buildWeekDimensions(signals, todayIso, ctx)
  let best: (RisingSignal & { delta: number }) | null = null
  for (const t of thisDims) {
    const l = lastDims.find((d) => d.key === t.key)
    if (!l) continue
    const delta = t.present - l.present
    if (delta >= MIN_RISE && (best == null || delta > best.delta)) {
      best = { key: t.key, label: t.label, last: l.present, current: t.present, delta }
    }
  }
  return best ? { key: best.key, label: best.label, last: best.last, current: best.current } : null
}

/* ── "Tu semana en una línea" ─────────────────────────────────────── */

export type DayCellState = 'present' | 'absent' | 'future'
export type DayCell = { letter: string; date: string; state: DayCellState }

const WEEKDAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const

/**
 * Los 7 días de la semana (lun→dom) con su estado de APARICIÓN: presente
 * (registraste algo), ausente (día en silencio ya transcurrido) o futuro
 * (aún no llega — se pinta tenue, nunca como falla).
 */
export function buildAppearanceLine(signals: readonly DailySignals[], todayIso: string): DayCell[] {
  const monday = mondayOf(todayIso)
  const appeared = new Set(
    signals.filter((s) => s.day != null && signalCount(s) > 0).map((s) => s.day as string),
  )
  return WEEKDAY_LETTERS.map((letter, i) => {
    const date = addDays(monday, i)
    const state: DayCellState =
      date > todayIso ? 'future' : appeared.has(date) ? 'present' : 'absent'
    return { letter, date, state }
  })
}

/** Cuántos días apareciste esta semana (registros, días transcurridos). */
export function appearanceCount(cells: readonly DayCell[]): number {
  return cells.filter((c) => c.state === 'present').length
}

/* ── Readout por dimensión (info al enfocar una estrella, como Día) ──── */

/** La línea L·M·M·J·V·S·D de UNA dimensión: en qué días apareció ese hábito. */
export function dimensionLine(
  signals: readonly DailySignals[],
  todayIso: string,
  key: WeekDimKey,
  ctx: WeekDimCtx,
): DayCell[] {
  const monday = mondayOf(todayIso)
  const present = new Set(
    signals.filter((s) => s.day != null && PRESENT[key](s, ctx)).map((s) => s.day as string),
  )
  return WEEKDAY_LETTERS.map((letter, i) => {
    const date = addDays(monday, i)
    const state: DayCellState =
      date > todayIso ? 'future' : present.has(date) ? 'present' : 'absent'
    return { letter, date, state }
  })
}

const DIM_DETAIL: Record<WeekDimKey, string> = {
  movimiento: 'Tu cuerpo se movió',
  comida: 'Registraste comida',
  proteina: 'Alcanzaste tu proteína',
  agua: 'Tomaste agua',
  sueno: 'Registraste tu sueño',
}

/** Frase de evidencia para el readout de una dimensión enfocada. */
export function dimDetail(key: WeekDimKey, present: number, total: number): string {
  return `${DIM_DETAIL[key]} ${present} de ${total} ${total === 1 ? 'día' : 'días'} esta semana.`
}

/* ── "Otros hallazgos" ────────────────────────────────────────────── */

export type WeekFinding = { key: string; text: string }

/** Racha más larga de días CONSECUTIVOS con comida registrada (lun→hoy). */
function longestMealStreak(signals: readonly DailySignals[], todayIso: string): number {
  const monday = mondayOf(todayIso)
  const withMeal = new Set(
    signals.filter((s) => s.day != null && (s.meal_count ?? 0) > 0).map((s) => s.day as string),
  )
  const elapsed = isoWeekday(todayIso)
  let best = 0
  let run = 0
  for (let i = 0; i < elapsed; i++) {
    if (withMeal.has(addDays(monday, i))) {
      run += 1
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  return best
}

const SLEEP_DIFF_MIN = 20 // margen mínimo para afirmar "dormiste mejor"

/**
 * Hallazgos determinísticos de la semana — solo los que se sostienen con
 * datos reales (nunca predicción). Orden: correlación → racha → aparición.
 */
export function buildWeekFindings(
  signals: readonly DailySignals[],
  todayIso: string,
): WeekFinding[] {
  const monday = mondayOf(todayIso)
  const inWeek = signals.filter((s) => s.day != null && s.day >= monday && s.day <= todayIso)
  const out: WeekFinding[] = []

  // 1 · Sueño en días de entreno vs sin entreno (co-ocurrencia, no causa).
  const trainedSleep: number[] = []
  const untrainedSleep: number[] = []
  for (const s of inWeek) {
    if (s.sleep_minutes == null) continue
    if (s.trained === true) trainedSleep.push(s.sleep_minutes)
    else untrainedSleep.push(s.sleep_minutes)
  }
  if (trainedSleep.length >= 2 && untrainedSleep.length >= 1) {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    if (avg(trainedSleep) - avg(untrainedSleep) >= SLEEP_DIFF_MIN) {
      out.push({ key: 'trained-sleep', text: 'Dormiste mejor los días que entrenaste.' })
    }
  }

  // 2 · Mejor racha de comida.
  const streak = longestMealStreak(signals, todayIso)
  if (streak >= 2) {
    out.push({
      key: 'meal-streak',
      text: `Tu mejor racha de comida fue de ${streak} ${streak === 1 ? 'día' : 'días'}.`,
    })
  }

  // 3 · Días que apareciste.
  const appeared = new Set(inWeek.filter((s) => signalCount(s) > 0).map((s) => s.day as string))
    .size
  if (appeared > 0) {
    out.push({
      key: 'appeared',
      text: `Apareciste ${appeared} ${appeared === 1 ? 'día' : 'días'} esta semana.`,
    })
  }

  return out
}
