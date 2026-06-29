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

export type WeekDimKey = 'movimiento' | 'comida' | 'proteina' | 'agua' | 'sueno' | 'energia'

/** El orden canónico — posiciones estables de los orbes en la galaxia. */
export const WEEK_DIM_ORDER: readonly WeekDimKey[] = [
  'movimiento',
  'comida',
  'proteina',
  'agua',
  'sueno',
  'energia',
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

/* ── §1 · Descubrimiento principal (arquetipo determinístico) ────────── */

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

export type MainDiscovery = {
  archetype: DiscoveryArchetype
  symbol: DiscoverySymbol
  /** La palabra del descubrimiento ("Constancia", "Movimiento"…) — título del
   *  modal de evidencia. */
  title: string
  /** Conclusión en voz de coach (serif italic, como "Hoy predominó la
   *  constancia." de Día). Es lo protagonista del descubrimiento. */
  phrase: string
  /** Subcadena de `phrase` a enfatizar en color (patrón EmText de la voz de
   *  Stelar): la frase va en leche y solo la palabra clave toma el acento. */
  emphasis: string
  /** La línea de dato ("Estuviste presente 6 de 7 días."). */
  headline: string
  /** Matiz cálido bajo el dato (puede ser null). */
  sub: string | null
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

const DIM_ARCHETYPE: Record<
  WeekDimKey,
  { archetype: DiscoveryArchetype; title: string; verb: string; phrase: string; emphasis: string }
> = {
  movimiento: {
    archetype: 'movimiento',
    title: 'Movimiento',
    verb: 'Tu cuerpo se movió',
    phrase: 'Esta semana predominó el movimiento.',
    emphasis: 'movimiento',
  },
  comida: {
    archetype: 'nutricion',
    title: 'Nutrición',
    verb: 'Registraste tu comida',
    phrase: 'Esta semana predominó tu nutrición.',
    emphasis: 'nutrición',
  },
  proteina: {
    archetype: 'proteina',
    title: 'Proteína',
    verb: 'Cuidaste tu proteína',
    phrase: 'Esta semana predominó tu proteína.',
    emphasis: 'proteína',
  },
  agua: {
    archetype: 'hidratacion',
    title: 'Hidratación',
    verb: 'Tomaste agua',
    phrase: 'Esta semana predominó tu hidratación.',
    emphasis: 'hidratación',
  },
  sueno: {
    archetype: 'descanso',
    title: 'Descanso',
    verb: 'Registraste tu sueño',
    phrase: 'Esta semana predominó el descanso.',
    emphasis: 'descanso',
  },
  energia: {
    archetype: 'energia',
    title: 'Energía',
    verb: 'Registraste tu energía',
    phrase: 'Esta semana predominó tu energía.',
    emphasis: 'energía',
  },
}

/**
 * El descubrimiento principal de la semana — UN solo patrón, el más fuerte,
 * derivado determinísticamente. Si la PRESENCIA amplia domina, el arquetipo es
 * Constancia (símbolo: Ancla). Si una dimensión destaca con claridad, ella es
 * el descubrimiento. Con poca evidencia, un Comienzo cálido (nunca un puntaje
 * bajo). La evidencia transparente acompaña siempre (para "¿Por qué?").
 */
export function mainDiscovery(
  signals: readonly DailySignals[],
  todayIso: string,
  ctx: WeekDimCtx,
): MainDiscovery {
  const dims = buildWeekDimensions(signals, todayIso, ctx)
  const total = isoWeekday(todayIso)
  const appeared = appearanceCount(buildAppearanceLine(signals, todayIso))
  const evidence = weekEvidence(signals, todayIso, ctx)

  let top = dims[0]
  for (const d of dims) if (top && d.present > top.present) top = d

  // Comienzo — aún poca evidencia: nunca mostrar un conteo como reproche.
  if (appeared < APPEARED_CONSTANCY_MIN && (top?.present ?? 0) < 3) {
    return {
      archetype: 'comienzo',
      symbol: 'ancla',
      title: 'Un comienzo',
      phrase: 'Tu semana apenas toma forma.',
      emphasis: 'toma forma',
      headline: appeared > 0 ? `Apareciste ${appeared} ${dayWord(appeared)} esta semana.` : '',
      sub: 'Cada registro deja una huella.',
      evidence,
    }
  }

  // Constancia — la presencia amplia es el patrón dominante.
  if (appeared >= APPEARED_CONSTANCY_MIN && appeared >= Math.ceil(total * 0.7)) {
    return {
      archetype: 'constancia',
      symbol: 'ancla',
      title: 'Constancia',
      phrase: 'Esta semana predominó la constancia.',
      emphasis: 'constancia',
      headline: `Estuviste presente ${appeared} de ${total} ${dayWord(total)}.`,
      sub:
        appeared === total
          ? 'Apareciste cada día de la semana.'
          : 'No fue perfecto. Pero sí consistente.',
      evidence,
    }
  }

  // Una dimensión destaca con claridad → ella es el descubrimiento.
  if (top && top.present >= 3 && top.ratio >= 0.6) {
    const a = DIM_ARCHETYPE[top.key]
    return {
      archetype: a.archetype,
      symbol: top.key,
      title: a.title,
      phrase: a.phrase,
      emphasis: a.emphasis,
      headline: `${a.verb} ${top.present} de ${top.total} ${dayWord(top.total)}.`,
      sub: 'Fue tu señal más constante esta semana.',
      evidence,
    }
  }

  // Presencia media — un cierre cálido, sin sobreafirmar constancia.
  return {
    archetype: 'constancia',
    symbol: 'ancla',
    title: 'Tu semana',
    phrase: 'Esta semana dejó su huella en ti.',
    emphasis: 'su huella',
    headline: `Estuviste presente ${appeared} de ${total} ${dayWord(total)}.`,
    sub: null,
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

/* ── §6 · "La ausencia también cuenta" — señales que nunca aparecieron ── */

/**
 * Señales que NUNCA aparecieron esta semana. Es evidencia, no reproche: copy
 * neutro. Excluye el ciclo (su ausencia significa "no estás en tu periodo", no
 * un registro faltante). Tope de 2 para no leerse como regaño. Solo cuando ya
 * hay ALGUNA evidencia (si todo está vacío, la pantalla muestra el estado
 * vacío, no una lista de ausencias).
 */
export function weekAbsences(signals: readonly DailySignals[], todayIso: string): string[] {
  const c = (pred: (s: DailySignals) => boolean) => countDays(signals, todayIso, pred)
  const appeared = appearanceCount(buildAppearanceLine(signals, todayIso))
  if (appeared === 0) return []

  const candidates: { present: number; line: string }[] = [
    {
      present: c((s) => (s.water_glasses ?? 0) > 0),
      line: 'No encontramos registros de agua. Eso también es parte de tu semana.',
    },
    {
      present: c((s) => s.sleep_minutes != null),
      line: 'No encontramos registros de sueño. Eso también es parte de tu semana.',
    },
    {
      present: c((s) => s.trained === true),
      line: 'No encontramos entrenamientos. Eso también es parte de tu semana.',
    },
    {
      present: c((s) => s.mood != null || (s.wellbeing_checkins ?? 0) > 0),
      line: 'No registraste cómo te sentiste. Todavía no podemos descubrir ese patrón.',
    },
    {
      present: c((s) => (s.meal_count ?? 0) > 0),
      line: 'No encontramos comidas registradas. Eso también es parte de tu semana.',
    },
    {
      present: c((s) => s.energy != null),
      line: 'No registraste tu energía. Todavía no podemos descubrir ese patrón.',
    },
  ]
  return candidates
    .filter((x) => x.present === 0)
    .slice(0, 2)
    .map((x) => x.line)
}
