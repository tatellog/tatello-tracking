import * as Haptics from 'expo-haptics'
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { interactionTokens } from './tokens'

type PressFeedbackOptions = {
  /** Fire a light haptic on touch (default true). */
  haptic?: boolean
  /** Down-scale on press (default true). */
  scale?: boolean
  /** Opacity dip on press (default false). */
  opacity?: boolean
}

/**
 * Shared press-feedback for any tappable surface. Spread `animatedStyle` onto
 * the Animated.View that should react and wire `onPressIn`/`onPressOut` to the
 * Pressable; `triggerHaptic` is exposed for manual use (e.g. on the activating
 * `onPress`). Honours reduced-motion — the scale/opacity animation parks, the
 * haptic still fires.
 *
 * The Animated.View carrying `animatedStyle` should be INSIDE the Pressable,
 * not the Pressable itself, and should hold the visual chrome (border/bg don't
 * render applied straight to a Pressable in this RN setup).
 */
export function usePressFeedback({
  haptic = true,
  scale = true,
  opacity = false,
}: PressFeedbackOptions = {}) {
  const pressed = useSharedValue(0)
  const reduceMotion = useReducedMotion()

  const { pressScale, pressOpacity } = interactionTokens

  // Reduced-motion is handled at the JS handler level (we simply don't animate
  // `pressed`), so the worklet never captures it — only the shared value +
  // per-render constants. No stale-closure surprise in a release build.
  const animatedStyle = useAnimatedStyle(() => {
    const s = scale ? 1 - pressed.value * (1 - pressScale) : 1
    const o = opacity ? 1 - pressed.value * (1 - pressOpacity) : 1
    return { transform: [{ scale: s }], opacity: o }
  })

  const triggerHaptic = () => {
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }

  const onPressIn = () => {
    triggerHaptic()
    if (reduceMotion) return
    pressed.value = withTiming(1, { duration: 90 })
  }
  const onPressOut = () => {
    if (reduceMotion) {
      pressed.value = 0
      return
    }
    pressed.value = withTiming(0, { duration: 200 })
  }

  return { onPressIn, onPressOut, animatedStyle, triggerHaptic }
}
