import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { colors } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type Props = {
  value: number
  target: number
  size?: number
  color?: string
  delay?: number
}

export function MacroRing({
  value,
  target,
  size = 72,
  color = colors.magenta,
  delay = 200,
}: Props) {
  const r = size / 2 - 6
  const c = 2 * Math.PI * r
  const pct = Math.min(1, target > 0 ? value / target : 0)
  const progress = useSharedValue(0)
  const reduce = useReducedMotion()

  // Glow breath — 0 → 1 → 0 over 2.8 s, looping. Drives the three
  // inner halo discs' opacity so the ring feels alive without the
  // CARD itself moving (an earlier attempt at a Y-drift on the card
  // read as restless; this contains the motion inside the ring).
  // Suppressed under reduce-motion → glow parks at high end so the
  // halo stays visible, just stops pulsing.
  const glow = useSharedValue(reduce ? 1 : 0)

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(pct, { duration: 1400, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }),
    )
  }, [progress, pct, delay])

  useEffect(() => {
    if (reduce) return
    glow.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [glow, reduce])

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [c * progress.value, c],
  }))

  // Breath lives on the GLOW LAYER's wrapper opacity, NOT on per-disc
  // animatedProps inside the ring's <Svg>. On Android any animated SVG
  // child invalidates the WHOLE <Svg> and redraws every node 60×/s — and
  // this glow loops forever, so the ring's SVG never stopped repainting,
  // splitting the UI thread with the scroll (the macros-slider jank).
  // Now the glow discs are a separate STATIC svg whose Animated.View
  // wrapper pulses opacity (a compositor-only op), and the ring's own
  // <Svg> only animates during the one-shot draw-in → static at rest.
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.45 + glow.value * 0.55 }))

  return (
    <View style={[styles.glow, { width: size, height: size, shadowColor: color }]}>
      {/* Inner halo — three stacked low-alpha discs approximate a soft
          radial glow. Fixed opacities (the peak of the old breath); the
          wrapper's opacity does the breathing so the SVG stays static. */}
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]} pointerEvents="none">
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={Math.max(0, r - 2)} fill={color} opacity={0.09} />
          <Circle cx={size / 2} cy={size / 2} r={Math.max(0, r - 8)} fill={color} opacity={0.15} />
          <Circle cx={size / 2} cy={size / 2} r={Math.max(0, r - 16)} fill={color} opacity={0.24} />
        </Svg>
      </Animated.View>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(244,236,222,0.10)"
          strokeWidth={3.5}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={3.5}
          strokeLinecap="round"
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  glow: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
})
