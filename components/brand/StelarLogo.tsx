import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { colors } from '@/theme'

import { StelarIcon } from './StelarIcon'

/*
 * StelarLogo — el lockup de marca: ícono S9 + wordmark "STELAR". Ambos son
 * brand assets exportados (PNG con alpha); el wordmark NUNCA se usa como
 * fuente de UI — solo aquí, en contextos de marca (splash, welcome, share
 * cards, marketing). Para body/botones/labels usa tipografía normal.
 *
 * Variantes:
 *  · horizontal  — ícono + wordmark en fila, a color.
 *  · stacked     — ícono ARRIBA, wordmark debajo (lockup vertical centrado).
 *  · icon-only   — solo la marca (el aro orbital).
 *  · wordmark    — solo el wordmark (cuando ya hay un hero aparte).
 *  · monochrome  — lockup tintado a un color (default texto leche).
 *  · inverse     — lockup tintado oscuro, para fondos claros.
 */

// 1905×825 — wordmark exportado (sin padding transparente: el contenido llena
// el canvas, así que el ratio es el del archivo).
const WORDMARK = require('@/assets/stelar-word-mark.png')
const WORDMARK_RATIO = 1905 / 825

export type StelarLogoVariant =
  | 'horizontal'
  | 'stacked'
  | 'icon-only'
  | 'wordmark'
  | 'monochrome'
  | 'inverse'

type Props = {
  /** Altura del ícono (o del wordmark en variant `wordmark`) en px. */
  size?: number
  /** Tinte para `monochrome`/`wordmark` (default: texto leche). */
  color?: string
  variant?: StelarLogoVariant
  style?: StyleProp<ViewStyle>
}

export function StelarLogo({ size = 28, color, variant = 'horizontal', style }: Props) {
  if (variant === 'icon-only') {
    return <StelarIcon size={size} color={color} style={style as never} />
  }

  if (variant === 'stacked') {
    // El aro (size) trae ~20% de margen transparente por lado, así que el
    // wordmark se sube para sentarse justo bajo el círculo visible, no bajo
    // el borde del canvas. Ancho ~0.80·size para empatar con el aro.
    const wordW = Math.round(size * 0.8)
    const wordH = Math.round(wordW / WORDMARK_RATIO)
    return (
      <View accessibilityRole="image" accessibilityLabel="Stelar" style={[styles.col, style]}>
        <StelarIcon size={size} color={color} />
        <Image
          source={WORDMARK}
          resizeMode="contain"
          style={[
            { width: wordW, height: wordH, marginTop: -Math.round(size * 0.17) },
            color ? { tintColor: color } : null,
          ]}
        />
      </View>
    )
  }

  if (variant === 'wordmark') {
    const h = size
    const w = Math.round(h * WORDMARK_RATIO)
    return (
      <Image
        source={WORDMARK}
        accessibilityRole="image"
        accessibilityLabel="Stelar"
        resizeMode="contain"
        style={[{ width: w, height: h }, color ? { tintColor: color } : null, style as never]}
      />
    )
  }

  const isInverse = variant === 'inverse'
  const isMono = isInverse || variant === 'monochrome'
  const tint = isInverse ? colors.bg : (color ?? colors.leche)
  const iconVariant = isInverse ? 'inverse' : isMono ? 'monochrome' : 'color'

  // El wordmark pesa ~0.72 de la altura del ícono para que se lea bien (es un
  // trazo delgado).
  const wordH = Math.round(size * 0.72)
  const wordW = Math.round(wordH * WORDMARK_RATIO)
  // El aro trae ~19% de margen transparente a su derecha (el wordmark ya no
  // trae padding propio), así que un marginLeft negativo cierra ese aire y los
  // deja como un solo lockup con un respiro mínimo.
  const pull = -Math.round(size * 0.14)

  return (
    <View accessibilityRole="image" accessibilityLabel="Stelar" style={[styles.row, style]}>
      <StelarIcon size={size} color={color} variant={iconVariant} />
      <Image
        source={WORDMARK}
        resizeMode="contain"
        style={[
          { width: wordW, height: wordH, marginLeft: pull },
          isMono ? { tintColor: tint } : null,
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  col: {
    alignItems: 'center',
  },
})
