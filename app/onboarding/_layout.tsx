import { Stack } from 'expo-router'

import { colors } from '@/theme'

/*
 * Norte onboarding stack. Dark sweat surface, slide-from-right
 * transitions, swipe-back disabled (each "Continuar" persists; an
 * accidental swipe-back mid-entry would leave the profile half-saved).
 * Pantallas inscribiéndose: manifiesto → frictions → about-you →
 * weight → appointment → day-one.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  )
}
