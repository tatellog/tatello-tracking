import { Image, type ImageStyle, type StyleProp } from 'react-native'

import { colors } from '@/theme'

/*
 * StelarIcon — la marca S9 como ÍCONO (símbolo del producto). Es un brand
 * asset: se usa la imagen exportada, NUNCA se recrea con texto. Para light/
 * dark se tinta vía `tintColor` (el PNG conserva su alpha), no se cambia el
 * archivo. El lenguaje celeste vive DENTRO del producto, no en la marca: este
 * ícono no lleva estrellas, glow ni galaxia.
 */

// S9 — la marca del producto (645×635, casi cuadrada). Raster con alpha, así
// que tintar para monocromo/inverso funciona.
const S9 = require('@/assets/stelar.png')

export type StelarIconVariant = 'color' | 'monochrome' | 'inverse'

type Props = {
  /** Lado del ícono en px. */
  size?: number
  /** Tinte para `monochrome` (default: texto leche). Ignorado en `color`. */
  color?: string
  variant?: StelarIconVariant
  style?: StyleProp<ImageStyle>
}

export function StelarIcon({ size = 32, color, variant = 'color', style }: Props) {
  const tint =
    variant === 'color'
      ? undefined
      : variant === 'inverse'
        ? colors.bg // marca oscura sobre fondo claro
        : (color ?? colors.leche) // monocromo: texto principal por defecto

  return (
    <Image
      source={S9}
      accessibilityRole="image"
      accessibilityLabel="Stelar"
      resizeMode="contain"
      style={[{ width: size, height: size }, tint ? { tintColor: tint } : null, style]}
    />
  )
}
