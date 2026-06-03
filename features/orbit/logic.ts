import type { DailySignals } from './api'

/* The six dimensions of the system — see docs/tu-orbita-design.md §3. */
export type DimensionKey = 'cuerpo' | 'energia' | 'mente' | 'alimento' | 'sueno' | 'ciclo'

export type DimensionLayout = {
  key: DimensionKey
  label: string
  /** Fixed angle on the orbital plane, degrees clockwise from 12 o'clock. */
  angleDeg: number
  /** Fixed orbit radius, fraction (0..1) of the canvas's max radius. */
  radiusFrac: number
}

/*
 * Fixed layout — the angle of each dimension NEVER changes day to
 * day, so the user learns "sueño lives upper-right" (see
 * docs/tu-orbita-design.md §4). The radius is tuned per dimension so
 * that, once the tilted plane foreshortens it, every node clears the
 * core by a similar margin — the ones near the top/bottom of the
 * plane sit further out to make up for the squash.
 */
export const DIMENSIONS: readonly DimensionLayout[] = [
  { key: 'cuerpo', label: 'CUERPO', angleDeg: 312, radiusFrac: 0.82 },
  { key: 'ciclo', label: 'CICLO', angleDeg: 196, radiusFrac: 0.95 },
  { key: 'mente', label: 'MENTE', angleDeg: 8, radiusFrac: 1.0 },
  { key: 'energia', label: 'ENERGÍA', angleDeg: 250, radiusFrac: 0.72 },
  { key: 'sueno', label: 'SUEÑO', angleDeg: 64, radiusFrac: 0.78 },
  { key: 'alimento', label: 'COMIDA', angleDeg: 128, radiusFrac: 0.88 },
]

export type Dimension = DimensionLayout & {
  /** 0 (lejos — a dark ember) … 1 (en luz — full glow). */
  brightness: number
  /** A one-word state caption — "clara", "corto" — shown under the
   *  label in the diagram. `null` when there's nothing to say. */
  word: string | null
}

/** A dimension with no signal still glows faintly — "forming", never
 *  a dead void (docs/tu-orbita-design.md §8). */
const DIM_FLOOR = 0.14

/** Brightness cutoffs for the three-tone state language. STELAR
 *  registers, doesn't judge — so the language is *brillante* (alight),
 *  *en formación* (gathering), *en silencio* (no signal yet). The
 *  visual orb lights from "en formación" up; only "en silencio" is a
 *  hollow station. */
export const TONE_BRILLANTE = 0.7
export const TONE_FORMACION = 0.3

/** Legacy threshold kept for the existing orb-lit-or-not visual.
 *  Set to the *en formación* floor so anything with real signal lights. */
export const EN_LUZ_THRESHOLD = TONE_FORMACION

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/** Extra context the brightness heuristics can use. Today only `alimento`
 *  reads it: with the user's macro targets set (a deficit goal), the food
 *  dimension becomes a DEFICIT-ADHERENCE read — protein hit + calories
 *  within target — instead of a meal-count read. Eating over the target
 *  breaks the deficit, so the dimension dims (honestly, never "failure").
 *  Threaded in from `useMacroTargets`; absent → the meal-count fallback. */
export type DimensionContext = {
  calorieTarget?: number | null
  proteinTarget?: number | null
}

/*
 * Per-dimension brightness from today's signals. This is a deliberate
 * v1 heuristic — the órbita engine will refine the exact rule once the
 * Anthropic key is in. Each function falls back to DIM_FLOOR when its
 * signal is absent.
 */
