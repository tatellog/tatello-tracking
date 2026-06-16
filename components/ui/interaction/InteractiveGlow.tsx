import { useEffect } from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { colors } from '@/theme'

import { interactionTokens } from './tokens'

/**
 * A very subtle idle halo for a HERO interactive element (e.g. the
 * constellation). Breathes between glowIdleOpacity and a touch brighter over a
 * slow (~7s) cycle so the element reads as "alive / touchable" — never a loud
 * button. Pointer-transparent; render it BEHIND the content (absolute). Static
 * at idle opacity under reduced-motion. Always paired with another signal
 * (a CTA label / press feedback) — a glow alone is not enough.
 */
export function InteractiveGlow({
  color = colors.oroLight,
  period = 7000,
  active = false,
  style,
}: {
  color?: string
  /** Full breath cycle in ms. */
  period?: number
  /** Force the brighter active opacity (e.g. while focused). */
  active?: boolean
  style?: ViewStyle
}) {
  const t = useSharedValue(0)
  // Mirror the `active` prop into a shared value so the worklet always reads
  // the live state on the UI thread, never a captured copy.
  const activeSV = useSharedValue(active ? 1 : 0)
  const reduceMotion = useReducedMotion()
  const { glowIdleOpacity, glowActiveOpacity } = interactionTokens

  useEffect(() => {
    activeSV.value = active ? 1 : 0
  }, [active, activeSV])

  useEffect(() => {
    if (reduceMotion || active) {
      t.value = active ? 1 : 0.5
    } else {
      t.value = withRepeat(
        withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      )
    }
    // Always return the cleanup (cancelAnimation is a no-op when nothing is
    // animating) so re-running deps never leaves a loop uncancelled.
    return () => cancelAnimation(t)
  }, [reduceMotion, active, period, t])

  const animatedStyle = useAnimatedStyle(() => {
    // Idle breathes 60→100% of the idle opacity; active pins to the brighter
    // value. Kept low so it's a halo, never a filled box.
    const o = activeSV.value === 1 ? glowActiveOpacity : glowIdleOpacity * (0.6 + t.value * 0.4)
    return { opacity: o }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.glow, { backgroundColor: color }, animatedStyle, style]}
    />
  )
}

const styles = StyleSheet.create({
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9999,
  },
})
