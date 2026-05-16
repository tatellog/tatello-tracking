import { useEffect } from 'react'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { colors } from '@/theme'

// A spinning arc with a star at its leading head — the loading
// indicator. Rotation is the universal "working" cue and survives
// any size; the star keeps it STELAR.
const VIEWBOX = 32
const C = VIEWBOX / 2
const R = 10.5
const ARC_START = 95
const ARC_SWEEP = 286

function polar(deg: number): [number, number] {
  const a = (deg * Math.PI) / 180
  return [C + R * Math.cos(a), C + R * Math.sin(a)]
}

const [ARC_X1, ARC_Y1] = polar(ARC_START)
const [HEAD_X, HEAD_Y] = polar(ARC_START + ARC_SWEEP)
const ARC_PATH = `M ${ARC_X1.toFixed(2)} ${ARC_Y1.toFixed(2)} A ${R} ${R} 0 1 1 ${HEAD_X.toFixed(2)} ${HEAD_Y.toFixed(2)}`

// A small 4-point star sitting on the head of the arc.
function starPath(cx: number, cy: number, outer: number): string {
  const inner = outer * 0.4
  let d = ''
  for (let k = 0; k < 8; k += 1) {
    const r = k % 2 === 0 ? outer : inner
    const a = ((k * 45 - 90) * Math.PI) / 180
    d += `${k === 0 ? 'M' : 'L'} ${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)} `
  }
  return `${d}Z`
}

const HEAD_PATH = starPath(HEAD_X, HEAD_Y, 3.6)

/* A celestial loading indicator — use in place of ActivityIndicator. */
export function StarLoader({
  size = 28,
  color = colors.magenta,
}: {
  size?: number
  color?: string
}) {
  const rot = useSharedValue(0)

  useEffect(() => {
    rot.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(rot)
  }, [rot])

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }))

  return (
    <Animated.View style={[{ width: size, height: size }, spin]}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}>
        <Path
          d={ARC_PATH}
          stroke={color}
          strokeWidth={2.6}
          strokeLinecap="round"
          fill="none"
          opacity={0.55}
        />
        <Path d={HEAD_PATH} fill={color} />
      </Svg>
    </Animated.View>
  )
}
