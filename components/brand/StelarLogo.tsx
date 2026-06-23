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
 *  · horizontal  — ícono + wordmark, a color.
 *  · icon-only   — solo la marca S9.
 *  · wordmark    — solo el wordmark (cuando ya hay un hero aparte).
 *  · monochrome  — lockup tintado a un color (default texto leche).
 *  · inverse     — lockup tintado oscuro, para fondos claros.
 */

// 358×104 — wordmark exportado.
const WORDMARK = require('@/assets/stelar-word-mark.png')
const WORDMARK_RATIO = 358 / 104

export type StelarLogoVariant = 'horizontal' | 'icon-only' | 'wordmark' | 'monochrome' | 'inverse'

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
  // Tanto el S9 como el wordmark traen margen transparente propio (~17% por
  // lado), así que con gap 0 todavía se ven despegados. Un marginLeft negativo
  // generoso cierra ese aire y los deja como un solo lockup.
  const pull = -Math.round(size * 0.26)

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
})
