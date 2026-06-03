/*
 * Dimension brightness — the per-day heuristic that lights the six órbita
 * dimensions. Pure, shared by app (Metro) + Edge Functions (Deno). The
 * `alimento` dimension is deficit-aware when macro targets are present.
 */
import type {
  DailySignals,
  Dimension,
  DimensionContext,
  DimensionKey,
  DimensionLayout,
} from './types'

/* The six dimensions of the system — see docs/tu-orbita-design.md §3. */
export const DIMENSIONS: readonly DimensionLayout[] = [
  { key: 'cuerpo', label: 'CUERPO', angleDeg: 312, radiusFrac: 0.82 },
  { key: 'ciclo', label: 'CICLO', angleDeg: 196, radiusFrac: 0.95 },
  { key: 'mente', label: 'MENTE', angleDeg: 8, radiusFrac: 1.0 },
  { key: 'energia', label: 'ENERGÍA', angleDeg: 250, radiusFrac: 0.72 },
  { key: 'sueno', label: 'SUEÑO', angleDeg: 64, radiusFrac: 0.78 },
  { key: 'alimento', label: 'COMIDA', angleDeg: 128, radiusFrac: 0.88 },
]

/** A dimension with no signal still glows faintly — "forming". */
export const DIM_FLOOR = 0.14

export const TONE_BRILLANTE = 0.7
export const TONE_FORMACION = 0.3
/** Legacy threshold for the orb-lit-or-not visual. */
export const EN_LUZ_THRESHOLD = TONE_FORMACION

export function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n
}

/*
 * Per-dimension brightness from today's signals. A v1 heuristic; each
 * branch falls back to DIM_FLOOR when its signal is absent.
 */
function brightnessFor(key: DimensionKey, s: DailySignals, ctx?: DimensionContext): number {
  switch (key) {
    case 'cuerpo':
      return s.trained ? 0.9 : s.rested ? 0.55 : DIM_FLOOR

    case 'energia':
      return s.energy == null ? DIM_FLOOR : clamp01(s.energy / 5)

    case 'mente': {
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
      const duration = clamp01(1 - Math.abs(s.sleep_minutes / 60 - 7.5) / 4)
      if (s.sleep_quality == null) return duration
      return (duration + clamp01(s.sleep_quality / 5)) / 2
    }

    case 'alimento': {
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
      return s.meal_count ? clamp01(0.35 + (s.meal_count / 3) * 0.65) : DIM_FLOOR
    }

    case 'ciclo':
      return s.on_period ? 0.82 : DIM_FLOOR
  }
}

/* A one-word state caption for a dimension. `null` means stay quiet. */
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

/** Resolve the six dimensions with today's brightness. `null` signals →
 *  every dimension at the floor. */
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
