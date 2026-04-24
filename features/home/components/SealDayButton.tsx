import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Alert, Pressable, StyleSheet, Text } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { colors, duration, easing, radius, shadows, spacing, typography } from '@/theme'

type Props = {
  sealed: boolean
  streakCount: number
  onSeal: () => void
  onUnseal?: () => void
}

/*
 * Primary action of the Home — replaces the old swipe-to-seal.
 *
 * Idle state: copper gradient pill with label 'Sellar el día ·
 * entrené'. Tap fires a medium haptic, dispatches onSeal, and the
 * parent pops a toast with 'Deshacer'. Optimistic updates in
 * useToggleWorkoutToday mean the streak/ring/card animate instantly
 * — the tap already feels like a commit before the network comes
 * back.
 *
 * Sealed state: muted forest-mid pill with '✓ Día sellado · N días'.
 * Tap is inert (the action is already done); long-press raises an
 * Alert offering to undo — the escape hatch for users who want to
 * revoke past the 5 s toast window.
 *
 * Why a tap instead of the old swipe:
 *   - Daily action: swipes accrue friction across 365 registrations
 *     per year; a tap does not.
 *   - Accessibility: standard button roles win over pan gestures
 *     for motor-impaired users.
 *   - Grammar consistency: every other primary action on the Home
 *     (mood, log meal, quick actions) is already a tap.
 *   - The ceremony moved to the celebration — the streak count-up
 *     animation + grid pulse do the heavy lifting of 'you did it'.
 */
export function SealDayButton({ sealed, streakCount, onSeal, onUnseal }: Props) {
  const scale = useSharedValue(1)

  const onPressIn = () => {
    scale.value = withTiming(0.97, { duration: duration.quick, easing: easing.out })
  }
  const onPressOut = () => {
    scale.value = withTiming(1, { duration: duration.standard, easing: easing.out })
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handleSealTap = () => {
    if (sealed) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    onSeal()
  }

  const handleLongPress = () => {
    if (!sealed || !onUnseal) return
    Alert.alert('Deshacer entreno', 'Vas a quitar el registro de hoy.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Deshacer',
        style: 'destructive',
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
          onUnseal()
        },
      },
    ])
  }

  const idleLabel = 'Sellar el día · entrené'
  const sealedLabel = `✓ Día sellado · ${streakCount} días`

  if (sealed) {
    return (
      <Animated.View style={[animatedStyle, shadows.card]}>
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={500}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={styles.sealedPill}
          accessibilityRole="button"
          accessibilityLabel={sealedLabel}
          accessibilityHint="Mantené presionado para deshacer el entreno"
          accessibilityState={{ selected: true }}
        >
          <Text style={styles.labelSealed}>{sealedLabel}</Text>
        </Pressable>
      </Animated.View>
    )
  }

  return (
    <Animated.View style={[animatedStyle, shadows.copperToday]}>
      <Pressable
        onPress={handleSealTap}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={idleLabel}
      >
        <LinearGradient
          colors={[colors.copperBright, colors.copperVivid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.idlePill}
        >
          <Text style={styles.labelIdle}>{idleLabel}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  idlePill: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealedPill: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.forestMid,
  },
  labelIdle: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.body,
    fontStyle: 'italic',
    color: colors.creamWarm,
  },
  labelSealed: {
    fontFamily: typography.prose,
    fontSize: typography.sizes.body,
    fontStyle: 'italic',
    color: colors.creamSoft,
  },
})
