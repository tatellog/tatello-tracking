import { StyleSheet, Text } from 'react-native'
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated'

import { colors, typography } from '@/theme'

/*
 * Full-screen overlay shown for ≈2 s the moment the user marks their
 * first workout. The check pops in with a spring zoom; the "Día 1"
 * subtitle fades in just behind it. Background is near-opaque pearl
 * so the underlying Home is fully obscured during the transition
 * from first-day → normal layout.
 */
export function Day1Celebration() {
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(400)}
      style={styles.overlay}
    >
      <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.content}>
        <Text style={styles.check}>✓</Text>
        <Text style={styles.label}>Día 1</Text>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250, 250, 251, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 12,
  },
  check: {
    fontFamily: typography.display,
    fontSize: 80,
    lineHeight: 88,
    color: colors.mauveDeep,
  },
  label: {
    fontFamily: typography.display,
    fontSize: 32,
    letterSpacing: -1,
    color: colors.inkPrimary,
  },
})
