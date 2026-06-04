import type { DailySignals } from './api'
import {
  buildDayIdentity,
  clamp01,
  countEnLuz,
  deriveDimensions,
  DIM_FLOOR,
  DIMENSIONS,
  EN_LUZ_THRESHOLD,
  TONE_BRILLANTE,
  TONE_FORMACION,
} from '../../supabase/functions/_shared/intelligence/dimensions'
import type {
  DayIdentity,
  Dimension,
  DimensionContext,
  DimensionKey,
  DimensionLayout,
} from '../../supabase/functions/_shared/intelligence/types'

/* The dimension compute moved to the shared intelligence lib (single
 * source for app + Edge Functions). Re-exported so existing `from
 * './logic'` imports keep working; the UI helpers below stay here. */
export {
  buildDayIdentity,
  clamp01,
  countEnLuz,
  deriveDimensions,
  DIM_FLOOR,
  DIMENSIONS,
  EN_LUZ_THRESHOLD,
  TONE_BRILLANTE,
  TONE_FORMACION,
}
export type { DayIdentity, Dimension, DimensionContext, DimensionKey, DimensionLayout }

export type DimensionTone = 'brillante' | 'en formación' | 'en silencio'

/** Three-tone state — STELAR registers, never judges. "En silencio"
 *  is no signal yet, not failure (philosophy: stelar-philosophy). */
export function dimensionTone(brightness: number): DimensionTone {
  if (brightness >= TONE_BRILLANTE) return 'brillante'
  if (brightness >= TONE_FORMACION) return 'en formación'
  return 'en silencio'
}

/** Count of each tone across the system — drives the meta line. */
export function countTones(dims: Dimension[]): {
  brillantes: number
  formacion: number
  silencio: number
} {
  let brillantes = 0
  let formacion = 0
  let silencio = 0
  for (const d of dims) {
    const tone = dimensionTone(d.brightness)
    if (tone === 'brillante') brillantes++
    else if (tone === 'en formación') formacion++
    else silencio++
  }
  return { brillantes, formacion, silencio }
}

/** @deprecated Use `dimensionTone` for the three-level language. */
export function dimensionState(brightness: number): 'en luz' | 'lejos' {
  return brightness >= EN_LUZ_THRESHOLD ? 'en luz' : 'lejos'
}

/** One unit of evidence STELAR cites under a dimension — what it read
 *  and the value it saw. Empty list when nothing has been logged for
 *  that dimension yet. */
export type Evidence = { label: string; value: string }

/** The signals STELAR cited to land on this dimension's brightness —
 *  paired with `dimensionDetail` to turn a verdict into a reasoning
 *  chain. Returns an empty array when nothing was read for the day. */
export function dimensionEvidence(key: DimensionKey, s: DailySignals | null): Evidence[] {
  if (s == null) return []
  switch (key) {
    case 'cuerpo': {
      const list: Evidence[] = []
      list.push({ label: 'entrenamiento', value: s.trained ? 'sí' : 'no' })
      if (s.rested) list.push({ label: 'descanso', value: 'sí' })
      return list
    }
    case 'energia':
      return s.energy == null ? [] : [{ label: 'check-in', value: `${s.energy}/5` }]
    case 'mente': {
      const list: Evidence[] = []
      if (s.mood != null) list.push({ label: 'ánimo', value: moodWord(s.mood) })
      if (s.motivation != null) list.push({ label: 'motivación', value: `${s.motivation}/5` })
      if (s.stress != null) list.push({ label: 'calma', value: `${6 - s.stress}/5` })
      return list
    }
    case 'sueno': {
      if (s.sleep_minutes == null) return []
      const list: Evidence[] = [{ label: 'duración', value: formatSleep(s.sleep_minutes) }]
      if (s.sleep_quality != null) list.push({ label: 'calidad', value: `${s.sleep_quality}/5` })
      return list
    }
    case 'alimento':
      return s.meal_count ? [{ label: 'comidas', value: `${s.meal_count} hoy` }] : []
    case 'ciclo':
      return s.on_period ? [{ label: 'sangrado', value: 'sí' }] : []
  }
}

