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
import { isDeficitDay } from './deficit'
import { signalCount } from './week-logic'

export type WeekDimKey = 'movimiento' | 'comida' | 'proteina' | 'agua' | 'sueno' | 'energia'

/** El orden canónico — posiciones estables de los orbes en la galaxia.
 *  v2.2: Energía SALE de la galaxia (coherencia con Mes, que ya la retiró: es
 *  calorías consumidas − gastadas, no una señal propia; era el planeta que más
 *  confundió y el único naranja-de-alarma). Sigue existiendo como WeekDimKey
 *  para la evidencia/probes, pero ya no es un planeta. Quedan 5 señales. */
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
  energia: 'Energía',
}

/** Contexto para resolver "presente": la meta de proteína hace que la
 *  dimensión Proteína cuente "alcanzaste tu meta", no solo "registraste". La
 *  meta calórica (opcional) habilita la evidencia de déficit; sin ella, el
 *  déficit simplemente no aparece (degradación segura). */
export type WeekDimCtx = { proteinTarget: number | null; calorieTarget?: number | null }

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
  energia: (s) => s.energy != null,
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
  energia: 'Registraste tu energía de forma constante.',
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

/* ── §0 · Todavía puedo + dirección (la ventana abierta) ──────────────
 * Lo que SOLO Semana da: (a) los días que faltan (lienzo por delante, nunca
 * cuota) y (b) el RUMBO de la semana vs la misma ventana de la pasada
 * (movimiento, no conteo). Ni Día (un punto) ni Mes (una foto) lo dan.
 * Ver docs/orbita-semana-spec.md §0. */

/** Días de la semana que faltan DESPUÉS de hoy. Lunes → 6; miércoles → 4;
 *  domingo → 0. Es lienzo por delante, no una cuota a alcanzar. */
export function daysAhead(todayIso: string): number {
  return 7 - isoWeekday(todayIso)
}

export type WeekDirectionState = 'rising' | 'steady' | 'softer'

export type WeekDirection = {
  /** Rumbo de la semana en curso vs la MISMA ventana de la pasada. */
  state: WeekDirectionState
  /** La dimensión que más creció, para la línea de evidencia (o null). */
  topRise: RisingSignal | null
}

// Dimensiones que cuentan para el "ritmo". Energía queda FUERA (coherencia con
// Mes: es calorías consumidas − gastadas, no una señal propia).
const RHYTHM_DIMS: readonly WeekDimKey[] = ['movimiento', 'comida', 'proteina', 'agua', 'sueno']

// Cuánto debe moverse el ritmo agregado para no ser "sostenido" (evita ruido).
const DIRECTION_BAND = 2

/**
 * El RUMBO de la semana en curso comparada con la misma ventana de la anterior
 * (lun→hoy vs lun→mismo-día). NO es un conteo: es dirección — subiendo /
 * sostenido / más suave — el "movimiento" que la usuaria pide (Mes da la foto,
 * Semana da el movimiento). Métrica = suma de días presentes en RHYTHM_DIMS (el
 * "ritmo" de la semana). `null` si la semana pasada no tiene con qué comparar
 * (primera semana medible) → no se muestra dirección.
 */
export function weekDirection(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): WeekDirection | null {
  const lastTodayIso = addDays(todayIso, -7)
  const lastDims = buildWeekDimensions(signals, lastTodayIso, ctx)
  if (!lastDims.some((d) => d.present > 0)) return null // sin base de comparación
  const thisDims = buildWeekDimensions(signals, todayIso, ctx)
  const rhythm = (dims: readonly WeekDimension[]): number =>
    dims.reduce((n, d) => (RHYTHM_DIMS.includes(d.key) ? n + d.present : n), 0)
  const delta = rhythm(thisDims) - rhythm(lastDims)
  const state: WeekDirectionState =
    delta >= DIRECTION_BAND ? 'rising' : delta <= -DIRECTION_BAND ? 'softer' : 'steady'
  return { state, topRise: risingSignal(signals, todayIso, ctx) }
}

/* ── §S · La silueta de los 7 días (la forma del tramo) ───────────────
 * El ritmo hecho imagen: lo único que solo la semana muestra ("empecé fuerte y
 * me caí el jueves"). Altura/luz = plenitud del día (signalCount, la misma
 * "richness" que ya usa weeklyRhythms); día en déficit = celda que emite luz
 * oro (misma gramática "encendido vs en reposo" del calendario de Mes → los tres
 * tabs riman visualmente). Futuro = polvo tenue, nunca falla. Ver §S del spec. */

export type WeekSilhouetteCell = {
  letter: string
  date: string
  state: 'past' | 'today' | 'future'
  /** 0..1 — plenitud del día (cuánto registraste), para la altura/luz. */
  fullness: number
  /** ¿día en déficit? → la celda emite luz oro. */
  deficit: boolean
}

// Señales para altura COMPLETA (signalCount máx real ~6; 5 = un día lleno).
const SILHOUETTE_FULL = 5

/** Los 7 días (lun→dom) con su plenitud y si cerraron en déficit. Los días
 *  futuros van tenues (fullness 0), nunca como falla. */
export function weekSilhouette(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): WeekSilhouetteCell[] {
  const monday = mondayOf(todayIso)
  const byDay = new Map(signals.filter((s) => s.day != null).map((s) => [s.day as string, s]))
  return WEEKDAY_LETTERS.map((letter, i) => {
    const date = addDays(monday, i)
    const state: WeekSilhouetteCell['state'] =
      date > todayIso ? 'future' : date === todayIso ? 'today' : 'past'
    const sig = byDay.get(date) ?? null
    const fullness = state === 'future' ? 0 : Math.min(1, signalCount(sig) / SILHOUETTE_FULL)
    const deficit =
      state !== 'future' && sig != null && ctx.calorieTarget != null
        ? isDeficitDay(sig.calories, ctx.calorieTarget)
        : false
    return { letter, date, state, fullness, deficit }
  })
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
  energia: 'Registraste tu energía',
}

/** Frase de evidencia para el readout de una dimensión enfocada. */
export function dimDetail(key: WeekDimKey, present: number, total: number): string {
  return `${DIM_DETAIL[key]} ${present} de ${total} ${total === 1 ? 'día' : 'días'} esta semana.`
}

/** Observación neutra del panel de una dimensión enfocada (sin prescribir). */
export function dimObservation(present: number, total: number): string {
  if (total <= 0 || present <= 0) return 'Aún no aparece esta semana.'
  const ratio = present / total
  if (ratio >= 0.85) return 'Apareció casi toda la semana.'
  if (ratio >= 0.5) return 'Apareció la mayor parte de la semana.'
  return 'Apareció algunos días.'
}

