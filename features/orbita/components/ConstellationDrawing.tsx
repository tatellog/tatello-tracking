import { Circle, G, Line } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Static layers of the Día orbital drawing — outer guide circles
 * (rendered BEHIND the orbits) and the central rings + axis cross
 * (rendered IN FRONT of the orbits). AnimatedConstellation
 * interleaves these two halves around its rotating orbit ellipses
 * so the z-order matches the original SVG:
 *
 *   1. Outer guides     (back)
 *   2. Orbital ellipses (rotating, in AnimatedConstellation)
 *   3. Central rings + axis (front)
 *
 * Source: assets/constellations/orbital_tab_day.svg, 1200 × 1200.
 * The orbit ellipses themselves live in AnimatedConstellation so the
 * static stroke + the rotating wrapper share one declaration.
 */

const STROKE = colors.magenta

export function ConstellationDrawingBack() {
  return (
    <G stroke={STROKE} fill="none" strokeWidth={1.6} opacity={0.28}>
      <Circle cx={600} cy={600} r={420} />
      <Circle cx={600} cy={600} r={280} />
    </G>
  )
}

export function ConstellationDrawingFront() {
  return (
    <>
      {/* Central rings — three small concentric circles. */}
      <G stroke={STROKE} fill="none" strokeWidth={1.4} opacity={0.32}>
        <Circle cx={600} cy={600} r={50} />
        <Circle cx={600} cy={600} r={90} />
        <Circle cx={600} cy={600} r={140} />
      </G>
      {/* Axis cross — vertical + horizontal lines through the
          centre, reaching to the inside of the outer guide. */}
      <G stroke={STROKE} fill="none" strokeWidth={1.6} opacity={0.22}>
        <Line x1={600} y1={180} x2={600} y2={1020} />
        <Line x1={180} y1={600} x2={1020} y2={600} />
      </G>
    </>
  )
}
