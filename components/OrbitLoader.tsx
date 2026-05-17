import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// A progress ring that wraps a circular child — e.g. the photo in the
// scan-meal theatre. The magenta arc fills the whole circle, then
// drains, on a loop; a small star rides the fill front. The fill
// reads as "leyendo tu plato" working its way around the plate.
const STROKE = 3.5

// A small 4-point star — rides the fill front. Same celestial
// vocabulary as StarLoader.
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

/* A loading ring that fills around its children — drop a circular
 * image inside and the arc traces and fills its whole edge. */
export function OrbitLoader({
  size,
  color = colors.magentaHot,
  children,
}: {
  /** Outer diameter of the ring. */
  size: number
  color?: string
  children?: ReactNode
}) {
  // p oscillates 0 → 1 → 0: the ring fills, then drains.
  const p = useSharedValue(0)

  useEffect(() => {
    p.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    )
    return () => cancelAnimation(p)
  }, [p])

  const c = size / 2
  const r = c - STROKE
  const circ = 2 * Math.PI * r

  // The fill — strokeDashoffset shrinks from a full circumference
  // (empty) to zero (the whole circle filled).
  const fillProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - p.value),
  }))
  // The star sits where the fill meets the empty track.
  const frontSpin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${p.value * 360}deg` }],
  }))

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Faint full-circle track. */}
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeOpacity={0.16}
          strokeWidth={STROKE}
          fill="none"
        />
        {/* Soft halo behind the fill — a wide, faint arc reads as glow. */}
        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeOpacity={0.3}
          strokeWidth={STROKE * 2.8}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          animatedProps={fillProps}
          rotation={-90}
          originX={c}
          originY={c}
        />
        {/* The crisp filling arc — starts at 12 o'clock, grows clockwise. */}
        <AnimatedCircle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          animatedProps={fillProps}
          rotation={-90}
          originX={c}
          originY={c}
        />
      </Svg>
      {/* The star, carried on the fill front. */}
      <Animated.View style={[StyleSheet.absoluteFill, frontSpin]}>
        <Svg width={size} height={size}>
          <Path d={starPath(c, STROKE, STROKE * 2.1)} fill={color} />
        </Svg>
      </Animated.View>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
