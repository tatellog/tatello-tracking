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

// El acento, atenuado hacia el campo: el color vive como LUZ, no como
// superficie. Lo usan la órbita en progreso y el astro dormido; el color
// PLENO se reserva para el "completo" — así el grid lee como un cielo
// (crema sobre negro con cuatro temperaturas tenues) y no como un
// dashboard de cuatro semáforos saturados compitiendo al mismo peso.
export const UNIVERSE_ACCENT_MUTED: Record<UniverseAttributeKey, string> = {
  energia: tint(colors.magentaHot, 'B3'),
  claridad: tint(colors.dimension.sueno, 'B3'),
  estabilidad: tint(colors.dimension.mente, 'B3'),
  brillo: tint(colors.dimension.energia, 'B3'),
}

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

// Glifos "astro" (dir. de arte illustrator): silueta de línea fina 1.5 + UN
// núcleo de luz filled en el corazón → los cuatro leen como cuerpos celestes
// (no iconos de tracker). La luna lleva su estrella-compañera anidada en el
// hueco del creciente. Render: <Path stroke> + <Circle fill> con el mismo color.
export const UNIVERSE_GLYPH: Record<
  UniverseAttributeKey,
  { body: string; core: { cx: number; cy: number; r: number } }
> = {
  // llama — silueta de fuego con lengüeta interior (la referencia clásica): el
  // rizo interno ES su luz, por eso NO lleva punto-núcleo (core r:0). Lee
  // inequívocamente como fuego, distinta del teardrop de Agua.
  energia: {
    body: 'M8.5 14.5 A2.5 2.5 0 0 0 11 12 c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
    core: { cx: 12, cy: 12, r: 0 },
  },
  // gota — teardrop PURO simétrico (sin lengüeta).
  claridad: {
    body: 'M12 3.4 C 9.2 7 7.9 9.9 7.9 14 a4.1 4.1 0 0 0 8.2 0 C 16.1 9.9 14.8 7 12 3.4 Z',
    core: { cx: 12, cy: 14, r: 1.2 },
  },
  // luna creciente + estrella-compañera anidada en el hueco.
  estabilidad: {
    body: 'M20.2 13.4 A8 8 0 1 1 10.6 3.8 A6.3 6.3 0 0 0 20.2 13.4 Z',
    core: { cx: 13.2, cy: 7.6, r: 1 },
  },
  // destello de 4 puntas cóncavas + núcleo brillante.
  brillo: {
    body: 'M12 2.8 C 12.5 8 14 9.5 21.2 12 C 14 14.5 12.5 16 12 21.2 C 11.5 16 10 14.5 2.8 12 C 10 9.5 11.5 8 12 2.8 Z',
    core: { cx: 12, cy: 12, r: 1.1 },
  },
}
