import { colors } from '@/theme'

/*
 * Estilos de fondo para las tarjetas de compartir — el "ESTILO" que la
 * usuaria elige antes de exportar. Todos celestes y cálidos (el sistema
 * visual de Stelar): cambian el fondo base, el glow de la nebulosa y el
 * acento, pero las estrellas y la composición se mantienen.
 *
 * La nebulosa se pinta como GLOW RADIAL en SVG (no degradado lineal): un
 * lineal largo y de bajo contraste sobre oscuro genera banding de 8-bit
 * (líneas horizontales). El radial difumina en curvas y lee como nebulosa.
 *
 * Los hexes bespoke (índigo) viven acá, no en theme/: son arte de la
 * tarjeta compartible, no tokens de la app.
 */

export type ShareCardStyle = {
  id: string
  label: string
  /** Color base del lienzo. */
  bg: string
  /** Color sólido del glow de nebulosa (la alpha la pone `nebulaAlpha`). */
  nebulaColor: string
  /** Opacidad máxima del glow (en el centro del radial). */
  nebulaAlpha: number
  /** Color del glow radial de acento (cama celeste del entreno). */
  glow: string
  /** Gradiente del swatch en la fila de selección. */
  swatch: readonly [string, string]
  /** Aurora (dueña 5 oct 2026): las tres manchas de color del fondo de las
   *  tarjetas nuevas. [0] es el acento (números, anillo, bandas). */
  aurora: readonly [string, string, string]
  /** Texto legible SOBRE el acento (bandas, etiqueta AHORA). */
  onAccent: string
}

export const SHARE_CARD_STYLES: readonly ShareCardStyle[] = [
  {
    id: 'nebulosa',
    label: 'Nebulosa',
    bg: colors.bg,
    nebulaColor: colors.magenta,
    nebulaAlpha: 0.14,
    glow: colors.magenta,
    swatch: [colors.magentaDeep, colors.bg],
    aurora: [colors.magenta, '#6B1FA0', '#F0A35E'],
    onAccent: '#FFFFFF',
  },
  {
    id: 'noche',
    label: 'Noche',
    bg: '#070407',
    nebulaColor: colors.leche,
    nebulaAlpha: 0.045,
    glow: colors.niebla,
    swatch: ['#1C151A', '#070407'],
    aurora: [colors.magenta, '#2A1A24', '#5A2A3A'],
    onAccent: '#FFFFFF',
  },
  {
    id: 'oro',
    label: 'Oro',
    bg: '#140A08',
    nebulaColor: colors.oro,
    nebulaAlpha: 0.1,
    glow: colors.oro,
    swatch: [colors.oro, '#140A08'],
    aurora: [colors.oroSoft, '#B2552A', '#F6D9A0'],
    onAccent: '#1A0A10',
  },
  {
    id: 'indigo',
    label: 'Índigo',
    bg: '#0A0A16',
    nebulaColor: '#8C8AD8',
    nebulaAlpha: 0.13,
    glow: '#6E6CC4',
    swatch: ['#2A2A52', '#0A0A16'],
    aurora: ['#8E9BFF', '#3A1E9A', colors.magenta],
    onAccent: '#FFFFFF',
  },
]

export const DEFAULT_SHARE_STYLE: ShareCardStyle = SHARE_CARD_STYLES[0]!