function brightnessFor(key: DimensionKey, s: DailySignals, ctx?: DimensionContext): number {
  switch (key) {
    case 'cuerpo':
      // Trained today reads brightest; a logged rest day glows mid.
      return s.trained ? 0.9 : s.rested ? 0.55 : DIM_FLOOR

    case 'energia':
      return s.energy == null ? DIM_FLOOR : clamp01(s.energy / 5)

    case 'mente': {
      // Mood, low stress and motivation — averaged over what exists.
      const parts: number[] = []
      if (s.mood != null) {
        parts.push(s.mood === 'good' ? 1 : s.mood === 'neutral' ? 0.6 : 0.28)
      }
      if (s.stress != null) parts.push(clamp01((6 - s.stress) / 5))
      if (s.motivation != null) parts.push(clamp01(s.motivation / 5))
      if (parts.length === 0) return DIM_FLOOR
      return parts.reduce((a, b) => a + b, 0) / parts.length
    }

    case 'sueno': {
      if (s.sleep_minutes == null) return DIM_FLOOR
      // 7.5 h is the bright peak, falling off either side.
      const duration = clamp01(1 - Math.abs(s.sleep_minutes / 60 - 7.5) / 4)
      if (s.sleep_quality == null) return duration
      return (duration + clamp01(s.sleep_quality / 5)) / 2
    }

    case 'alimento': {
      // Target-aware when macros are set: the food dimension lights from
      // PROTEIN adherence + staying within the calorie target, not from
      // sheer meal count. Over the target the deficit is gone, so it dims
      // (≈60 % over → floor). No target → the old meal-count read.
      const calTarget = ctx?.calorieTarget ?? null
      if (calTarget && calTarget > 0) {
        if (s.calories == null && s.protein_g == null && !s.meal_count) return DIM_FLOOR
        const protTarget = ctx?.proteinTarget ?? null
        const proteinPct =
          protTarget && protTarget > 0 ? clamp01((s.protein_g ?? 0) / protTarget) : 0.6
        const calPct = (s.calories ?? 0) / calTarget
        const calFactor = calPct <= 1 ? 1 : clamp01(1 - (calPct - 1) * 1.6)
        return Math.max(DIM_FLOOR, clamp01((0.45 + proteinPct * 0.55) * calFactor))
      }
      // ~3 logged meals reads as a full day nourished.
      return s.meal_count ? clamp01(0.35 + (s.meal_count / 3) * 0.65) : DIM_FLOOR
    }

    case 'ciclo':
      // A daily signal that's mostly quiet — it lights during the
      // period. Phase-aware glow is a job for the engine.
      return s.on_period ? 0.82 : DIM_FLOOR
  }
}

/* A one-word state caption for a dimension — the engine will write
 * these; for now a light heuristic. `null` means stay quiet. */
function dimensionWord(key: DimensionKey, s: DailySignals): string | null {
  switch (key) {
    case 'mente':
      if (s.mood == null && s.stress == null && s.motivation == null) return null
      return brightnessFor('mente', s) >= 0.6 ? 'clara' : 'nublada'
    case 'sueno': {
      if (s.sleep_minutes == null) return null
      const h = s.sleep_minutes / 60
      return h < 7 ? 'corto' : h > 8.5 ? 'largo' : 'pleno'
    }
    case 'cuerpo':
      return s.trained ? 'activo' : null
    case 'energia':
      return s.energy == null ? null : s.energy >= 4 ? 'alta' : s.energy <= 2 ? 'baja' : null
    case 'ciclo':
      return s.on_period ? 'sangrado' : null
    default:
      return null
  }
}

/** Resolve the six dimensions with today's brightness. `null` signals
 *  (nothing logged) → every dimension at the floor. */
export function deriveDimensions(
  signals: DailySignals | null,
  ctx?: DimensionContext,
): Dimension[] {
  return DIMENSIONS.map((d) => ({
    ...d,
    brightness: signals == null ? DIM_FLOOR : brightnessFor(d.key, signals, ctx),
    word: signals == null ? null : dimensionWord(d.key, signals),
  }))
}

/** How many dimensions are currently "en luz" (brillante + en formación). */
export function countEnLuz(dims: Dimension[]): number {
  return dims.filter((d) => d.brightness >= EN_LUZ_THRESHOLD).length
}

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
    'Le diste a tu cuerpo lo que necesita hoy.',
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
    'Energía en alto hoy. Para disfrutarla si quieres.',
  ],
  aligned: [
    'Tu día va tomando forma.',
    'Hoy tu sistema se está escribiendo.',
    'Vas dejando señal. Sigue tu ritmo.',
  ],
  noSignal: [
    'Tu día está por escribirse. En cuanto registres algo, empiezo a leerte.',
    'Aún no hay señal de hoy. Cuando registres, te leo.',
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
