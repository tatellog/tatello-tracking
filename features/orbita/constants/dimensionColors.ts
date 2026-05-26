import type { DimensionKey } from '../logic'

/*
 * Per-dimension identity colour.
 *
 * Used by:
 *   • OrbitalSystem — drives the focus-state halo behind the
 *     selected star's glyph during the zoom cinematic.
 *   • DimensionNodeList — tints each badge's petals, ring, glow
 *     and label accent so the right-side list reads as a coloured
 *     index instead of six identical magenta chips.
 *
 * Palette picked so each dimension carries a distinct identity
 * while staying inside the app's warm dark + magenta brand —
 * nothing reads neon, every colour shares a slightly desaturated
 * warm-tinted base.
 */
export const DIM_COLOR: Record<DimensionKey, string> = {
  cuerpo: '#FF4886', // magenta hot
  sueno: '#7C8FFF', // indigo
  alimento: '#9FE2A8', // sage
  ciclo: '#B5C4DD', // cool silver-blue (was #E8DFC8, read as plain white)
  energia: '#FFC56B', // warm gold
  mente: '#C18FFF', // violet
}

export const DIM_LABEL: Record<DimensionKey, string> = {
  cuerpo: 'tu cuerpo',
  sueno: 'tu sueño',
  alimento: 'tu comida',
  ciclo: 'tu ciclo',
  energia: 'tu energía',
  mente: 'tu mente',
}
