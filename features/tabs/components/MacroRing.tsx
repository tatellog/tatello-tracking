import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
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

  // Each halo's opacity envelope — base + breath amplitude. Inner
  // disc breathes the widest because it's the hot core; outer disc
  // barely shifts so the ring edge doesn't visibly pulse.
  const halo1Props = useAnimatedProps(() => ({
    opacity: 0.04 + glow.value * 0.05,
  }))
  const halo2Props = useAnimatedProps(() => ({
    opacity: 0.07 + glow.value * 0.08,
  }))
  const halo3Props = useAnimatedProps(() => ({
    opacity: 0.12 + glow.value * 0.12,
  }))

  return (
    <View style={[styles.glow, { width: size, height: size, shadowColor: color }]}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        {/* Inner halo — three stacked low-alpha discs approximate a
            soft radial glow inside the ring, now BREATHING in unison
            so the metric feels alive (the heartbeat of the macro). */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={Math.max(0, r - 2)}
          fill={color}
          animatedProps={halo1Props}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={Math.max(0, r - 8)}
          fill={color}
          animatedProps={halo2Props}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={Math.max(0, r - 16)}
          fill={color}
          animatedProps={halo3Props}
        />
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
