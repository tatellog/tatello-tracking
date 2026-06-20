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
  },
  {
    id: 'noche',
    label: 'Noche',
    bg: '#070407',
    nebulaColor: colors.leche,
    nebulaAlpha: 0.045,
    glow: colors.niebla,
    swatch: ['#1C151A', '#070407'],
  },
  {
    id: 'oro',
    label: 'Oro',
    bg: '#140A08',
    nebulaColor: colors.oro,
    nebulaAlpha: 0.1,
    glow: colors.oro,
    swatch: [colors.oro, '#140A08'],
  },
  {
    id: 'indigo',
    label: 'Índigo',
    bg: '#0A0A16',
    nebulaColor: '#8C8AD8',
    nebulaAlpha: 0.13,
    glow: '#6E6CC4',
    swatch: ['#2A2A52', '#0A0A16'],
  },
]

export const DEFAULT_SHARE_STYLE: ShareCardStyle = SHARE_CARD_STYLES[0]!
