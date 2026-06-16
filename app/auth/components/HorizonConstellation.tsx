import { Dimensions, StyleSheet, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors } from '@/theme'

// A faint celestial constellation anchored to the BOTTOM of the auth sky —
// it fills the empty lower half without noise. A single hair-thin oro
// connector (0.18pt) curving through a handful of stars, asymmetric like a
// real star chart sitting low on the horizon. Static SVG (no animation, no
// Lottie) → zero TTI cost; the SkyBackground's twinkle + LightDust already
// supply the motion. Sits ABOVE SkyBackground, BELOW the form content;
// decorative only.
//
// The connector is a SMOOTH Bézier curve (not a broken polyline) — the art
// direction asks for mandala/sigil softness, not a generic star-chart
// polygon ("smooth curves, not straight lines"). The shape is loosely a
// fragment of a larger figure trailing off-canvas (the asymmetry the art
// direction asks for — perfection with one elegant imperfection). NO
// recognisable object, NO body: just light cartography.
const { width: SCREEN_W } = Dimensions.get('window')

// Normalised viewBox 0..100 (x) × 0..40 (y); scaled to full width, ~38% as
// tall, pinned to the bottom. Points hand-placed for an off-balance drift.
const STARS: { x: number; y: number; r: number; o: number }[] = [
  { x: 8, y: 30, r: 1.3, o: 0.5 },
  { x: 24, y: 22, r: 0.9, o: 0.38 },
  { x: 41, y: 31, r: 1.6, o: 0.6 }, // the anchor — slightly brighter
  { x: 58, y: 19, r: 0.8, o: 0.34 }, // detached for asymmetry — no connector
  { x: 73, y: 27, r: 1.1, o: 0.46 },
  { x: 90, y: 14, r: 0.9, o: 0.36 },
]

// The connector traces a single smooth ROUTE through a subset of the stars
// (not every pair, and deliberately skipping star index 3 so it floats free
// — the elegant imperfection). The path index order below is the curve's
// spine; star 3 is absent, leaving it detached.
const ROUTE = [0, 1, 2, 4, 5]

// Build one Catmull-Rom spline through the routed points and emit it as a
// cubic-Bézier <Path>. Same render cost as the old <Line> set, but the
// connector reads as a curved sigil instead of a faceted polygon. Computed
// once at module load (points are static).
function buildSmoothPath(): string {
  const pts = ROUTE.map((i) => STARS[i]).filter(
    (p): p is { x: number; y: number; r: number; o: number } => p != null,
  )
  if (pts.length < 2) return ''
  // Catmull-Rom → Bézier, tension 1/6 (standard) for a gentle, organic arc.
  const t = 1 / 6
  const first = pts[0]!
  let d = `M${first.x} ${first.y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p0 = pts[i - 1] ?? p1
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) * t
    const c1y = p1.y + (p2.y - p0.y) * t
    const c2x = p2.x - (p3.x - p1.x) * t
    const c2y = p2.y - (p3.y - p1.y) * t
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x} ${p2.y}`
  }
  return d
}

const ROUTE_PATH = buildSmoothPath()

const ASPECT = 0.4 // viewBox height / width fraction used below
const SVG_H = SCREEN_W * ASPECT

export function HorizonConstellation() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width={SCREEN_W} height={SVG_H} viewBox="0 0 100 40">
        <Path
          d={ROUTE_PATH}
          stroke={colors.oro}
          strokeWidth={0.18}
          strokeOpacity={0.22}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {STARS.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colors.oroLight} opacity={s.o} />
        ))}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
})
