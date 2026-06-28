import { Image, type ImageStyle, type StyleProp } from 'react-native'

import { colors } from '@/theme'

/*
 * StelarIcon — la marca como ÍCONO (símbolo del producto): el aro orbital con
 * su esfera. Es un brand asset: se usa la imagen exportada, NUNCA se recrea con
 * texto. Para light/dark se tinta vía `tintColor` (el PNG conserva su alpha),
 * no se cambia el archivo.
 */

// La marca del producto (1255×1255, cuadrada). Raster con alpha transparente,
// así que tintar para monocromo/inverso funciona.
const MARK = require('@/assets/stelar-icon.png')

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
      source={MARK}
      accessibilityRole="image"
      accessibilityLabel="Stelar"
      resizeMode="contain"
      style={[{ width: size, height: size }, tint ? { tintColor: tint } : null, style]}
    />
  )
}
