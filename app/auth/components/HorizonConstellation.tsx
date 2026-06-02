import { Dimensions, StyleSheet, View } from 'react-native'
import Svg, { Circle, Line } from 'react-native-svg'

import { colors } from '@/theme'

// A faint celestial constellation anchored to the BOTTOM of the auth sky —
// it fills the empty lower half without noise. Hair-thin oro connectors
// (0.6pt) + a handful of stars, asymmetric like a real star chart sitting
// low on the horizon. Static SVG (no animation, no Lottie) → zero TTI cost;
// the SkyBackground's twinkle + LightDust already supply the motion. Sits
// ABOVE SkyBackground, BELOW the form content; decorative only.
//
// The shape is loosely a fragment of a larger figure trailing off-canvas
// (the asymmetry the art direction asks for — perfection with one elegant
// imperfection). NO recognisable object, NO body: just light cartography.
const { width: SCREEN_W } = Dimensions.get('window')

// Normalised viewBox 0..100 (x) × 0..40 (y); scaled to full width, ~38% as
// tall, pinned to the bottom. Points hand-placed for an off-balance drift.
const STARS: { x: number; y: number; r: number; o: number }[] = [
  { x: 8, y: 30, r: 1.3, o: 0.5 },
  { x: 24, y: 22, r: 0.9, o: 0.38 },
  { x: 41, y: 31, r: 1.6, o: 0.6 }, // the anchor — slightly brighter
  { x: 58, y: 19, r: 0.8, o: 0.34 },
  { x: 73, y: 27, r: 1.1, o: 0.46 },
  { x: 90, y: 14, r: 0.9, o: 0.36 },
]

// Connectors trace a path through the stars (not every pair — a route, like
// a constellation line, leaving one star slightly detached for asymmetry).
const LINES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 4],
  [4, 5],
]

const ASPECT = 0.4 // viewBox height / width fraction used below
const SVG_H = SCREEN_W * ASPECT

export function HorizonConstellation() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width={SCREEN_W} height={SVG_H} viewBox="0 0 100 40">
        {LINES.map(([a, b], i) => {
          const sa = STARS[a]
          const sb = STARS[b]
          if (!sa || !sb) return null
          return (
            <Line
              key={i}
              x1={sa.x}
              y1={sa.y}
              x2={sb.x}
              y2={sb.y}
              stroke={colors.oro}
              strokeWidth={0.18}
              strokeOpacity={0.22}
              strokeLinecap="round"
            />
          )
        })}
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