/**
 * §2 · El puente hábito↔peso para el panel de foco: de los días en que ESTE
 * hábito apareció, cuántos cerraron TAMBIÉN en déficit. Responde "¿por qué este
 * hábito importa para mi peso?" con sus propios datos — es lo que hace que la
 * galaxia se sienta progreso y no solo hábitos. Solo para dims de
 * TRANSFORMACIÓN (proteína, movimiento) y con meta calórica. OBSERVACIONAL
 * (co-ocurrencia "junto a"), nunca causal. Usa el piso sano de `isDeficitDay`.
 * `null` si no hay señal suficiente (no inventar).
 */
export function dimDeficitBridge(
  key: WeekDimKey,
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): string | null {
  if (ctx.calorieTarget == null || ctx.calorieTarget <= 0) return null
  if (key !== 'proteina' && key !== 'movimiento') return null
  const c = (pred: (s: DailySignals) => boolean) => countDays(signals, todayIso, pred)
  const dimDays = c((s) => PRESENT[key](s, ctx))
  if (dimDays < 2) return null
  const both = c((s) => PRESENT[key](s, ctx) && isDeficitDay(s.calories, ctx.calorieTarget))
  if (both < 2) return null
  const subj = key === 'proteina' ? 'Tu proteína' : 'Tu movimiento'
  // "junto a tu déficit … esta semana" — paralelo al sistema de co-ocurrencias
  // del archivo (voice-and-copy); observacional, nunca causal.
  return `${subj} apareció junto a tu déficit ${both} de ${dimDays} ${veces(both)} esta semana.`
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

// Mínimo de días presentes para celebrar la aparición como CONSTANCIA. Por
// debajo no se muestra (un conteo bajo se lee como reproche, no como dato).
const APPEARED_CONSTANCY_MIN = 4

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

  // 3 · Días que apareciste — SOLO como señal de constancia (positiva). Un
  // "Apareciste 1 día" no informa y se lee como un puntaje bajo; solo lo
  // surfaceamos cuando estuviste presente la mayor parte de la semana. Por
  // debajo del umbral no mostramos nada (mejor vacío que un dato hueco).
  const appeared = new Set(inWeek.filter((s) => signalCount(s) > 0).map((s) => s.day as string))
    .size
  if (appeared >= APPEARED_CONSTANCY_MIN) {
    out.push({
      key: 'appeared',
      text: `Estuviste presente ${appeared} días esta semana. Tu ritmo se nota.`,
    })
  }

  return out
}

/* ════════════════════════════════════════════════════════════════════
 * Órbita Semana v1 (sin IA) — "¿Qué descubriste sobre ti esta semana?".
 * Cada conclusión sale de daily_signals y se puede explicar con evidencia.
 * No interpreta, no diagnostica, no inventa. Ver docs/orbita-semana-spec.md.
 * ════════════════════════════════════════════════════════════════════ */

function dayWord(n: number): string {
  return n === 1 ? 'día' : 'días'
}

/** Cuenta días (lun→hoy) cuyo registro cumple un predicado. */
function countDays(
  signals: readonly DailySignals[],
  todayIso: string,
  pred: (s: DailySignals) => boolean,
): number {
  const monday = mondayOf(todayIso)
  const seen = new Set<string>()
  for (const s of signals) {
    if (s.day == null || s.day < monday || s.day > todayIso) continue
    if (pred(s)) seen.add(s.day)
  }
  return seen.size
}

/* ── Señales de evidencia + co-ocurrencia ──────────────────────────────
 * Más allá de las 6 dimensiones de la galaxia, el descubrimiento principal
 * razona sobre señales de evidencia que incluyen el DÉFICIT (calorías) y el
 * SUEÑO de calidad (>7 h). Cada una es un predicado determinístico por día.
 */

const SLEEP_7H_MIN = 420 // minutos para "noche de más de 7 h"

/** Llaves de señal sobre las que se construye la evidencia: las dimensiones de
 *  la galaxia + déficit + sueño de calidad. */
export type EvidenceKey = WeekDimKey | 'deficit' | 'sleep7h'

const EVIDENCE_PRED: Record<EvidenceKey, (s: DailySignals, ctx: WeekDimCtx) => boolean> = {
  ...PRESENT,
  deficit: (s, ctx) => isDeficitDay(s.calories, ctx.calorieTarget),
  sleep7h: (s) => s.sleep_minutes != null && s.sleep_minutes >= SLEEP_7H_MIN,
}

const EVIDENCE_LABEL: Record<EvidenceKey, string> = {
  ...LABEL,
  deficit: 'Déficit',
  sleep7h: 'Sueño +7 h',
}

/** La línea L·M·M·J·V·S·D de CUALQUIER señal de evidencia (predicado): en qué
 *  días apareció. Generaliza `dimensionLine` a déficit y sueño de calidad. */
export function signalLine(
  signals: readonly DailySignals[],
  todayIso: string,
  key: EvidenceKey,
  ctx: WeekDimCtx,
): DayCell[] {
  const monday = mondayOf(todayIso)
  const pred = EVIDENCE_PRED[key]
  const present = new Set(
    signals.filter((s) => s.day != null && pred(s, ctx)).map((s) => s.day as string),
  )
  return WEEKDAY_LETTERS.map((letter, i) => {
    const date = addDays(monday, i)
    const state: DayCellState =
      date > todayIso ? 'future' : present.has(date) ? 'present' : 'absent'
    return { letter, date, state }
  })
}

/* Pares de co-ocurrencia que el descubrimiento principal evalúa. NO incluye
 * comida×proteína: alcanzar la proteína ya implica comida registrada, así que
 * su co-ocurrencia sería una tautología, no un descubrimiento. El orden es el
 * desempate cuando dos pares coinciden el mismo número de días. */
type CoPair = {
  a: EvidenceKey
  b: EvidenceKey
  /** Arquetipo SOLO para el arte/color de adorno (híbrido). */
  archetype: DiscoveryArchetype
  symbol: DiscoverySymbol
  title: string
  /** `n` = días en que ambas señales coincidieron. */
  phrase: (n: number) => string
}

const veces = (n: number): string => (n === 1 ? 'vez' : 'veces')

