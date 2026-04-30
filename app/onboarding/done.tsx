import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { OrnamentShape } from '@/features/onboarding/components'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { colors, typography } from '@/theme'

/*
 * Celebration screen — bridges the wizard and Día 1. Two animations:
 *   1. checkScale: bezier overshoot to 1.15 then spring-rest at 1.0,
 *      so the check lands like it's settling into place.
 *   2. haloRing: an infinite scale-out + opacity-fade pulse that
 *      reads as a soft sonar ring around the check.
 *
 * On mount we also fire a Medium haptic to mark the moment the
 * profile is "done" — small, but the kind of detail the rest of the
 * onboarding leans on.
 *
 * Tap "Continuar" sets onboarding_completed_at and replaces the
 * route with /day-one (replace, not push, so back can't come here).
 */
export default function DoneScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const checkScale = useSharedValue(0)
  const haloScale = useSharedValue(1)
  const haloOpacity = useSharedValue(0.85)

  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})

    checkScale.value = withSequence(
      withTiming(1.15, { duration: 400, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
      withSpring(1, { stiffness: 100, damping: 12 }),
    )

    haloScale.value = withRepeat(
      withTiming(2.5, { duration: 2400, easing: Easing.out(Easing.cubic) }),
      -1,
      false,
    )
    haloOpacity.value = withRepeat(
      withTiming(0, { duration: 2400, easing: Easing.out(Easing.cubic) }),
      -1,
      false,
    )
  }, [checkScale, haloScale, haloOpacity])

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }))

  const haloAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: haloOpacity.value,
  }))

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    try {
      await updateProfile.mutateAsync({
        onboarding_completed_at: new Date().toISOString(),
      })
    } catch {
      // The user is on a celebration screen; if the patch fails we still
      // let them through — the day-one screen will retry on its own
      // mount via the next profile read. Better than blocking on a
      // transient network blip.
    }
    router.replace('/onboarding/day-one')
  }

  const name = profile?.display_name?.trim() || 'Listo'

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <OrnamentShape variant="tr" />

      <View style={styles.content}>
        <View style={styles.checkWrap}>
          <Animated.View style={[styles.haloRing, haloAnimStyle]} pointerEvents="none" />
          <Animated.View style={[styles.checkCircle, checkAnimStyle]}>
            <LinearGradient
              colors={[colors.mauveLight, colors.mauveDeep]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.checkIcon}>✓</Text>
          </Animated.View>
        </View>

        <Text style={styles.title}>
          Listo, <Text style={styles.titleEmphasis}>{name}</Text>.
        </Text>
        <Text style={styles.sub}>
          Tu perfil queda en su lugar.{'\n'}
          Lo que sigue lo construyes tú.
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleContinue}
          disabled={updateProfile.isPending}
          activeOpacity={0.85}
          style={[styles.cta, updateProfile.isPending && styles.ctaDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Continuar"
        >
          <Text style={styles.ctaLabel}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.pearlBase,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  checkWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloRing: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: colors.mauveDeep,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.mauveDeep,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  checkIcon: {
    fontFamily: typography.display,
    fontSize: 30,
    color: colors.pearlBase,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 36,
    letterSpacing: -1.4,
    color: colors.inkPrimary,
    textAlign: 'center',
  },
  titleEmphasis: {
    fontFamily: typography.displaySemi,
    fontWeight: typography.fontWeight.medium,
    color: colors.mauveDeep,
  },
  sub: {
    fontFamily: typography.ui,
    fontSize: 14,
    lineHeight: 22,
    color: colors.labelMuted,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  cta: {
    backgroundColor: colors.mauveDeep,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 15,
    color: colors.pearlBase,
    letterSpacing: 0.3,
  },
})
