import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
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

import { useScreenActive } from '@/features/orbit/useScreenActive'
import { colors } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// The arc covers 270°; the bottom 90° is the "gap" that the overflow
// fills when the value exceeds its target.
const ARC_PORTION = 0.75

type Props = {
  /** Consumed amount (not remaining). Can exceed `target`. */
  value: number
  target: number
  size?: number
  /** The main fill — magenta by default. */
  color?: string
  /** The overflow fill (when value > target). Warm amber by default —
   *  a clear "you went over" without being a red alarm. */
  overColor?: string
  delay?: number
}

/*
 * A speedometer-style gauge. A 270° arc with the gap at the bottom;
 * the main fill sweeps from bottom-left clockwise over the top toward
 * bottom-right as the value grows. When the value exceeds the target,
 * a second fill — in `overColor` — continues into the bottom gap, so
 * exceeding the target is visible, not silently clamped.
 *
 * Used on the Hoy macros slider for calories: a budget where going
 * over is a real piece of info the user should see.
 */
export function SpeedometerRing({
  value,
  target,
  size = 88,
  color = colors.magenta,
  overColor = '#F1A65A',
  delay = 200,
}: Props) {
  const r = size / 2 - 6
  const c = 2 * Math.PI * r
  const arcLen = c * ARC_PORTION
  const gapLen = c * (1 - ARC_PORTION)

  const rawPct = target > 0 ? value / target : 0
  const mainPct = Math.min(1, rawPct)
  // Visually cap the overflow at +100% (the gap fully fills). Beyond
  // that the number itself tells the rest.
  const overPct = Math.max(0, Math.min(1, rawPct - 1))

  const progress = useSharedValue(0)
  const overflow = useSharedValue(0)
  const reduce = useReducedMotion()
  // Glow breath — same 2.8 s sine cycle as MacroRing so both cards
  // on the macros slide pulse in unison (one shared heartbeat). The
  // motion lives INSIDE the ring instead of on the card wrapper so
  // the card stays still and legible.
  const glow = useSharedValue(reduce ? 1 : 0)

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(mainPct, { duration: 1400, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }),
    )
    overflow.value = withDelay(
      delay + 250,
      withTiming(overPct, { duration: 900, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }),
    )
  }, [progress, overflow, mainPct, overPct, delay])

  // Also gated on screen-active — same reasoning as MacroRing: Hoy never
  // unmounts, so this loop used to pulse forever. Inactive → mid-glow rest.
  const screenActive = useScreenActive()
  useEffect(() => {
    if (reduce) return
    if (!screenActive) {
      cancelAnimation(glow)
      glow.value = withTiming(0.5, { duration: 300, easing: Easing.out(Easing.quad) })
      return
    }
    glow.value = withRepeat(
      withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(glow)
  }, [glow, reduce, screenActive])

  const mainProps = useAnimatedProps(() => ({
    strokeDasharray: [arcLen * progress.value, c],
  }))

  // The overflow stroke starts where the main one ends. `dashoffset`
  // shifts the dash pattern forward by arcLen so the drawn segment
  // begins at the end of the 270° arc.
  const overProps = useAnimatedProps(() => ({
    strokeDasharray: [gapLen * overflow.value, c],
  }))

  // Breath on the glow layer's wrapper opacity, NOT per-disc animatedProps
  // inside the <Svg>. See MacroRing: a looping animated SVG child repaints
  // the whole gauge 60×/s forever and fights the scroll. The glow discs are
  // now a static sibling svg pulsed by an Animated.View opacity; the gauge's
  // own <Svg> only animates during the one-shot draw-in → static at rest.
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.45 + glow.value * 0.55 }))

  return (
    <View style={[styles.glow, { width: size, height: size, shadowColor: color }]}>
      {/* Inner halo — same vocabulary as MacroRing (fixed-opacity discs,
          the wrapper breathes) so both cards pulse in unison, off-SVG. */}
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
        // Rotates the circle's path-start to the bottom-left, so the
        // arc sweeps bottom-left → left → top → right → bottom-right.
        style={{ transform: [{ rotate: '135deg' }] }}
      >
        {/* Track — the 270° quiet arc. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(244,236,222,0.10)"
          strokeWidth={3.5}
          strokeDasharray={`${arcLen} ${c}`}
        />

        {/* Main fill — grows as the value approaches the target. */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={3.5}
          strokeLinecap="round"
          animatedProps={mainProps}
        />

        {/* Overflow fill — only draws when value > target. Warm
            amber: informational, never red. */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={overColor}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDashoffset={-arcLen}
          animatedProps={overProps}
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