const CO_PAIRS: readonly CoPair[] = [
  {
    a: 'movimiento',
    b: 'proteina',
    archetype: 'movimiento',
    symbol: 'movimiento',
    title: 'Movimiento y proteína',
    phrase: (n) => `Tu movimiento apareció junto a tu proteína ${n} ${veces(n)} esta semana.`,
  },
  {
    a: 'deficit',
    b: 'sleep7h',
    archetype: 'descanso',
    symbol: 'sueno',
    title: 'Déficit y descanso',
    phrase: (n) => `Tu déficit apareció junto a noches de más de 7 h ${n} ${veces(n)} esta semana.`,
  },
  {
    a: 'deficit',
    b: 'movimiento',
    archetype: 'movimiento',
    symbol: 'movimiento',
    title: 'Déficit y movimiento',
    phrase: (n) => `Tu déficit apareció junto a tus entrenos ${n} ${veces(n)} esta semana.`,
  },
]

// Mínimo de días coincidentes para llamarlo co-ocurrencia (no ruido).
const MIN_COOCCURRENCE = 3

export type CoOccurrence = {
  pair: CoPair
  /** Días en que AMBAS señales coincidieron (lun→hoy). */
  both: number
}

/**
 * La co-ocurrencia más fuerte de la semana (más días coincidentes, ≥ mínimo).
 * Es el corazón del descubrimiento v2: dos señales que aparecieron JUNTAS,
 * nunca una causa. `null` si ninguna llega al mínimo (el hero degrada a
 * presencia). Empate → orden de `CO_PAIRS`. Los pares con déficit requieren
 * meta calórica; sin ella su conteo es 0 y quedan fuera.
 */
export function strongestCoOccurrence(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): CoOccurrence | null {
  let best: CoOccurrence | null = null
  for (const pair of CO_PAIRS) {
    const both = countDays(
      signals,
      todayIso,
      (s) => EVIDENCE_PRED[pair.a](s, ctx) && EVIDENCE_PRED[pair.b](s, ctx),
    )
    if (both >= MIN_COOCCURRENCE && (best == null || both > best.both)) {
      best = { pair, both }
    }
  }
  return best
}

/* ── §1 · Descubrimiento principal (co-ocurrencia · híbrido v2) ───────── */

export type DiscoveryArchetype =
  | 'constancia'
  | 'movimiento'
  | 'nutricion'
  | 'proteina'
  | 'descanso'
  | 'hidratacion'
  | 'energia'
  | 'comienzo'

/** Símbolo del arquetipo: una dimensión (reusa su glyph) o el Ancla. */
export type DiscoverySymbol = WeekDimKey | 'ancla'

export type WeekEvidenceItem = { key: string; text: string }

/** Tipo de descubrimiento principal: una co-ocurrencia de dos señales, la
 *  presencia simple, o un comienzo cálido con poca evidencia. */
export type DiscoveryKind = 'cooccurrence' | 'presence' | 'comienzo'

/** Una línea L·M·M·J·V·S·D etiquetada — el hero muestra 1 (presencia) o 2
 *  (co-ocurrencia) de estas, una por señal. */
export type DiscoveryTimeline = { key: EvidenceKey | 'presencia'; label: string; cells: DayCell[] }

/** La foto de un único día registrado: en lugar de seis conteos de "1 día"
 *  (que se contradicen con "apenas toma forma"), la evidencia se lee como la
 *  instantánea de ESE día. */
export type DaySnapshot = {
  /** "el lunes" — el día del único registro de la semana. */
  weekdayLabel: string
  /** Señales presentes ese día, en orden ("comida", "entreno", "sueño +7 h"…). */
  items: string[]
}

export type MainDiscovery = {
  /** Qué clase de descubrimiento es (gobierna el render del hero). */
  kind: DiscoveryKind
  /** Arquetipo SOLO para el arte/color de adorno (híbrido v2): el TEXTO ya no
   *  es una etiqueta de arquetipo, pero el arte de estado se conserva. */
  archetype: DiscoveryArchetype
  symbol: DiscoverySymbol
  /** Título del modal de evidencia ("Movimiento y proteína", "Tu presencia"…). */
  title: string
  /** Observación en voz de coach (serif italic). Es lo protagonista; en v2 es
   *  una co-ocurrencia ("Tu movimiento apareció junto a tu proteína 4 veces"). */
  phrase: string
  /** Subcadena de `phrase` a enfatizar en color (patrón EmText): la frase va en
   *  leche y solo la clave (el conteo) toma el acento. */
  emphasis: string
  /** La línea de dato ("Coincidieron 4 de 7 días."). */
  headline: string
  /** Matiz cálido bajo el dato (puede ser null). */
  sub: string | null
  /** Las líneas de evidencia que el hero pinta bajo la frase (1 o 2). */
  timelines: DiscoveryTimeline[]
  /** Foto del día cuando solo se registró UNO esta semana (estado comienzo). El
   *  modal la prefiere sobre la lista de conteos. null en los demás casos. */
  snapshot: DaySnapshot | null
  /** Evidencia transparente que respalda el descubrimiento (para "¿Por qué?"). */
  evidence: WeekEvidenceItem[]
}

/**
 * La evidencia transparente de la semana: cuántos días apareció cada señal
 * REAL (incluye emociones y ciclo, que no son planetas de la galaxia). Solo
 * incluye renglones con conteo > 0 — la evidencia muestra lo que SÍ pasó,
 * nunca un "0 días" que se leería como reproche.
 */
