/*
 * Pearl Mauve spatial tokens.
 *
 * Spacing es la T-shirt scale (xs…xxxl). Radius semantic — `cell`
 * para celdas chicas, `tile` para el tile gigante de HOY, `card`
 * para cards principales, `screen` para el outer container.
 * Shadows per use-case (card / ctaMauve / tileBig / screenOuter).
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
  cell: 4,
  tile: 12,
  card: 22,
  screen: 38,
  pill: 100,
} as const

export const shadows = {
  card: {
    shadowColor: '#1C1A1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  ctaMauve: {
    shadowColor: '#A85E7C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  tileBig: {
    shadowColor: '#A85E7C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 5,
  },
  screenOuter: {
    shadowColor: '#1C1A1F',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.08,
    shadowRadius: 60,
    elevation: 6,
  },
} as const

export type Spacing = keyof typeof spacing
export type Radius = keyof typeof radius
export type Shadow = keyof typeof shadows
