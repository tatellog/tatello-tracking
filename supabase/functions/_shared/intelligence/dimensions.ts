/*
 * Dimension brightness — the per-day heuristic that lights the six órbita
 * dimensions. Pure, shared by app (Metro) + Edge Functions (Deno). The
 * `alimento` dimension is deficit-aware when macro targets are present.
 */
import type {
  DailySignals,
  DayIdentity,
  Dimension,
  DimensionContext,
  DimensionKey,
  DimensionLayout,
} from './types'

/* The six dimensions of the system — see docs/tu-orbita-design.md §3.
 *
 * Layout retuned for the m-day centerpiece + LTR reading order:
 *
 *   1. CUERPO (magenta hot) swapped 312° → 196° (upper-left → south)
 *      so the brand-magenta star no longer sits adjacent to the warm
 *      coral sphere at the top of the canvas — the two pinks were
 *      reading as one cluster.
 *   2. CICLO (cool silver-blue) swapped 196° → 312° (south → upper-left)
 *      AND its radiusFrac pulled 0.95 → 0.82 so it INTEGRATES into the
 *      hex instead of floating alone at the bottom. Its silver tone
 *      complements the warm centerpiece without competing.
 *   3. MENTE shifted 8° → 340° (top-right → top-left). The LTR eye
 *      lands on the upper-left first; CICLO is conditional (not every
 *      user has it), so anchoring the FIRST read on a dimension that
 *      may not exist was a bad opening. MENTE always exists → it earns
 *      the aterrizaje. CICLO stays in the upper-left zone but past
 *      MENTE in the scan order.
 */
// Radii UNIFIED at 0.85 (was a 0.72–1.0 range, 39 % variance) so the
// six dimension stars sit at the same distance from the gravity centre.
// Previously the hex read as irregular — mente at the perimeter,
// energía close-in, the rest scattered between. A uniform radius
// makes the hex a true ring around the centerpiece; the dimensions
// read as siblings, not orphans at varying orbits.
export const DIMENSIONS: readonly DimensionLayout[] = [
  { key: 'cuerpo', label: 'CUERPO', angleDeg: 196, radiusFrac: 0.85 },
  { key: 'ciclo', label: 'CICLO', angleDeg: 312, radiusFrac: 0.85 },
  { key: 'mente', label: 'MENTE', angleDeg: 340, radiusFrac: 0.85 },
  { key: 'energia', label: 'ENERGÍA', angleDeg: 250, radiusFrac: 0.85 },
  { key: 'sueno', label: 'SUEÑO', angleDeg: 64, radiusFrac: 0.85 },
  { key: 'alimento', label: 'COMIDA', angleDeg: 128, radiusFrac: 0.85 },
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
      // Bumped rested 0.55 → 0.88 per manifesto (descanso = identidad
      // cumplida, no "casi entrenamiento"). Both trained and rested are
      // positive states for cuerpo; bucketing rested as "en formación"
      // was repeating exactly the MyFitnessPal pattern Stelar promises
      // to break. Rested at 0.88 sits firmly in `brillante` (>= 0.7),
      // a tiny notch under trained's 0.9 to preserve a subtle ordering
      // without telling the user they "fell short".
      return s.trained ? 0.9 : s.rested ? 0.88 : DIM_FLOOR

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
      // Both training and resting deserve a word. Previously rested had
      // no word so the focused state read "CUERPO" alone (the word was
      // null) which felt unfinished. "descansado" gives rest its own
      // identity in the same coach voice as "activo".
      return s.trained ? 'activo' : s.rested ? 'descansado' : null
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

/** The Día header identity from TODAY's live dimensions — replaces the old
 *  mock archetype. One masculine state word ("el día …") plus the honest
 *  count of dimensions en luz. Never a grade: with nothing lit it's "por
 *  encender" (forming), never "vacío". */
export function buildDayIdentity(dims: Dimension[]): DayIdentity {
  const lit = dims.filter((d) => d.brightness >= EN_LUZ_THRESHOLD)
  const enLuz = lit.length
  if (enLuz === 0) {
    return { name: 'Tu día por encender', emphasis: 'por encender', enLuz: 0 }
  }
  // The word reads how bright the LIT dimensions shine — averaging all six
  // would drag the mean down through the dims resting at DIM_FLOOR (ciclo
  // sits there most of the month), so the word could say "naciente" while
  // the meta line shows 4 en luz. Averaging only the lit ones keeps the two
  // coherent; the range here is [EN_LUZ_THRESHOLD, 1].
  const b = lit.reduce((s, d) => s + d.brightness, 0) / enLuz
  const word = b >= 0.8 ? 'encendido' : b >= 0.6 ? 'presente' : b >= 0.45 ? 'en marcha' : 'naciente'
  return { name: `Tu día ${word}`, emphasis: word, enLuz }
}
