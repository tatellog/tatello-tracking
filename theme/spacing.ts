/**
 * Norte spatial tokens.
 *
 *   - `spacing`: the s1…s9 scale documented in the design handoff
 *     (4/8/12/16/24/32/48/64/96 px). The t-shirt aliases (xs, sm, …)
 *     are kept so untouched features keep compiling.
 *   - `radius`: Norte uses 4 px for almost every surface
 *     (cards/buttons/cells), 2 px for tick boxes/pills, 100 (pill)
 *     for the legacy round CTAs.
 *   - `shadows`: the magenta glow is the only one that matters for
 *     CTAs. `card` and `screenOuter` stay for pre-existing surfaces.
 */
export const spacing = {
  // Norte canonical scale
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 24,
  s6: 32,
  s7: 48,
  s8: 64,
  s9: 96,

  // T-shirt aliases (legacy)
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
} as const

export const radius = {
  tick: 2,
  cell: 4,
  card: 4,
  tile: 4,
  screen: 4,
  pill: 100,
} as const

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 2,
  },
  /** @deprecated Use `ctaMagenta` */
  ctaMauve: {
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 4,
  },
  ctaMagenta: {
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 4,
  },
  tileBig: {
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 5,
  },
  screenOuter: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.5,
    shadowRadius: 60,
    elevation: 6,
  },
} as const

export type Spacing = keyof typeof spacing
export type Radius = keyof typeof radius
export type Shadow = keyof typeof shadows
