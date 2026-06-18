import Svg, { Circle, Ellipse, Line, Path, Polygon } from 'react-native-svg'

import { colors } from '@/theme'

import type { SoulRegionKey } from '../types'

/*
 * Glifos de las 6 regiones del Alma Celeste — SVG finos, on-brand (oro),
 * tintables vía `color`. Cada uno evoca su sistema: estrella que late (núcleo),
 * anillos (órbitas), estrellas conectadas (constelaciones), corrientes (flujo),
 * hexágono sagrado (geometría), halo radiante (halo). viewBox 24×24, trazo
 * delicado para que combinen con la estética de líneas del arte.
 */

type Props = { region: SoulRegionKey; size?: number; color?: string }

export function RegionIcon({ region, size = 20, color = colors.oro }: Props) {
  const s = { width: size, height: size }
  const sw = 1.4

  switch (region) {
    case 'nucleo':
      // Estrella de 4 puntas (cóncava) — el núcleo que late.
      return (
        <Svg {...s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2 L13.4 10.6 L22 12 L13.4 13.4 L12 22 L10.6 13.4 L2 12 L10.6 10.6 Z"
            fill={color}
          />
        </Svg>
      )
    case 'orbitas':
      // Anillo orbital + núcleo + estrella viajando.
      return (
        <Svg {...s} viewBox="0 0 24 24" fill="none">
          <Ellipse cx={12} cy={12} rx={10} ry={4.4} stroke={color} strokeWidth={sw} />
          <Circle cx={12} cy={12} r={2.2} fill={color} />
          <Circle cx={21.4} cy={12} r={1.5} fill={color} />
        </Svg>
      )
    case 'constelaciones':
      // Tres estrellas conectadas — descubrir conexiones.
      return (
        <Svg {...s} viewBox="0 0 24 24" fill="none">
          <Line x1={5} y1={8} x2={12} y2={17} stroke={color} strokeWidth={sw} />
          <Line x1={12} y1={17} x2={19} y2={6} stroke={color} strokeWidth={sw} />
          <Circle cx={5} cy={8} r={1.8} fill={color} />
          <Circle cx={12} cy={17} r={2} fill={color} />
          <Circle cx={19} cy={6} r={1.8} fill={color} />
        </Svg>
      )
    case 'flujo':
      // Dos corrientes que fluyen — impulso.
      return (
        <Svg {...s} viewBox="0 0 24 24" fill="none">
          <Path
            d="M2 9 C 6 5, 9 13, 13 9 S 19 5, 22 8"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
          />
          <Path
            d="M2 15 C 6 11, 9 19, 13 15 S 19 11, 22 14"
            stroke={color}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeOpacity={0.7}
          />
        </Svg>
      )
    case 'geometria':
      // Hexágono sagrado + centro — conciencia/forma.
      return (
        <Svg {...s} viewBox="0 0 24 24" fill="none">
          <Polygon
            points="12,2.5 20.2,7.25 20.2,16.75 12,21.5 3.8,16.75 3.8,7.25"
            stroke={color}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={12} r={1.6} fill={color} />
        </Svg>
      )
    case 'halo':
      // Halo radiante — el entorno que se integra.
      return (
        <Svg {...s} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={sw} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4
            const x1 = 12 + 6.4 * Math.cos(a)
            const y1 = 12 + 6.4 * Math.sin(a)
            const x2 = 12 + 8.8 * Math.cos(a)
            const y2 = 12 + 8.8 * Math.sin(a)
            return (
              <Line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={sw}
                strokeLinecap="round"
              />
            )
          })}
        </Svg>
      )
  }
}
