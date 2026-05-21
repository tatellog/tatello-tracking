import { Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { colors } from '@/theme'

/*
 * Onboarding stack. Each screen carries its OWN WizardBackdrop now —
 * the previous "one backdrop in the layout root + transparent
 * contentStyle on the Stack" setup let the previous screen show
 * through during the slide transition (the new screen was sliding
 * over a transparent surface, so both contents were visible at once).
 *
 * Moving the backdrop per-screen + giving the Stack an opaque
 * contentStyle means each incoming screen cleanly covers its
 * neighbour during the 240 ms slide, with no visual transposition.
 *
 * Swipe-back is locked off: each "Continuar" persists, and a mid-
 * entry swipe would leave the profile half-saved.
 */
export default function OnboardingLayout() {
  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 240,
          gestureEnabled: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
})
