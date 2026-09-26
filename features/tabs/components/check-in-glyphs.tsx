/*
 * Los glifos del check-in: ✦ (día entrenado, el de la constelación) y ☾ (la
 * noche, el mismo creciente de la cena). Una sola simbología para las filas
 * de Hoy y la evidencia de Órbita Día. Tintables.
 */
import Svg, { Path } from 'react-native-svg'

const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'
const MOON_PATH = 'M15.8 3.2 A 9 9 0 1 0 15.8 20.8 A 7 7 0 1 1 15.8 3.2 Z'

export function StarGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={STAR_PATH} fill={color} />
    </Svg>
  )
}

export function MoonGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={MOON_PATH} fill={color} />
    </Svg>
  )
}
