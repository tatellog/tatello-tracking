/*
 * "La evidencia" al estilo Destacados de Apple Salud (dueña 5 oct 2026): los
 * íconos de las dos cosas que se cruzan, la categoría en su color y un chip
 * con la diferencia. Lógica PURA: el componente solo pinta.
 *
 * El chip describe la diferencia, no juzga: en los patrones de exceso
 * (superávit, días sobre la meta) no hay chip, para no festejar ni señalar.
 */
import { colors } from '@/theme'

import type { EvidenceBar } from './month-built'

/** Nombres de MaterialCommunityIcons (@expo/vector-icons). */
export type EvidenceIconName =
  | 'dumbbell'
  | 'food-drumstick'
  | 'fire'
  | 'moon-waning-crescent'
  | 'calendar-week'
  | 'silverware-fork-knife'
  | 'star-four-points'

export type EvidenceIcon = { name: EvidenceIconName; color: string }

export type EvidenceLook = {
  /** "PROTEÍNA", "DÉFICIT"… (se pinta en mayúsculas). */
  kicker: string
  accent: string
  icons: EvidenceIcon[]
}

const ENTRENO: EvidenceIcon = { name: 'dumbbell', color: colors.dimension.mente }
const PROTEINA: EvidenceIcon = { name: 'food-drumstick', color: colors.signal.proteina }
const DEFICIT: EvidenceIcon = { name: 'fire', color: colors.oro }
const SUENO: EvidenceIcon = { name: 'moon-waning-crescent', color: colors.dimension.sueno }
const SEMANA: EvidenceIcon = { name: 'calendar-week', color: colors.bone }
const COMIDA: EvidenceIcon = { name: 'silverware-fork-knife', color: colors.dimension.alimento }

const LOOKS: Record<string, EvidenceLook> = {
  'training-protein': {
    kicker: 'Proteína',
    accent: colors.signal.proteina,
    icons: [ENTRENO, PROTEINA],
  },
  'consistent-protein': { kicker: 'Proteína', accent: colors.signal.proteina, icons: [PROTEINA] },
  'consistent-training': { kicker: 'Entreno', accent: colors.dimension.mente, icons: [ENTRENO] },
  'consistent-sleep': { kicker: 'Sueño', accent: colors.dimension.sueno, icons: [SUENO] },
  'movement-deficit': { kicker: 'Déficit', accent: colors.oro, icons: [ENTRENO, DEFICIT] },
  'workout-type-deficit': { kicker: 'Déficit', accent: colors.oro, icons: [ENTRENO, DEFICIT] },
  'sleep-deficit': { kicker: 'Sueño', accent: colors.dimension.sueno, icons: [SUENO, DEFICIT] },
  'sleep-in-deficit': { kicker: 'Sueño', accent: colors.dimension.sueno, icons: [SUENO, DEFICIT] },
  'deficit-daytype': { kicker: 'Déficit', accent: colors.oro, icons: [SEMANA, DEFICIT] },
  'deficit-weekday': { kicker: 'Déficit', accent: colors.oro, icons: [SEMANA, DEFICIT] },
  'surplus-concentration': { kicker: 'Comida', accent: colors.bone, icons: [SEMANA, COMIDA] },
  'weekend-surplus': { kicker: 'Comida', accent: colors.bone, icons: [SEMANA, COMIDA] },
  'second-half': { kicker: 'Comida', accent: colors.bone, icons: [SEMANA, COMIDA] },
}

/** Patrones de exceso: sin chip de diferencia (ni festejo ni señalamiento). */
const NO_CHIP = new Set(['surplus-concentration', 'weekend-surplus', 'second-half'])

export function evidenceLook(id: string | undefined, fallbackAccent: string): EvidenceLook {
  return (
    (id ? LOOKS[id] : undefined) ?? {
      kicker: 'Patrón',
      accent: fallbackAccent,
      icons: [{ name: 'star-four-points', color: fallbackAccent }],
    }
  )
}

/** La tasa de una barra con denominador (0..1), o null si es un valor crudo. */
export function barRate(b: EvidenceBar): number | null {
  return b.total != null && b.total > 0 ? b.value / b.total : null
}

/** Largo relativo de cada barra (0..1). Con denominador, la TASA (si no, "11
 *  de 22" se vería más largo que "7 de 8"); sin él, contra el mayor. */
export function barFractions(bars: readonly EvidenceBar[]): number[] {
  const max = Math.max(1, ...bars.map((b) => b.value))
  return bars.map((b) => barRate(b) ?? b.value / max)
}

/**
 * El chip de la diferencia: "+26 g con entreno" (valores) o "75% contra 43%"
 * (tasas). Solo con exactamente dos barras, una resaltada y a su favor.
 */
export function evidenceChip(
  id: string | undefined,
  bars: readonly EvidenceBar[],
  unit: string,
): string | null {
  if (id && NO_CHIP.has(id)) return null
  if (bars.length !== 2) return null
  const hi = bars.find((b) => b.highlight)
  const other = bars.find((b) => b !== hi)
  if (!hi || !other) return null
  const rHi = barRate(hi)
  const rOther = barRate(other)
  if (rHi != null && rOther != null) {
    const a = Math.round(rHi * 100)
    const b = Math.round(rOther * 100)
    return a > b ? `${a}% contra ${b}%` : null
  }
  const diff = Math.round(hi.value - other.value)
  if (diff <= 0) return null
  return `+${diff} ${unit} ${hi.label.toLowerCase()}`
}
