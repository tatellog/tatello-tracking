import { Circle, Ellipse, G, Line } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * The Día orbital drawing — vectorised from
 * `assets/constellations/orbital_tab_day.svg`. Source viewBox is
 * 1200 × 1200; the parent <G transform> in OrbitalSystem scales
 * and positions this into our smaller canvas.
 *
 * The figure is the SCAFFOLDING of the system: outer guide circles,
 * four tilted orbital ellipses, an axis cross, three central rings.
 * The six dimension stars + the central "tú" star are drawn by
 * StarNode / DecorativeStar layered ON TOP of this drawing — so
 * this component does not render any star nodes itself.
 *
 * Original SVG used `#F7A8D7 / #FFD6F0 / #FF7CCB` (pinks). We
 * project onto STELAR's magenta + low-opacity bruma so the figure
 * stays inside the app's palette while keeping the original
 * structure.
 */

const ORBIT_STROKE = colors.magenta
const THIN_STROKE = colors.magenta

export function ConstellationDrawing() {
  return (
    <>
      {/* Outer guide circles — two thin concentric rings that frame
          the whole figure. Static, very subtle. */}
      <G stroke={THIN_STROKE} fill="none" strokeWidth={1.6} opacity={0.28}>
        <Circle cx={600} cy={600} r={420} />
        <Circle cx={600} cy={600} r={280} />
      </G>

      {/* Four orbital ellipses — each tilted to a different angle so
          the system reads as a real 3-D orbital cluster rather than
          a flat mandala. AnimatedConstellation overlays travelling
          particles on these same shapes. */}
      <G stroke={ORBIT_STROKE} fill="none" strokeWidth={3.5} strokeLinecap="round" opacity={0.7}>
        <Ellipse cx={600} cy={600} rx={360} ry={150} transform="rotate(20 600 600)" />
        <Ellipse cx={600} cy={600} rx={180} ry={420} transform="rotate(10 600 600)" />
        <Ellipse cx={600} cy={600} rx={420} ry={210} transform="rotate(-28 600 600)" />
        <Ellipse cx={600} cy={600} rx={240} ry={120} transform="rotate(-55 600 600)" />
      </G>

      {/* Three central rings — small concentric circles around the
          centre, like the inner shells of an atom. */}
      <G stroke={THIN_STROKE} fill="none" strokeWidth={1.4} opacity={0.32}>
        <Circle cx={600} cy={600} r={50} />
        <Circle cx={600} cy={600} r={90} />
        <Circle cx={600} cy={600} r={140} />
      </G>

      {/* Axis cross — vertical + horizontal lines through the
          centre, reaching to the inside of the outer guide. */}
      <G stroke={THIN_STROKE} fill="none" strokeWidth={1.6} opacity={0.22}>
        <Line x1={600} y1={180} x2={600} y2={1020} />
        <Line x1={180} y1={600} x2={1020} y2={600} />
      </G>
    </>
  )
}
