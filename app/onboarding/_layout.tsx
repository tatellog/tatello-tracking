import { Stack } from 'expo-router'

import { colors } from '@/theme'

/*
 * Stack scoped to the welcome → wizard → done → day-one flow. Gestures
 * are disabled because every step persists the user's input on tap of
 * "Continuar"; an accidental swipe-back mid-entry would leave the
 * profile in a half-saved state. The back button on each step is the
 * only sanctioned way back.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.pearlBase },
      }}
    />
  )
}
