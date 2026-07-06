import { Feather } from '@expo/vector-icons'

/*
 * EL CONTRATO DE ICONOS (C1 · 5 jul 2026, modelo SF Symbols). Tres niveles,
 * cada uno con su casa — la regla completa vive también en
 * docs/design-tokens-inventory.md:
 *
 *   1. FAMILIA DE PRODUCTO — line-art `currentColor` en assets/icons
 *      (water-tint, north-star-tint, moon-tint, orbits, food-vect...).
 *      Es LA familia para conceptos Stelar (señales, celestial, tabs).
 *      Se tinta con el rol de color del contexto (p. ej. ICON_GOLD).
 *   2. CHROME — verbos de interfaz (volver, cerrar, cámara). SOLO el
 *      subconjunto Feather sancionado de abajo. Feather NUNCA representa
 *      un concepto de producto (nada de Feather para sueño/agua/ciclo).
 *      ¿Necesitas un glifo nuevo? Se agrega a CHROME_GLYPHS aquí (se ve
 *      en el diff), no importando Feather directo.
 *   3. ILUSTRACIONES — las "vect" con fills horneados (energy-vect,
 *      water-vect...) NO son iconos: viven a tamaño hero/ceremonial y no
 *      tintan.
 *
 *   Glifos unicode: ✦ es voz de marca (se queda); › ‹ ✓ ↑ como iconos en
 *   Text migran gradualmente a Chrome (renderizan distinto iOS/Android).
 */

export const CHROME_GLYPHS = [
  'chevron-left',
  'chevron-right',
  'chevron-down',
  'x',
  'camera',
  'eye',
  'eye-off',
  'arrow-right',
] as const

export type ChromeGlyph = (typeof CHROME_GLYPHS)[number]

/** Icono de chrome utilitario — el único camino sancionado a Feather. */
export function Chrome({
  name,
  size = 24,
  color,
}: {
  name: ChromeGlyph
  size?: number
  color?: string
}) {
  return <Feather name={name} size={size} color={color} />
}
