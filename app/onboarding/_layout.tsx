import { Stack } from 'expo-router'

import { colors } from '@/theme'

// Swipe-back disabled: each "Continuar" persists, and a mid-entry
// swipe would leave the profile half-saved.
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
