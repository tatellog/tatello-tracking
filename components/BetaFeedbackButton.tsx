import { useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { useProfile } from '@/features/profile/hooks'
import { colors, radius, spacing, typography } from '@/theme'

import { BetaFeedbackSheet } from './BetaFeedbackSheet'

/*
 * Floating "feedback" chip — visible ONLY to beta users (gated on
 * profile.is_beta). Lives at the bottom-left of the screen, above
 * the tab bar, so it doesn't clash with the quick-log ✦ at
 * bottom-centre. Tapping opens the BetaFeedbackSheet.
 *
 * Deliberately small + low-saturation: feedback should be one tap
 * away when the beta user feels the urge, but never compete with
 * the actual tab content. Cormorant italic lowercase "feedback"
 * reads as a coach-voice invitation rather than a CTA.
 */
export function BetaFeedbackButton() {
  const { data: profile } = useProfile()
  const [visible, setVisible] = useState(false)
  if (!profile?.is_beta) return null

  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Enviar feedback"
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      >
        <Text style={styles.label}>feedback</Text>
      </Pressable>
      <BetaFeedbackSheet visible={visible} onClose={() => setVisible(false)} />
    </>
  )
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    bottom: 96,
    left: spacing.s4,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'rgba(20, 8, 11, 0.86)',
  },
  chipPressed: { opacity: 0.6 },
  label: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.label,
    color: colors.bone,
    letterSpacing: 0.2,
  },
})