export function weekEvidence(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): WeekEvidenceItem[] {
  const c = (pred: (s: DailySignals) => boolean) => countDays(signals, todayIso, pred)
  const out: WeekEvidenceItem[] = []
  const meals = c((s) => (s.meal_count ?? 0) > 0)
  if (meals > 0) out.push({ key: 'comida', text: `Registraste comida ${meals} ${dayWord(meals)}` })
  const trained = c((s) => s.trained === true)
  if (trained > 0)
    out.push({ key: 'movimiento', text: `Entrenaste ${trained} ${dayWord(trained)}` })
  const protein = c((s) =>
    ctx.proteinTarget != null
      ? s.protein_g != null && s.protein_g >= ctx.proteinTarget
      : (s.protein_g ?? 0) > 0,
  )
  if (protein > 0)
    out.push({
      key: 'proteina',
      text:
        ctx.proteinTarget != null
          ? `Alcanzaste tu proteína ${protein} ${dayWord(protein)}`
          : `Registraste tu proteína ${protein} ${dayWord(protein)}`,
    })
  const sleep7 = c((s) => s.sleep_minutes != null && s.sleep_minutes >= 420)
  if (sleep7 > 0)
    out.push({ key: 'sueno', text: `Dormiste más de 7 h en ${sleep7} ${dayWord(sleep7)}` })
  const water = c((s) => (s.water_glasses ?? 0) > 0)
  if (water > 0) out.push({ key: 'agua', text: `Tomaste agua ${water} ${dayWord(water)}` })
  const energy = c((s) => s.energy != null)
  if (energy > 0)
    out.push({ key: 'energia', text: `Registraste tu energía ${energy} ${dayWord(energy)}` })
  const mood = c((s) => s.mood != null || (s.wellbeing_checkins ?? 0) > 0)
  if (mood > 0)
    out.push({ key: 'emociones', text: `Anotaste cómo te sentiste ${mood} ${dayWord(mood)}` })
  // El ciclo NO va aquí: no es un hábito que "haces" ni un logro (menstruar
  // ~5 días no es presencia comparable a agua/sueño). Es CONTEXTO de la
  // balanza y vive en Mes (ver docs/cycle-voice-spec.md). Tampoco va en la
  // galaxia ni en "la ausencia".
  return out
}

/**
 * La foto del único día registrado esta semana. Cuando solo hay UN día con
 * señales, la evidencia se lee como la instantánea de ese día (no seis conteos
 * de "1 día", que confunden y contradicen "apenas toma forma"). `null` si hay 0
 * o más de 1 día registrado (ahí los conteos sí informan).
 */
export function singleDaySnapshot(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): DaySnapshot | null {
  const monday = mondayOf(todayIso)
  const logged = signals.filter(
    (s) => s.day != null && s.day >= monday && s.day <= todayIso && signalCount(s) > 0,
  )
  if (logged.length !== 1) return null
  const s = logged[0]!
  const weekdayLabel = `el ${SPANISH_WEEKDAYS[isoWeekday(s.day as string) - 1]}`

  const protein =
    ctx.proteinTarget != null
      ? s.protein_g != null && s.protein_g >= ctx.proteinTarget
      : (s.protein_g ?? 0) > 0
  const items: string[] = []
  if ((s.meal_count ?? 0) > 0) items.push('comida')
  if (s.trained === true) items.push('entreno')
  if (protein) items.push('proteína')
  if (s.sleep_minutes != null) items.push(s.sleep_minutes >= SLEEP_7H_MIN ? 'sueño +7 h' : 'sueño')
  if ((s.water_glasses ?? 0) > 0) items.push('agua')
  if (s.energy != null) items.push('energía')
  if (s.mood != null || (s.wellbeing_checkins ?? 0) > 0) items.push('cómo te sentiste')
  return { weekdayLabel, items }
}

/**
 * El descubrimiento principal de la semana (v2 · híbrido) — UNA sola
 * observación, derivada determinísticamente. Prioridad:
 *
 *   1. CO-OCURRENCIA — dos señales que aparecieron JUNTAS varios días (≥3).
 *      Es lo más fuerte y lo más fiel a "evidencia, no causa": el texto
 *      describe la coincidencia, nunca el porqué.
 *   2. PRESENCIA — sin una co-ocurrencia fuerte, la huella es haber estado
 *      presente; su timeline es la línea de aparición.
 *   3. COMIENZO — con poca evidencia (apareciste <3 días), un cierre cálido,
 *      nunca un puntaje bajo.
 *
 * El arquetipo viaja solo para el arte/color de adorno (híbrido): el TEXTO ya
 * no es una etiqueta. La evidencia transparente acompaña siempre ("¿Por qué?").
 */
export function mainDiscovery(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): MainDiscovery {
  const total = isoWeekday(todayIso)
  const appeared = appearanceCount(buildAppearanceLine(signals, todayIso))
  const evidence = weekEvidence(signals, todayIso, ctx)

  // 1 · Co-ocurrencia más fuerte → el descubrimiento.
  const co = strongestCoOccurrence(signals, todayIso, ctx)
  if (co) {
    const n = co.both
    return {
      kind: 'cooccurrence',
      archetype: co.pair.archetype,
      symbol: co.pair.symbol,
      title: co.pair.title,
      phrase: co.pair.phrase(n),
      emphasis: `${n} ${veces(n)}`,
      headline: `Coincidieron ${n} de ${total} ${dayWord(total)}.`,
      sub: null,
      timelines: [
        {
          key: co.pair.a,
          label: EVIDENCE_LABEL[co.pair.a],
          cells: signalLine(signals, todayIso, co.pair.a, ctx),
        },
        {
          key: co.pair.b,
          label: EVIDENCE_LABEL[co.pair.b],
          cells: signalLine(signals, todayIso, co.pair.b, ctx),
        },
      ],
      snapshot: null,
      evidence,
    }
  }

  const presenceTimeline: DiscoveryTimeline = {
    key: 'presencia',
    label: 'Presencia',
    cells: buildAppearanceLine(signals, todayIso),
  }

  // 2 · Comienzo — aún poca evidencia: nunca mostrar un conteo como reproche.
  if (appeared < 3) {
    // Foto del día cuando hay UN solo registro (evita seis "1 día"). Si ese
    // único día fue rico (≥3 señales), el hero lo RECONOCE en vez de
    // minimizarlo con "apenas toma forma".
    const snapshot = singleDaySnapshot(signals, todayIso, ctx)
    const rich = snapshot != null && snapshot.items.length >= 3
    return {
      kind: 'comienzo',
      archetype: 'comienzo',
      symbol: 'ancla',
      title: 'Un comienzo',
      phrase: rich ? 'Tu primer día ya dejó huella.' : 'Tu semana apenas toma forma.',
      emphasis: rich ? 'dejó huella' : 'toma forma',
      headline: rich
        ? 'Registraste varias señales en un solo día.'
        : appeared > 0
          ? `Apareciste ${appeared} ${dayWord(appeared)} esta semana.`
          : '',
      sub: 'Cada registro deja una huella.',
      timelines: [presenceTimeline],
      snapshot,
      evidence,
    }
  }

  // 3 · Presencia — sin co-ocurrencia fuerte, la huella es estar presente.
  return {
    kind: 'presence',
    archetype: 'constancia',
    symbol: 'ancla',
    title: 'Tu presencia',
    phrase: 'Tu semana dejó su huella en ti.',
    emphasis: 'su huella',
    headline: `Apareciste ${appeared} de ${total} ${dayWord(total)}.`,
    sub: appeared === total ? 'Apareciste cada día de la semana.' : null,
    timelines: [presenceTimeline],
    snapshot: null,
    evidence,
  }
}

