import { Stack } from 'expo-router'

import { colors } from '@/theme'

/*
 * Photo capture wizard — 4 angles plus the done screen. Same gesture
 * lockdown as the parent onboarding stack so a stray swipe doesn't
 * abandon a half-uploaded set.
 */
export default function PhotosLayout() {
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
