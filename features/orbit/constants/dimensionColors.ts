import type { DimensionKey } from '../logic'

/*
 * Per-dimension Spanish label (domain copy, not theme).
 *
 * The colour token lives in `theme/colors.ts` as `colors.dimension`
 * — pull from there for halos, accents, gradient stops. This file
 * only owns the user-facing label, which is i18n-domain content.
 */
export const DIM_LABEL: Record<DimensionKey, string> = {
  cuerpo: 'tu cuerpo',
  sueno: 'tu sueño',
  alimento: 'tu comida',
  ciclo: 'tu ciclo',
  energia: 'tu energía',
  mente: 'tu mente',
}
