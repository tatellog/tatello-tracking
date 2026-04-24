/*
 * Sprint 2 spatial tokens — spacing scale, radius presets, shadow presets.
 *
 * Spacing is the T-shirt scale (xs…xxxl). Radius has semantic names
 * (cell / card / screen / pill) rather than numeric ones, so a design
 * change maps to a single named intent instead of hunting for literal
 * values. Shadows likewise are per-use-case (card, copperToday) rather
 * than abstract elevations.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
} as const

export const radius = {
  cell: 6,
  card: 22,
  screen: 38,
  pill: 100,
} as const

export const shadows = {
  card: {
    shadowColor: '#15302A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  copperToday: {
    shadowColor: '#B8633D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
} as const

export type Spacing = keyof typeof spacing
export type Radius = keyof typeof radius
export type Shadow = keyof typeof shadows
