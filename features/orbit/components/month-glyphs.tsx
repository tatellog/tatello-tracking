import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg'

import { fourPointStarPath } from '@/features/tabs/components/constellation/geometry'
import { colors } from '@/theme'

/*
 * Glifos de Órbita · Mes — dan a cada hallazgo su naturaleza visual (dirección
 * de arte de illustrator-specialist):
 *   · DiscoveryStar → "Haz visible lo invisible": una estrella de la
 *     constelación que SE ENCENDIÓ (la misma chispa de 4 púas del emblema +
 *     halo en el color de su dimensión). Es luz.
 *   · PatternGlyph → "Tus patrones": un anillo de ritmo con un marcador (una
 *     MEDIDA temporal, no luz). Apagado, sin halo.
 * Todo SVG estático: ni un path animado (regla de perf del repo).
 */

/** Estrella encendida de un descubrimiento. `mag` 0..1 (días/máx) modula el
 *  tamaño/brillo de la chispa — jerarquía honesta por evidencia, sutil (no un
 *  "score" gamificado). */
export function DiscoveryStar({
  color,
  mag = 0.5,
  size = 30,
}: {
  color: string
  mag?: number
  size?: number
}) {
  const c = 16
  const r = 4.4 + Math.max(0, Math.min(1, mag)) * 1.8 // 4.4–6.2
  const id = `disc-${color.replace('#', '')}`
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.3 + mag * 0.1} />
          <Stop offset="0.45" stopColor={color} stopOpacity={0.11} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Halo — el "encendido". */}
      <Circle cx={c} cy={c} r={15} fill={`url(#${id})`} />
      {/* Chispa principal — mismo path que la figura del signo. */}
      <Path d={fourPointStarPath(c, c, r)} fill={color} />
      {/* Glint a 45° — destello de 8 púas, sutil. */}
      <Path
        d={fourPointStarPath(c, c, r * 0.55)}
        fill={color}
        rotation={45}
        originX={c}
        originY={c}
        opacity={0.9}
      />
      {/* Núcleo blanco-caliente — el cue "está viva" del hero. */}
      <Circle cx={c} cy={c} r={1.1} fill={colors.leche} opacity={0.9} />
    </Svg>
  )
}

/** Estrella aún sin encender — el par APAGADO de DiscoveryStar. Mismo contorno de
 *  4 púas (continuidad con el emblema y los descubrimientos), pero sin relleno,
 *  sin halo y sin núcleo: el espacio que el cielo todavía no revela. Es la misma
 *  estrella esperando encenderse, no un glifo de otra familia. */
export function DormantStar({ size = 20 }: { size?: number }) {
  const c = 16
  const r = 4.8
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" pointerEvents="none">
      <Path
        d={fourPointStarPath(c, c, r)}
        fill="none"
        stroke={colors.niebla}
        strokeWidth={1}
        strokeLinejoin="round"
        opacity={0.5}
      />
    </Svg>
  )
}

/** Marcador de patrón: un anillo de órbita hairline con un punto en el color de
 *  la dimensión. Es una carta de ritmo, no una estrella: sin halo. */
export function PatternGlyph({ color, size = 26 }: { color: string; size?: number }) {
  const c = 14
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" pointerEvents="none">
      <Circle cx={c} cy={c} r={7} stroke={colors.oroHairlineSoft} strokeWidth={1} fill="none" />
      {/* El marcador en el color de la dimensión, sin halo. */}
      <Circle cx={c} cy={7} r={2.1} fill={color} />
      <Circle cx={c} cy={c} r={0.9} fill={colors.niebla} opacity={0.6} />
    </Svg>
  )
}
