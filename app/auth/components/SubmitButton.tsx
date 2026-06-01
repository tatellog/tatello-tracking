import { Feather } from '@expo/vector-icons'
import { useEffect } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { StarLoader } from '@/components/StarLoader'
import { colors, duration, easing, radius, shadows, spacing, typography } from '@/theme'

type SubmitButtonProps = {
  label: string
  submittingLabel: string
  canSubmit: boolean
  isSubmitting: boolean
  onPress: () => void
}

/*
 * The single magenta accent. Pill fills magenta when enabled; on submit
 * the arrow is swapped for the StarLoader (leche) so the celestial cue
 * stays inside the brand. Press scale + colour fill park under
 * reduced-motion.
 */
export function SubmitButton({
  label,
  submittingLabel,
  canSubmit,
  isSubmitting,
  onPress,
}: SubmitButtonProps) {
  const scale = useSharedValue(1)
  const ready = useSharedValue(canSubmit ? 1 : 0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) {
      ready.value = canSubmit ? 1 : 0
      return
    }
    ready.value = withTiming(canSubmit ? 1 : 0, {
      duration: duration.standard,
      easing: easing.standard,
    })
    return () => {
      cancelAnimation(ready)
      cancelAnimation(scale)
    }
  }, [ready, scale, canSubmit, reduceMotion])

  const animatedContainer = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: interpolateColor(ready.value, [0, 1], [colors.bgCard2, colors.magenta]),
  }))

  const onPressIn = () => {
    if (!canSubmit || reduceMotion) return
    scale.value = withTiming(0.97, { duration: duration.quick, easing: easing.out })
  }
  const onPressOut = () => {
    if (reduceMotion) return
    scale.value = withTiming(1, { duration: duration.standard, easing: easing.out })
  }

  const showArrow = canSubmit && !isSubmitting

  return (
    <Animated.View style={[styles.submitWrap, canSubmit && shadows.ctaMagenta, animatedContainer]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={!canSubmit}
        style={styles.submitPressable}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit, busy: isSubmitting }}
      >
        {isSubmitting ? (
          <StarLoader size={16} color={colors.leche} />
        ) : showArrow ? (
          <Feather name="arrow-right" size={16} color={colors.leche} />
        ) : null}
        <Text style={[styles.submitLabel, !canSubmit && styles.submitLabelDisabled]}>
          {isSubmitting ? submittingLabel : label}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  submitWrap: {
    borderRadius: radius.pill,
  },
  submitPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  submitLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.leche,
  },
  submitLabelDisabled: {
    color: colors.niebla,
  },
})
