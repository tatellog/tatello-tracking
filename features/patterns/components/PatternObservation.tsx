import { useEffect } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { track } from '@/lib/analytics'
import { colors, radius, spacing, typography } from '@/theme'

/*
 * Coach-voice observation card — surfaces a detected pattern on
 * Hoy as a soft side note. Cormorant italic (the coach voice),
 * subtle border, a small × to dismiss. Renders only when the
 * parent hook fires; dismiss removes it for the rest of the day.
 *
 * coach_message_shown is fired exactly once per mount with
 * { pattern_type } so the beta cohort report can measure reaction
 * to coach observations (one of the 3 MVP-validation questions).
 */
type Props = {
  message: string
  patternType: string
  onDismiss: () => void
}

export function PatternObservation({ message, patternType, onDismiss }: Props) {
  useEffect(() => {
    track('coach_message_shown', { pattern_type: patternType })
  }, [patternType])

  return (
    <Animated.View
      entering={FadeIn.duration(320)}
      exiting={FadeOut.duration(180)}
      style={styles.card}
    >
      <Text style={styles.message}>{message}</Text>
      <Pressable
        onPress={onDismiss}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Cerrar observación"
        style={({ pressed }) => [styles.dismiss, pressed && styles.dismissPressed]}
      >
        <Text style={styles.dismissText}>×</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.s5,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s4,
    paddingRight: spacing.s7,
    borderRadius: radius.cell,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: colors.bgCard,
    position: 'relative',
  },
  message: {
    fontFamily: typography.serif,
    fontSize: typography.sizes.bodyLarge,
    lineHeight: typography.sizes.bodyLarge * typography.lineHeight.body,
    color: colors.leche,
  },
  dismiss: {
    position: 'absolute',
    top: spacing.s2,
    right: spacing.s3,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissPressed: { opacity: 0.5 },
  dismissText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.headingLg,
    color: colors.niebla,
    lineHeight: typography.sizes.headingLg,
  },
})
