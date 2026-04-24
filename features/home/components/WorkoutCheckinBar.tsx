import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { deriveCheckinCopy, type WorkoutCheckinState } from '@/features/home/logic'
import { colors, duration, easing, radius, shadows, spacing, typography } from '@/theme'

type Props = {
  state: WorkoutCheckinState
  dayOfWeek: string
  completedAt?: Date
  onTap: () => Promise<void> | void
  onUnseal?: () => void
}

/*
 * Three-state check-in bar — replaces SwipeToSeal and the previous
 * SealDayButton. Reads its state from parent (derived via
 * deriveCheckinState) so the bar is fully controlled and the
 * animations follow prop changes, not internal flags.
 *
 *   early      → dark bar, soft prompt, mauve button.
 *   urgent     → same dark bar plus a pulsing vertical indicator,
 *                haptic-on-mount (once per session), and a glow
 *                halo behind the button.
 *   completed  → light elevated bar with a success icon,
 *                timestamp, long-press undo.
 *
 * The early/urgent transition happens inside DarkBar (the component
 * is already mounted). The urgent/completed transition swaps bars
 * via reanimated entering/exiting so the user sees a crossfade.
 */
export function WorkoutCheckinBar({ state, dayOfWeek, completedAt, onTap, onUnseal }: Props) {
  if (state === 'completed') {
    return (
      <Animated.View
        key="completed"
        entering={FadeIn.delay(150).duration(duration.slow * 0.75)}
        exiting={FadeOut.duration(duration.standard)}
      >
        <CompletedBar completedAt={completedAt} onUnseal={onUnseal} />
      </Animated.View>
    )
  }

  return (
    <Animated.View
      key="dark"
      entering={FadeIn.duration(duration.standard)}
      exiting={FadeOut.duration(duration.standard)}
    >
      <DarkBar state={state} dayOfWeek={dayOfWeek} onTap={onTap} />
    </Animated.View>
  )
}

/* ─── dark bar (early + urgent) ──────────────────────────────────── */

// Session-scoped flag so urgent-mount haptic fires only once per JS
// session. Resets on cold start and fast refresh, which matches the
// spec's 'una vez por sesión' intent.
let hasFiredUrgentHaptic = false

type DarkProps = {
  state: Exclude<WorkoutCheckinState, 'completed'>
  dayOfWeek: string
  onTap: () => Promise<void> | void
}

function DarkBar({ state, dayOfWeek, onTap }: DarkProps) {
  const isUrgent = state === 'urgent'
  const copy = deriveCheckinCopy(state, dayOfWeek)

  useEffect(() => {
    if (!isUrgent) return
    if (hasFiredUrgentHaptic) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    hasFiredUrgentHaptic = true
  }, [isUrgent])

  return (
    <View
      style={styles.dark}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${copy.label}. ${copy.prompt}`}
    >
      {isUrgent && <UrgentIndicator />}

      <View style={styles.darkContent}>
        <Text style={styles.label}>{copy.label.toUpperCase()}</Text>
        <Animated.Text
          key={copy.prompt}
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.prompt}
        >
          {copy.prompt}
        </Animated.Text>
      </View>

      <EntreneButton urgent={isUrgent} onTap={onTap} />
    </View>
  )
}

function UrgentIndicator() {
  const opacity = useSharedValue(0.4)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 1000, easing: easing.standard }),
        withTiming(0.4, { duration: 1000, easing: easing.standard }),
      ),
      -1,
      false,
    )
    return () => cancelAnimation(opacity)
  }, [opacity])

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.indicator, animated]}
      pointerEvents="none"
    />
  )
}

type EntreneButtonProps = {
  urgent: boolean
  onTap: () => Promise<void> | void
}

function EntreneButton({ urgent, onTap }: EntreneButtonProps) {
  const pressScale = useSharedValue(1)
  const glow = useSharedValue(urgent ? 1 : 0)

  useEffect(() => {
    if (urgent) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: easing.standard }),
          withTiming(0.4, { duration: 1200, easing: easing.standard }),
        ),
        -1,
        false,
      )
    } else {
      cancelAnimation(glow)
      glow.value = withTiming(0, { duration: duration.standard, easing: easing.out })
    }
    return () => cancelAnimation(glow)
  }, [urgent, glow])

  const onPressIn = () => {
    pressScale.value = withTiming(0.96, { duration: duration.quick, easing: easing.out })
  }
  const onPressOut = () => {
    pressScale.value = withTiming(1, { duration: duration.standard, easing: easing.out })
  }

  const haloStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.55,
    transform: [{ scale: 1 + glow.value * 0.12 }],
  }))

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    try {
      await onTap()
    } catch {
      // Parent is expected to surface its own error state. We swallow
      // here so the press handler doesn't throw into the gesture
      // responder.
    }
  }

  return (
    <View style={styles.buttonWrap}>
      <Animated.View style={[styles.glow, haloStyle]} pointerEvents="none" />
      <Animated.View style={[buttonStyle, shadows.copperToday]}>
        <Pressable
          onPress={handlePress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          accessibilityRole="button"
          accessibilityLabel="Entrené"
        >
          <LinearGradient
            colors={[colors.mauveLight, colors.mauveDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <Text style={styles.buttonLabel}>✓ Entrené</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  )
}

/* ─── completed bar ──────────────────────────────────────────────── */

type CompletedProps = {
  completedAt?: Date
  onUnseal?: () => void
}

function CompletedBar({ completedAt, onUnseal }: CompletedProps) {
  const timeLabel = completedAt
    ? completedAt.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  const handleLongPress = () => {
    if (!onUnseal) return
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

  return (
    <Pressable
      onLongPress={handleLongPress}
      delayLongPress={500}
      accessibilityRole="button"
      accessibilityLabel={`Día sellado a las ${timeLabel}`}
      accessibilityHint={onUnseal ? 'Mantené presionado para deshacer' : undefined}
      style={styles.completed}
    >
      <View style={styles.checkCircle}>
        <Text style={styles.checkGlyph}>✓</Text>
      </View>
      <Text style={styles.completedText}>Día sellado</Text>
      <Text style={styles.timestamp}>{timeLabel}</Text>
    </Pressable>
  )
}

/* ─── styles ─────────────────────────────────────────────────────── */

const BAR_HEIGHT = 72
const INDICATOR_WIDTH = 3

const styles = StyleSheet.create({
  dark: {
    height: BAR_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.inkDark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  darkContent: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.labelDim,
  },
  prompt: {
    fontSize: typography.sizes.body,
    fontWeight: '600',
    color: colors.pearlBase,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: INDICATOR_WIDTH,
    borderTopRightRadius: INDICATOR_WIDTH,
    borderBottomRightRadius: INDICATOR_WIDTH,
    backgroundColor: colors.mauveDeep,
  },

  buttonWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 140,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.mauveLight,
  },
  button: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    fontWeight: '700',
    color: colors.pearlBase,
  },

  completed: {
    height: BAR_HEIGHT,
    borderRadius: radius.card,
    backgroundColor: colors.pearlElevated,
    borderWidth: 0.5,
    borderColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.feedbackSuccessSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    color: colors.feedbackSuccess,
    fontSize: 16,
    fontWeight: '700',
  },
  completedText: {
    flex: 1,
    fontFamily: typography.ui,
    fontSize: typography.sizes.body,
    fontWeight: '600',
    color: colors.inkPrimary,
  },
  timestamp: {
    fontSize: typography.sizes.tinyLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.labelDim,
    textTransform: 'uppercase',
  },
})
