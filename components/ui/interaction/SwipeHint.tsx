import { useEffect } from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

/**
 * A horizontal "swipe me" affordance — a › that gently bounces sideways, with
 * an optional label ("Desliza"). Show it under/beside a horizontal pager the
 * first time(s) until the user swipes. Static under reduced-motion. Pairs with
 * the pager's dots (≥2 signals).
 */
export function SwipeHint({
  label,
  color = colors.niebla,
  style,
}: {
  label?: string
  color?: string
  style?: ViewStyle
}) {
  const x = useSharedValue(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) return
    x.value = withRepeat(
      withSequence(
        withTiming(4, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    )
    return () => cancelAnimation(x)
  }, [reduceMotion, x])

  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  return (
    <View style={[styles.row, style]} accessibilityElementsHidden importantForAccessibility="no">
      {label ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
      <Animated.Text style={[styles.arrow, { color }, arrowStyle]}>›</Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: typography.ui, fontSize: typography.sizes.micro },
  arrow: { fontFamily: typography.uiMedium, fontSize: typography.sizes.heading },
})