/** A read-depth score (0..1) STELAR shows in the meta line — the
 *  fraction of dimensions that have ANY signal today + how recent
 *  the read window is. Mock for now (engine will own it). */
export function readDepth(dims: Dimension[]): number {
  const withSignal = dims.filter((d) => d.brightness > DIM_FLOOR + 0.01).length
  return clamp01(withSignal / dims.length)
}

function moodWord(m: string): string {
  return m === 'good' ? 'bien' : m === 'neutral' ? 'neutral' : 'en lucha'
}

function formatSleep(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${m} m`
}

/** A short human readout of a dimension's day — shown when the user
 *  taps it in the orbital diagram. */
export function dimensionDetail(key: DimensionKey, s: DailySignals | null): string {
  if (s == null) return 'Sin registro hoy.'
  switch (key) {
    case 'cuerpo':
      return s.trained
        ? 'Entrenaste hoy.'
        : s.rested
          ? 'Día de descanso.'
          : 'Sin movimiento registrado.'
    case 'energia':
      return s.energy == null ? 'Sin check-in de energía.' : `Energía ${s.energy} de 5.`
    case 'mente': {
      const bits: string[] = []
      if (s.mood != null) bits.push(`ánimo ${moodWord(s.mood)}`)
      if (s.stress != null) bits.push(`estrés ${s.stress}/5`)
      if (s.motivation != null) bits.push(`motivación ${s.motivation}/5`)
      if (bits.length === 0) return 'Sin check-in emocional.'
      return `${bits.join(' · ')}.`
    }
    case 'sueno':
      if (s.sleep_minutes == null) return 'Sin sueño registrado.'
      return s.sleep_quality == null
        ? `Dormiste ${formatSleep(s.sleep_minutes)}.`
        : `${formatSleep(s.sleep_minutes)} · calidad ${s.sleep_quality}/5.`
    case 'alimento':
      return s.meal_count
        ? `${s.meal_count} ${s.meal_count === 1 ? 'comida' : 'comidas'} registradas.`
        : 'Sin comidas registradas.'
    case 'ciclo':
      return s.on_period ? 'Estás en tu periodo.' : 'Fuera del periodo.'
  }
}

/* ── La lectura del día (determinística, sin IA) ──────────────────────
 *
 * Una observación honesta que cruza las señales de HOY — el "para qué"
 * útil del Día mientras el motor de órbitas (IA) llega. Solo afirma lo
 * que está en daily_signals: no predice, no receta, no juzga. El motor
 * después refina la redacción; la selección por prioridad ya es real.
 *
 * Prioridad (validada con behavioral): pre-período+bajón > proteína
 * cuidada (identidad) > estrés+sueño corto > sueño corto+energía baja
 * > buen día > alineado (fallback). "Sin señal" cuando no hay nada.
 */
export type DailyReadingCategory =
  | 'prePeriodLow'
  | 'overTarget'
  | 'proteinCared'
  | 'stressShortSleep'
  | 'shortSleepLowEnergy'
  | 'goodDay'
  | 'aligned'
  | 'noSignal'

const SHORT_SLEEP_MIN = 6 * 60
const LOW_1_5 = 2
const HIGH_1_5 = 4

function hasAnySignalToday(s: DailySignals): boolean {
  return (
    s.sleep_minutes != null ||
    s.energy != null ||
    s.mood != null ||
    s.stress != null ||
    s.motivation != null ||
    s.meal_count != null ||
    s.trained === true ||
    s.rested === true ||
    s.on_period === true
  )
}

export function dailyReadingCategory(
  s: DailySignals | null,
  opts: { isPrePeriod: boolean; proteinTarget: number | null; calorieTarget?: number | null },
): DailyReadingCategory {
  if (!s || !hasAnySignalToday(s)) return 'noSignal'
  const shortSleep = s.sleep_minutes != null && s.sleep_minutes < SHORT_SLEEP_MIN
  const lowEnergy = s.energy != null && s.energy <= LOW_1_5
  const highStress = s.stress != null && s.stress >= HIGH_1_5
  const goodSleep = s.sleep_quality != null && s.sleep_quality >= HIGH_1_5
  const goodEnergy = s.energy != null && s.energy >= HIGH_1_5
  const lowMood = s.mood === 'low'
  const proteinGood =
    opts.proteinTarget != null && s.protein_g != null && s.protein_g >= opts.proteinTarget * 0.9
  // Notably over the day's calorie target — for a deficit goal, the
  // deficit is gone. Surfaced with curiosity, never blame (manifiesto).
  const overTarget =
    opts.calorieTarget != null &&
    opts.calorieTarget > 0 &&
    s.calories != null &&
    s.calories >= opts.calorieTarget * 1.2

  if (opts.isPrePeriod && (lowEnergy || lowMood)) return 'prePeriodLow'
  // Before proteinCared: a day over target shouldn't read as celebration
  // even if protein landed — the deficit (the goal) didn't hold today.
  if (overTarget) return 'overTarget'
  if (proteinGood) return 'proteinCared'
  if (highStress && shortSleep) return 'stressShortSleep'
  if (shortSleep && lowEnergy) return 'shortSleepLowEnergy'
  if (goodSleep && goodEnergy) return 'goodDay'
  return 'aligned'
}

/* 3 variants per category so the same line doesn't repeat day to day
 * (the cooldown picks a fresh one). Copy: observa, no manda; pregunta
 * más que afirma; sin culpa, sin receta, sin imperativo duro. Draft —
 * pasa por voice-and-copy + manifesto-reviewer antes del launch. */
export const DAILY_READING_VARIANTS: Record<DailyReadingCategory, readonly string[]> = {
  prePeriodLow: [
    'Estos días tu cuerpo pide más. Ir más despacio está bien.',
    'La semana antes de tu período pesa distinto. Tiene sentido ir con calma.',
    'Tu cuerpo está pidiendo calma estos días. Dársela está bien.',
  ],
  overTarget: [
    'Hoy tu cuerpo pidió más. ¿Algo pasó?',
    'Hoy hubo más de lo habitual. A veces hay algo detrás.',
    'Un día de más. Tu ritmo sigue mañana.',
  ],
  proteinCared: [
    'Vas cuidando tu proteína. Tu cuerpo lo nota.',
    'Buena proteína hoy. Se nota en cómo te sostiene.',
    'Tu proteína estuvo presente hoy.',
  ],
  stressShortSleep: [
    'Vienes con tensión y poco descanso. Hoy basta con lo suave.',
    'Noche corta y un día cargado. ¿Algo está pesando?',
    'Poco sueño y mucha tensión. Ser suave contigo hoy está bien.',
  ],
  shortSleepLowEnergy: [
    'Dormiste poco y amaneces con poca energía. Ir suave está bien.',
    'Noche corta, y hoy el cuerpo viene en bajo. Tiene sentido.',
    'Poca energía después de poco sueño. Está bien que cueste.',
  ],
  goodDay: [
    'Buena noche, buena energía. El cuerpo viene con impulso hoy.',
    'Dormiste bien y se nota. Hoy hay con qué.',
    'Hoy hay energía. ¿En qué la pones?',
  ],
  aligned: [
    'Tu día va tomando forma.',
    'Hoy tu sistema se está escribiendo.',
    'Vas dejando señal. Sigue tu ritmo.',
  ],
  noSignal: [
    'Tu cielo está en calma, listo para encenderse.',
    'Tu día apenas empieza. En cuanto registres algo, te leo.',
    'Un cielo quieto antes del primer destello. Cuando quieras, empieza.',
  ],
}

/* Categories worth repeating even on consecutive days (high value).
 * The rest are suppressed (silence) if they'd repeat — see useDailyReading. */
export const REPEATABLE_READINGS: readonly DailyReadingCategory[] = [
  'prePeriodLow',
  'proteinCared',
  'stressShortSleep',
  'noSignal',
]
