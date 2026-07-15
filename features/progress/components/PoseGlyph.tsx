import Svg, { Circle, Path } from 'react-native-svg'

import type { PhotoAngle } from '../api'

/*
 * PoseGlyph (illustrator · jul 2026) — los 4 ángulos de foto como
 * "cartografía de pose": CERO figura humana; la orientación se lee como
 * astronomía con la estrella de 4 puntas canónica (misma geometría que
 * fourPointStarPath, ratio 0.32).
 *
 * - front: estrella LLENA sobre eje sólido, satélites simétricos, horizonte
 *   abierto hacia el observador.
 * - back: el negativo — estrella HUECA, eje punteado visto a través, cúpula
 *   cerrada arriba, satélites huecos.
 * - side_left / side_right: asimetría espejo — el meridiano se curva y la
 *   estrella llena se adelanta al borde con estela de puntos menguantes.
 *
 * Trazo 1.1-1.2 en viewBox 48 (hairline a 44-56pt de render). Un solo tinte;
 * la jerarquía interna es opacity. Fuente SVG en assets/icons/pose-*.svg.
 */

export function PoseGlyph({
  pose,
  size = 48,
  color,
}: {
  pose: PhotoAngle
  size?: number
  color: string
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      {pose === 'front' ? (
        <>
          <Path
            d="M24 7 L24 31.5"
            stroke={color}
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.5}
          />
          <Path
            d="M24 12.5 L25.24 16.76 L29.5 18 L25.24 19.24 L24 23.5 L22.76 19.24 L18.5 18 L22.76 16.76 Z"
            fill={color}
          />
          <Circle cx={15} cy={26.5} r={1.4} fill={color} opacity={0.8} />
          <Circle cx={33} cy={26.5} r={1.4} fill={color} opacity={0.8} />
          <Path
            d="M14 33.5 Q24 39.5 34 33.5"
            stroke={color}
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.55}
          />
          <Circle cx={34} cy={33.5} r={0.8} fill={color} opacity={0.6} />
        </>
      ) : null}
      {pose === 'back' ? (
        <>
          <Path
            d="M14 13.5 Q24 7.5 34 13.5"
            stroke={color}
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.55}
          />
          <Circle cx={14} cy={13.5} r={0.8} fill={color} opacity={0.6} />
          <Path
            d="M24 16.5 L24 41"
            stroke={color}
            strokeWidth={1.2}
            strokeLinecap="round"
            strokeDasharray="0.1 3.4"
            opacity={0.5}
          />
          <Path
            d="M24 19.5 L25.24 23.76 L29.5 25 L25.24 26.24 L24 30.5 L22.76 26.24 L18.5 25 L22.76 23.76 Z"
            stroke={color}
            strokeWidth={1.2}
            strokeLinejoin="round"
            opacity={0.9}
          />
          <Circle cx={15} cy={31} r={1.4} stroke={color} strokeWidth={1.1} opacity={0.7} />
          <Circle cx={33} cy={31} r={1.4} stroke={color} strokeWidth={1.1} opacity={0.7} />
        </>
      ) : null}
      {pose === 'side_left' ? (
        <>
          <Path
            d="M28.5 8 Q16 24 28.5 40"
            stroke={color}
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.55}
          />
          <Circle cx={28.5} cy={8} r={0.9} fill={color} opacity={0.6} />
          <Circle cx={28.5} cy={40} r={0.9} fill={color} opacity={0.6} />
          <Path
            d="M14.5 19.4 L15.54 22.96 L19.1 24 L15.54 25.04 L14.5 28.6 L13.46 25.04 L9.9 24 L13.46 22.96 Z"
            fill={color}
          />
          <Circle cx={34} cy={17} r={1.2} fill={color} opacity={0.7} />
          <Circle cx={36.5} cy={26.5} r={0.9} fill={color} opacity={0.45} />
        </>
      ) : null}
      {pose === 'side_right' ? (
        <>
          <Path
            d="M19.5 8 Q32 24 19.5 40"
            stroke={color}
            strokeWidth={1.2}
            strokeLinecap="round"
            opacity={0.55}
          />
          <Circle cx={19.5} cy={8} r={0.9} fill={color} opacity={0.6} />
          <Circle cx={19.5} cy={40} r={0.9} fill={color} opacity={0.6} />
          <Path
            d="M33.5 19.4 L32.46 22.96 L28.9 24 L32.46 25.04 L33.5 28.6 L34.54 25.04 L38.1 24 L34.54 22.96 Z"
            fill={color}
          />
          <Circle cx={14} cy={17} r={1.2} fill={color} opacity={0.7} />
          <Circle cx={11.5} cy={26.5} r={0.9} fill={color} opacity={0.45} />
        </>
      ) : null}
    </Svg>
  )
}
