import { Stack } from 'expo-router'
import { useEffect } from 'react'
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { WizardPresenceContext } from '@/features/onboarding/components'
import { colors } from '@/theme'

/*
 * Onboarding stack.
 *
 * OCCLUSION MODEL: each screen paints its OWN opaque surface (its root
 * uses colors.bg and mounts its own <WizardBackdrop />), and the Stack's
 * contentStyle is OPAQUE colors.bg. During a slide_from_right the
 * incoming screen fully covers the outgoing one — so there is never
 * double content (two "Continuar"). The deterministic starfield repaints
 * identical pixels on every mount, so the per-screen backdrop remount is
 * imperceptible.
 *
 * CONTINUOUS PRESENCE: the only thing that visibly "popped" between
 * screens was Stelar's breathing presence mark — each WizardBackdrop
 * used to own a useSharedValue(0) that reset to 0 on every mount,
 * restarting the breath mid-cycle. So this layout (which persists for
 * the whole onboarding flow) owns ONE presence shared value, runs its
 * 6-s breath loop ONCE here, and provides it via WizardPresenceContext.
 * Every WizardBackdrop consumes that single value, so the breath is
 * continuous across navigations even though each backdrop re-mounts.
 *
 * Swipe-back stays locked off: each "Continuar" persists, and a mid-
 * entry swipe would leave the profile half-saved.
 */
export default function OnboardingLayout() {
  // The Stelar mark breathes over a long 6-s cycle. Created ONCE here so
  // it lives for the whole flow and never restarts between screens.
  const presence = useSharedValue(0)

  useEffect(() => {
    presence.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(presence)
  }, [presence])

  return (
    <WizardPresenceContext.Provider value={presence}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 240,
          gestureEnabled: false,
          // OPAQUE — the incoming screen must occlude the outgoing one
          // during the slide so no double content shows through.
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </WizardPresenceContext.Provider>
  )
}
