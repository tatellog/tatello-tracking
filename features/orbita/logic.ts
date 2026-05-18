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
 * Fixed orbits — the layout NEVER changes day to day, so the user
 * learns "sueño lives lower-right". Brightness is the only variable
 * (see docs/tu-orbita-design.md §4). Each dimension gets its own
 * radius so the diagram reads as nested orbits, like real planets.
 */
export const DIMENSIONS: readonly DimensionLayout[] = [
  { key: 'cuerpo', label: 'CUERPO', angleDeg: 312, radiusFrac: 0.58 },
  { key: 'ciclo', label: 'CICLO', angleDeg: 196, radiusFrac: 0.66 },
  { key: 'mente', label: 'MENTE', angleDeg: 8, radiusFrac: 0.74 },
  { key: 'energia', label: 'ENERGÍA', angleDeg: 250, radiusFrac: 0.82 },
  { key: 'sueno', label: 'SUEÑO', angleDeg: 64, radiusFrac: 0.91 },
  { key: 'alimento', label: 'ALIMENTO', angleDeg: 128, radiusFrac: 1.0 },
]

export type Dimension = DimensionLayout & {
  /** 0 (lejos — a dark ember) … 1 (en luz — full glow). */
  brightness: number
}

/** A dimension with no signal still glows faintly — "forming", never
 *  a dead void (docs/tu-orbita-design.md §8). */
const DIM_FLOOR = 0.14

/** At/above this brightness a dimension counts as "en luz". */
export const EN_LUZ_THRESHOLD = 0.55

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/*
 * Per-dimension brightness from today's signals. This is a deliberate
 * v1 heuristic — the órbita engine will refine the exact rule once the
 * Anthropic key is in. Each function falls back to DIM_FLOOR when its
 * signal is absent.
 */
function brightnessFor(key: DimensionKey, s: DailySignals): number {
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

    case 'alimento':
      // ~3 logged meals reads as a full day nourished.
      return s.meal_count ? clamp01(0.35 + (s.meal_count / 3) * 0.65) : DIM_FLOOR

    case 'ciclo':
      // A daily signal that's mostly quiet — it lights during the
      // period. Phase-aware glow is a job for the engine.
      return s.on_period ? 0.82 : DIM_FLOOR
  }
}

/** Resolve the six dimensions with today's brightness. `null` signals
 *  (nothing logged) → every dimension at the floor. */
export function deriveDimensions(signals: DailySignals | null): Dimension[] {
  return DIMENSIONS.map((d) => ({
    ...d,
    brightness: signals == null ? DIM_FLOOR : brightnessFor(d.key, signals),
  }))
}

/** How many dimensions are currently "en luz". */
export function countEnLuz(dims: Dimension[]): number {
  return dims.filter((d) => d.brightness >= EN_LUZ_THRESHOLD).length
}

/** The two-word state of a dimension, from its brightness. */
export function dimensionState(brightness: number): 'en luz' | 'lejos' {
  return brightness >= EN_LUZ_THRESHOLD ? 'en luz' : 'lejos'
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