/* ── §3 · "Lo más silencioso" — la señal menos presente (pero presente) ── */

export type QuietSignal = { key: WeekDimKey; label: string; present: number; total: number }

/**
 * La dimensión que MENOS apareció pero que sí apareció (≥1 día). Las que nunca
 * aparecieron son AUSENCIA (otra sección), no silencio. Requiere ≥2 dimensiones
 * con presencia para que "menos" tenga sentido comparativo, y que la mínima no
 * esté llena (si lo está, no hay nada silencioso).
 */
export function quietestSignal(dims: readonly WeekDimension[]): QuietSignal | null {
  const present = dims.filter((d) => d.present > 0)
  if (present.length < 2) return null
  let low = present[0]!
  for (const d of present) if (d.present < low.present) low = d
  if (low.present >= low.total) return null
  return { key: low.key, label: low.label, present: low.present, total: low.total }
}

/* ── §4 · "Tus ritmos" — distribución por día de la semana ───────────── */

const SPANISH_WEEKDAYS = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const

/**
 * "Tus ritmos" — DISTRIBUCIÓN por día de la semana, enfocada en lo que importa
 * para sostener la constancia: el día en que la semana tiende a quedarse en
 * silencio (el que "se rompe") y patrones del cuerpo (sueño, entreno). NO mide
 * uso de la app, NO hay hora del día (daily_signals no guarda timestamps por
 * registro). Framing de ESTA semana, sin afirmar recurrencia (un ritmo real
 * multi-semana vive en Mes). Devuelve [] si no hay un patrón claro.
 */
export function weeklyRhythms(signals: readonly DailySignals[], todayIso: string): string[] {
  const monday = mondayOf(todayIso)
  const elapsed = isoWeekday(todayIso)
  // Necesitamos casi toda la semana para hablar de "el día que se rompe".
  if (elapsed < 5) return []
  const out: string[] = []
  const byIdx = (i: number) => signals.find((s) => s.day === addDays(monday, i)) ?? null

  // 1 · El día más callado de la semana (el que se rompe). Riqueza = nº de
  // señales ese día; surfaceamos el ÚNICO día más bajo cuando hay contraste
  // real con un día activo (evita señalar días en una semana pareja/vacía).
  const richness: number[] = []
  for (let i = 0; i < elapsed; i++) {
    const s = byIdx(i)
    richness.push(s ? signalCount(s) : 0)
  }
  const maxRich = Math.max(...richness)
  const minRich = Math.min(...richness)
  if (maxRich >= 3 && minRich < maxRich) {
    const lows = richness
      .map((r, i) => ({ r, i }))
      .filter((d) => d.r === minRich)
      .map((d) => d.i)
    if (lows.length === 1) {
      out.push(`El ${SPANISH_WEEKDAYS[lows[0]!]} fue tu día más callado.`)
    }
  }

  // 2 · Entrenamiento al inicio vs. fin de la semana.
  const trainedIdx: number[] = []
  for (let i = 0; i < elapsed; i++) if (byIdx(i)?.trained === true) trainedIdx.push(i)
  if (trainedIdx.length >= 3) {
    const early = trainedIdx.filter((i) => i <= 2).length
    const late = trainedIdx.filter((i) => i >= 3).length
    if (early - late >= 2) out.push('Entrenaste más al inicio de la semana.')
    else if (late - early >= 2) out.push('Entrenaste más hacia el fin de semana.')
  }

  // 3 · Sueño: fin de semana vs. entre semana.
  const weekendSleep: number[] = []
  const weekdaySleep: number[] = []
  for (let i = 0; i < elapsed; i++) {
    const m = byIdx(i)?.sleep_minutes
    if (m == null) continue
    if (i >= 5) weekendSleep.push(m)
    else weekdaySleep.push(m)
  }
  if (weekendSleep.length >= 1 && weekdaySleep.length >= 1) {
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const diff = avg(weekendSleep) - avg(weekdaySleep)
    if (diff >= SLEEP_DIFF_MIN) out.push('Dormiste más en fin de semana.')
    else if (-diff >= SLEEP_DIFF_MIN) out.push('Dormiste más entre semana.')
  }

  return out
}

/* ── §5 · "Lo constante" — lo que se mantuvo estable ─────────────────── */

/**
 * Lo que se MANTUVO estable (rangos estrechos), no cantidades: sueño en una
 * banda horaria, energía estable. Devuelve [] si nada se sostiene con datos.
 */
export function steadyThings(signals: readonly DailySignals[], todayIso: string): string[] {
  const monday = mondayOf(todayIso)
  const inWeek = signals.filter((s) => s.day != null && s.day >= monday && s.day <= todayIso)
  const out: string[] = []

  // Sueño en una banda de 1 h (la más frecuente, ≥3 noches).
  const bands = new Map<number, number>()
  for (const s of inWeek) {
    if (s.sleep_minutes == null) continue
    const h = Math.floor(s.sleep_minutes / 60)
    bands.set(h, (bands.get(h) ?? 0) + 1)
  }
  let bestH = -1
  let bestC = 0
  for (const [h, c] of bands) {
    if (c > bestC) {
      bestC = c
      bestH = h
    }
  }
  if (bestC >= 3) {
    out.push(`Dormiste entre ${bestH} y ${bestH + 1} horas durante ${bestC} ${dayWord(bestC)}.`)
  }

  // Energía estable (rango ≤1 en ≥3 check-ins).
  const energies = inWeek.map((s) => s.energy).filter((e): e is number => e != null)
  if (energies.length >= 3 && Math.max(...energies) - Math.min(...energies) <= 1) {
    out.push('Tu energía se mantuvo estable.')
  }

  return out
}

/**
 * Observaciones de la semana en UNA lista (ritmos + lo constante fusionados),
 * con dedupe por tema: si hay banda de sueño concreta ("entre 7 y 8 horas…"),
 * se omite la observación de sueño por distribución ("dormiste más en fin de
 * semana") para no repetir el mismo tema en filas adyacentes. Orden: primero el
 * día que se rompe / entreno, luego lo constante.
 */
export function weekObservations(signals: readonly DailySignals[], todayIso: string): string[] {
  const rhythms = weeklyRhythms(signals, todayIso)
  const steady = steadyThings(signals, todayIso)
  const hasSleepBand = steady.some((s) => /\d+ y \d+ horas/.test(s))
  const out: string[] = []
  for (const r of rhythms) {
    if (hasSleepBand && /^Dormiste más/.test(r)) continue // sueño ya cubierto, más concreto
    out.push(r)
  }
  out.push(...steady)
  return out
}

