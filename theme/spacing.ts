/*
 * Norte spatial tokens.
 *
 * Spacing es la escala s-1…s-9 documentada en el design handoff
 * (4/8/12/16/24/32/48/64/96). Mantengo además los aliases xs/sm/md…
 * para que features pre-existentes sigan compilando.
 *
 * Radius: Norte usa 4px casi universalmente (botones, cards, option
 * rows, segmented toggle), 2px en piezas pequeñas (tick boxes, pills),
 * y 50% para circles decorativos. Los aliases viejos quedan mapeados.
 *
 * Shadows: el glow magenta es el único que cuenta. `tileBig` se queda
 * por compatibilidad pero apunta al mismo glow.
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
  // Norte canonical
  tick: 2,
  cell: 4,
  card: 4,

  // Aliases (legacy — Pearl Mauve used wider radii)
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
  ctaMauve: {
    // Magenta glow del Primary CTA — replicates the CSS
    // `0 6px 24px -8px var(--magenta-glow)`.
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
