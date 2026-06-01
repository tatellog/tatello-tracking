import { Stack } from 'expo-router'

import { colors } from '@/theme'

/*
 * Auth Stack. headerShown:false (each screen paints its own celestial
 * chrome via AuthScreenLayout), back gesture enabled, transparent
 * screen backgrounds so the warm-black bg reads as one continuous sky
 * across the slide transition.
 *
 * RouteGuard (app/_layout.tsx) keys off segments[0] === 'auth', so
 * `index` resolving to `/auth` keeps the existing router.replace('/auth')
 * working untouched.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="reset" />
    </Stack>
  )
}