/* ── §7 · "Un patrón por descubrir" — invitación con premio, no ausencia ── */

/**
 * Señales que NO aparecieron esta semana, reencuadradas como INVITACIÓN CON
 * PREMIO (no como "lo que NO hiciste"): cada una nombra el patrón que podrías
 * ver si la registras (decisión dueña jul 2026 — la usuaria leía "No registraste
 * X" como regaño/tarea con culpa). Excluye el ciclo (su ausencia significa "no
 * estás en tu periodo"). Tope de 2 para que sea un guiño, no una lista de deberes.
 * Solo cuando ya hay ALGUNA evidencia (si todo está vacío, va el estado vacío).
 */
export function weekAbsences(signals: readonly DailySignals[], todayIso: string): string[] {
  const c = (pred: (s: DailySignals) => boolean) => countDays(signals, todayIso, pred)
  const appeared = appearanceCount(buildAppearanceLine(signals, todayIso))
  if (appeared === 0) return []

  // Pregunta que despierta curiosidad + posibilidad en CONDICIONAL (nunca
  // imperativo "anota/registra", que sería orden; nunca "podrás/te da chispa",
  // que prometería un resultado o insinuaría causa). Solo se abre la puerta.
  const candidates: { present: number; line: string }[] = [
    {
      present: c((s) => (s.water_glasses ?? 0) > 0),
      line: '¿Tu hidratación sigue algún ritmo? Con unos días anotados, podrías verlo.',
    },
    {
      present: c((s) => s.sleep_minutes != null),
      line: '¿Hay algo entre tu sueño y tu energía? Con unos días anotados, podrías descubrirlo.',
    },
    {
      present: c((s) => s.trained === true),
      line: '¿Cuándo te mueves más en la semana? Con unos días registrados, el patrón podría aparecer.',
    },
    {
      present: c((s) => s.mood != null || (s.wellbeing_checkins ?? 0) > 0),
      line: '¿Tu ánimo tiene un ritmo en la semana? Con unos días marcados, podría verse.',
    },
    {
      present: c((s) => (s.meal_count ?? 0) > 0),
      line: '¿Cómo va tomando forma tu déficit? Con unos días de registro, empezarías a verlo.',
    },
    {
      present: c((s) => s.energy != null),
      line: '¿Tu energía sube o baja con la semana? Con unos días anotados, podrías verlo.',
    },
  ]
  return candidates
    .filter((x) => x.present === 0)
    .slice(0, 2)
    .map((x) => x.line)
}

/* ════════════════════════════════════════════════════════════════════
 * Órbita Semana v2 — secciones de evidencia alrededor de la galaxia.
 * Todo determinístico, observacional (nunca causal), con guardas de
 * honestidad. Ver docs/orbita-semana-spec.md §3-§8.
 * ════════════════════════════════════════════════════════════════════ */

