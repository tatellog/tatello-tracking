import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { colors, duration, easing, radius, shadows, spacing, typography } from '@/theme'

/*
 * Primary CTA to capture a meal. A copper gradient pill with the
 * aspirational 📸 glyph — Sprint 3 wires the camera behind it; for
 * now it just opens the manual form.
 *
 * Tap scales to 0.97 on pressIn and springs back on pressOut, on
 * the UI thread. The gradient + shadow give the button visual
 * weight against the cream background so the eye reads it as the
 * intended next action.
 */
export function LogMealButton() {
  const router = useRouter()
  const scale = useSharedValue(1)

  const onPressIn = () => {
    scale.value = withTiming(0.97, { duration: duration.quick, easing: easing.out })
  }
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: duration.standard, easing: easing.out })
  }

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={[animatedStyle, shadows.copperToday]}>
      <Pressable
        onPress={() => router.push('/log-meal')}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel="Loggear comida"
      >
        <LinearGradient
          colors={[colors.copperBright, colors.copperVivid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pill}
        >
          <View style={styles.row}>
            <Text style={styles.icon}>📸</Text>
            <Text style={styles.label}>Loggear comida</Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontFamily: typography.prose,
    fontSize: 16,
    fontStyle: 'italic',
    color: colors.creamWarm,
  },
})
