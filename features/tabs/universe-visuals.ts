import { colors } from '@/theme'

import type { UniverseAttributeKey } from './universe-rewards'

/*
 * Identidad visual de cada atributo del universo — compartida entre las
 * tarjetas de "Tu universo hoy", el UniverseDeltaToast y las partículas
 * que vuelan hacia la constelación, para que todo el sistema de
 * recompensas hable un solo idioma de color.
 */

// One colour per attribute, all from the dimension palette so the
// universe speaks the same colour language as the rest of the app.
export const UNIVERSE_ACCENT: Record<UniverseAttributeKey, string> = {
  energia: colors.magentaHot,
  claridad: colors.dimension.sueno,
  estabilidad: colors.dimension.mente,
  brillo: colors.dimension.energia,
}

/** 8-digit-hex alpha over an accent — RN parses #RRGGBBAA. */
export const tint = (hex: string, alpha: string) => `${hex}${alpha}`

// Tiny inline SVG paths (repo pattern: tintable, stroke-based, no icon lib).
export const UNIVERSE_ICON_PATH: Record<UniverseAttributeKey, string> = {
  // flame
  energia:
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  // droplet
  claridad:
    'M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z',
  // crescent moon
  estabilidad: 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z',
  // four-point spark
  brillo:
    'M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z',
}