const cap = (s: string): string => (s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** ¿Ese día se alcanzó la proteína? (meta si la hay, registro si no). */
const proteinReached = (s: DailySignals, ctx: WeekDimCtx): boolean => PRESENT.proteina(s, ctx)

/* ── §3 · Evidencia emergente — observaciones con número (2 a 4) ───────── */

/**
 * Las observaciones numéricas de la semana, distintas del hero. v2.2: SIN la
 * línea de conteo de déficit (es el KPI-foto de Mes; en Semana el déficit vive
 * como dirección en §0) y SIN "día de más calorías" (culpa vaga sin salida).
 * Quedan: proteína en días de entreno y la señal menos presente. Cada una es un
 * hecho con su evidencia, nunca un consejo ni una causa. Tope 4.
 */
export function emergingEvidence(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): WeekEvidenceItem[] {
  const c = (pred: (s: DailySignals) => boolean) => countDays(signals, todayIso, pred)
  const out: WeekEvidenceItem[] = []

  // v2.2: la línea de conteo de déficit ("N de M días con comida") SALE de aquí
  // — es el KPI-foto de Mes en chiquito. En Semana el déficit vive como DIRECCIÓN
  // (§0 weekDirection) y, cuando se construya, como FORMA (§S silueta). Y "El día
  // de más calorías" también sale: la usuaria lo reportó como culpa vaga sin
  // salida (señala el mal día sin decir si aun así cerró en déficit). Ver
  // docs/orbita-semana-spec.md §3. Aquí quedan solo observaciones NO de déficit.

  // Proteína en días de entreno — co-ocurrencia secundaria, con su denominador.
  // Solo se muestra si es MAYORÍA (≥60%): un 2 de 4 (50%) la usuaria lo leía como
  // hueco/reprobado, no como logro. Copy con el número al FRENTE (ritmo natural)
  // y la proteína como sujeto ("también estuvo") — ni "apareció" (que sonaba a
  // que llega sola) ni "cuidaste" (que metía elogio); pura co-ocurrencia.
  const trained = c((s) => s.trained === true)
  if (trained >= 2) {
    const both = c((s) => s.trained === true && proteinReached(s, ctx))
    if (both >= 2 && both * 5 >= trained * 3) {
      out.push({
        key: 'prot-train',
        text: `En ${both} de tus ${trained} días de entreno, la proteína también estuvo.`,
      })
    }
  }

  // v2.2: "[señal] apareció solo N días" SALE (patrón prohibido en toda Órbita).
  // El "solo" es regaño y disfrazado de hallazgo solo cuenta lo que faltó. La
  // baja frecuencia ya la dice la galaxia con su planeta pequeño/tenue (masa por
  // frecuencia, nunca hue de alarma). La frecuencia baja se VE, no se dice.

  return out.slice(0, 4)
}

/* ── §4 · Lo que podemos confirmar — hechos puros (sin interpretación) ─── */

/**
 * Hechos confirmados de la semana: conteos directos, sin adjetivos de juicio
 * ("disciplinada"/"floja" están prohibidos). Solo lo que SÍ pasó (>0).
 */
export function confirmedFacts(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): WeekEvidenceItem[] {
  const c = (pred: (s: DailySignals) => boolean) => countDays(signals, todayIso, pred)
  const total = isoWeekday(todayIso)
  const appeared = appearanceCount(buildAppearanceLine(signals, todayIso))
  const out: WeekEvidenceItem[] = []

  const trained = c((s) => s.trained === true)
  if (trained >= 1) out.push({ key: 'trained', text: `Entrenaste ${trained} ${veces(trained)}.` })

  const protein = c((s) => proteinReached(s, ctx))
  if (protein >= 1)
    out.push({ key: 'protein', text: `Alcanzaste tu proteína ${protein} ${veces(protein)}.` })

  if (total > 0 && appeared === total) out.push({ key: 'logged', text: 'Registraste cada día.' })
  else if (appeared >= 1)
    out.push({ key: 'logged', text: `Registraste ${appeared} de ${total} ${dayWord(total)}.` })

  if (ctx.calorieTarget != null && ctx.calorieTarget > 0) {
    const def = c((s) => isDeficitDay(s.calories, ctx.calorieTarget))
    if (def >= 1)
      out.push({
        key: 'deficit',
        text: `${def} ${dayWord(def)} ${def === 1 ? 'terminó' : 'terminaron'} en déficit.`,
      })
  }

  return out
}

/* ── §5 · Lo que aún necesita más evidencia — honestidad ───────────────── */

/** Pares que Órbita observa pero aún no puede afirmar: si ambos lados tienen
 *  datos pero coinciden pocas veces, lo decimos con humildad. */
const PROBE_PAIRS: readonly { a: EvidenceKey; b: EvidenceKey; aWord: string; bWord: string }[] = [
  { a: 'agua', b: 'deficit', aWord: 'tu agua', bWord: 'tu déficit' },
  { a: 'sueno', b: 'energia', aWord: 'tu sueño', bWord: 'tu energía' },
  { a: 'movimiento', b: 'energia', aWord: 'tu movimiento', bWord: 'tu energía' },
]

/**
 * Una observación honesta: un par que aún no tiene suficientes coincidencias
 * para afirmarse (ambos lados con ≥1 día, pero juntos < mínimo). Crea
 * curiosidad sin fingir confianza. `null` si la semana está vacía o no hay un
 * par prometedor pero sub-muestreado. Los pares con déficit requieren meta.
 */
export function needsMoreEvidence(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): string | null {
  if (appearanceCount(buildAppearanceLine(signals, todayIso)) === 0) return null
  const c = (pred: (s: DailySignals) => boolean) => countDays(signals, todayIso, pred)
  for (const p of PROBE_PAIRS) {
    const usesDeficit = p.a === 'deficit' || p.b === 'deficit'
    if (usesDeficit && !(ctx.calorieTarget != null && ctx.calorieTarget > 0)) continue
    const aDays = c((s) => EVIDENCE_PRED[p.a](s, ctx))
    const bDays = c((s) => EVIDENCE_PRED[p.b](s, ctx))
    const both = c((s) => EVIDENCE_PRED[p.a](s, ctx) && EVIDENCE_PRED[p.b](s, ctx))
    // v2.2: piso ALTO (ambas señales en ≥3 días) → un "casi-patrón" ganado, no
    // un pie de página que sale casi siempre. Y copy de ANTICIPACIÓN ("se sigue
    // dibujando"), no de deuda ("no tenemos datos / sigue registrando").
    if (aDays >= 3 && bDays >= 3 && both < MIN_COOCCURRENCE) {
      return `${cap(p.aWord)} y ${p.bWord} todavía no se han encontrado las veces suficientes. Algo se sigue dibujando.`
    }
  }
  return null
}

/* ── §6 · La semana día por día — etiquetas de evidencia ───────────────── */

export type DayTimelineRow = {
  date: string
  letter: string
  /** "Lunes", "Martes"… */
  weekdayLabel: string
  state: DayCellState
  /** Etiquetas de evidencia de ese día ("Déficit", "Proteína", "Entreno",
   *  "Por encima de tu meta") o ["Sin registros"]. Vacío en días futuros. */
  tags: string[]
}

/**
 * Cada día de la semana (lun→dom) resumido con sus etiquetas de evidencia. Se
 * entiende la semana en 10 segundos. "Sin registros" y "Por encima de tu meta"
 * son neutros, nunca reproche. Futuro = sin etiquetas.
 */
export function dayTimeline(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): DayTimelineRow[] {
  const monday = mondayOf(todayIso)
  const byDay = new Map<string, DailySignals>()
  for (const s of signals) if (s.day != null) byDay.set(s.day, s)

  return WEEKDAY_LETTERS.map((letter, i) => {
    const date = addDays(monday, i)
    const weekdayLabel = cap(SPANISH_WEEKDAYS[i]!)
    if (date > todayIso) return { date, letter, weekdayLabel, state: 'future' as const, tags: [] }

    const s = byDay.get(date)
    if (!s || signalCount(s) === 0) {
      return { date, letter, weekdayLabel, state: 'absent' as const, tags: ['Sin registros'] }
    }

    const tags: string[] = []
    const hasTarget = ctx.calorieTarget != null && ctx.calorieTarget > 0
    if (hasTarget && isDeficitDay(s.calories, ctx.calorieTarget)) tags.push('Déficit')
    else if (hasTarget && s.calories != null && s.calories > ctx.calorieTarget!)
      tags.push('Por encima de tu meta')
    if (proteinReached(s, ctx)) tags.push('Proteína')
    if (s.trained === true) tags.push('Entreno')
    if (tags.length === 0) tags.push('Registro')

    return { date, letter, weekdayLabel, state: 'present' as const, tags }
  })
}

/* ── §8 · Repetir la próxima semana — invitaciones a observar ───────────── */

/**
 * "Esto apareció varias veces" — invitaciones a observar (nunca "deberías").
 * Reúne la co-ocurrencia más fuerte + el reparto de calorías finde/entre-semana.
 * Tope 2. Todo observacional, sin causa.
 */
export function weekInvitations(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): string[] {
  const out: string[] = []

  const co = strongestCoOccurrence(signals, todayIso, ctx)
  if (co) {
    out.push(
      `${EVIDENCE_LABEL[co.pair.a]} y ${EVIDENCE_LABEL[co.pair.b].toLowerCase()} aparecieron juntos la mayor parte de la semana.`,
    )
  }

  // Reparto de calorías sobre la meta: finde vs. entre semana (solo con meta).
  if (ctx.calorieTarget != null && ctx.calorieTarget > 0) {
    const monday = mondayOf(todayIso)
    const elapsed = isoWeekday(todayIso)
    let weekendOver = 0
    let weekdayOver = 0
    let weekdayNear = 0
    for (let i = 0; i < elapsed; i++) {
      const s = signals.find((x) => x.day === addDays(monday, i))
      if (!s || s.calories == null || s.calories <= 0) continue
      const over = s.calories > ctx.calorieTarget
      if (i >= 5) {
        if (over) weekendOver += 1
      } else {
        if (over) weekdayOver += 1
        else weekdayNear += 1
      }
    }
    if (weekendOver >= 1 && weekendOver >= weekdayOver) {
      out.push('El fin de semana concentró la mayoría de las calorías extra.')
    } else if (weekdayNear >= 3 && weekdayOver === 0) {
      out.push('Entre semana te mantuviste cerca de tu meta calórica.')
    }
  }

  return out.slice(0, 2)
}

/* ── §8 · Tu palanca para los PRÓXIMOS DÍAS (cierre accionable, cercano) ──
 * v2.2: no es "invitaciones a observar" ni la palanca ESTRUCTURAL de Mes ("Tu
 * fin de semana te sostiene, entre semana margen"). Es UNA palanca cercana —
 * "estos días / este finde" — derivada de la forma de ESTA semana. Foco, no
 * orden (recomendación; nunca "comé menos"). Ver docs/orbita-semana-spec.md §8. */

export type WeekLever = { focus: string }

/**
 * UNA palanca de foco para los próximos días, en clave cercana (no la estructura
 * mensual de Mes). Prioridad: (1) reparto de calorías del finde vs entre semana
 * (con meta), (2) sostener el entre semana si viene firme, (3) repetir la
 * co-ocurrencia más fuerte. `null` si no hay señal suficiente.
 */
export function weekLever(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): WeekLever | null {
  if (ctx.calorieTarget != null && ctx.calorieTarget > 0) {
    const monday = mondayOf(todayIso)
    const elapsed = isoWeekday(todayIso)
    let weekendOver = 0
    let weekdayOver = 0
    let weekdayNear = 0
    for (let i = 0; i < elapsed; i++) {
      const s = signals.find((x) => x.day === addDays(monday, i))
      if (!s || s.calories == null || s.calories <= 0) continue
      const over = s.calories > ctx.calorieTarget
      if (i >= 5) {
        if (over) weekendOver += 1
      } else if (over) weekdayOver += 1
      else weekdayNear += 1
    }
    if (weekendOver >= 1 && weekendOver >= weekdayOver) {
      // Anclado a dato ("más alto en calorías"), sin "exceso" (etiqueta de
      // juicio) ni "margen" (vocabulario de la palanca mensual de Mes).
      return {
        focus:
          'Esta semana el finde fue el más alto en calorías. Ese es el espacio que tienes ahora.',
      }
    }
    if (weekdayNear >= 3 && weekdayOver === 0) {
      // "calórica" despeja que no es meta de peso; "foco" en vez de repetir
      // "palanca" del eyebrow.
      return {
        focus:
          'Entre semana estás cerca de tu meta calórica. Ese ritmo es tu foco para los días que vienen.',
      }
    }
  }

  const co = strongestCoOccurrence(signals, todayIso, ctx)
  if (co) {
    // Verbo observacional aprobado ("aparecieron"); "foco", no "palanca"/"repetir".
    return {
      focus: `${EVIDENCE_LABEL[co.pair.a]} y ${EVIDENCE_LABEL[co.pair.b].toLowerCase()} aparecieron juntos esta semana. Eso puede ser tu foco para los próximos días.`,
    }
  }

  return null
}

/* ── Palanca de la semana en curso (criterio Apple: meta TUYA + lo que falta) ──
 * El "qué hago AHORA" del patrón entreno×déficit: cuántos entrenos llevas esta
 * semana vs los que TUS mejores semanas en déficit suelen tener, en tono de
 * oportunidad, nunca de deuda. Ver features/patterns/CLAUDE.md (enmienda jul 2026):
 * la palanca-presente SÍ puede mostrar meta + lo que falta, sin culpa. */

/** Entrenos-por-semana típicos de tus semanas FUERTES en déficit = la meta
 *  derivada de TUS datos. `null` si no hay base suficiente (→ solo marcador). */
function typicalTrainedInStrongWeeks(
  signals: readonly DailySignals[],
  target: number,
): number | null {
  const byWeek = new Map<string, { trained: number; food: number; deficit: number }>()
  for (const s of signals) {
    if (!s.day) continue
    const wk = mondayOf(s.day)
    const e = byWeek.get(wk) ?? { trained: 0, food: 0, deficit: 0 }
    if (s.trained === true) e.trained += 1
    if (s.calories != null && s.calories > 0) {
      e.food += 1
      if (isDeficitDay(s.calories, target)) e.deficit += 1
    }
    byWeek.set(wk, e)
  }
  const strong = [...byWeek.values()].filter(
    (e) => e.food >= 3 && e.trained >= 1 && e.deficit / e.food >= 0.5,
  )
  if (strong.length < 2) return null
  const counts = strong.map((e) => e.trained).sort((a, b) => a - b)
  return Math.max(1, counts[Math.floor(counts.length / 2)]!)
}

/** Entrenos de la semana EN CURSO (lun→hoy). */
function trainedThisWeek(signals: readonly DailySignals[], todayIso: string): number {
  const monday = mondayOf(todayIso)
  return signals.filter(
    (s) => s.day != null && s.day >= monday && s.day <= todayIso && s.trained === true,
  ).length
}

/** La palanca-presente del patrón entreno×déficit: marcador de esta semana +
 *  meta de TUS datos + la oportunidad. `null` si no hay meta calórica. */
export function weeklyMovementLever(
  signals: readonly DailySignals[],
  calorieTarget: number | null | undefined,
  todayIso: string,
): string | null {
  if (calorieTarget == null || calorieTarget <= 0) return null
  const w = trainedThisWeek(signals, todayIso)
  const typical = typicalTrainedInStrongWeeks(signals, calorieTarget)
  // Sin meta derivable: solo el marcador (honesto, sin inventar cuota).
  if (typical == null) {
    return `Esta semana el movimiento ya apareció ${w} ${w === 1 ? 'vez' : 'veces'}.`
  }
  // Ya estás en tu forma: celebra, no pidas más.
  if (w >= typical) {
    return `Esta semana llevas ${w} entrenos. Ya estás en tu forma de déficit.`
  }
  const faltan = typical - w
  const mas = faltan === 1 ? 'uno más' : `${faltan} más`
  return `Esta semana llevas ${w} de ${typical} entrenos que suelen ponerte en déficit. Con ${mas}, lo repites.`
}
