import * as Haptics from 'expo-haptics'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors, shadows, typography } from '@/theme'

import { StarLoader } from './StarLoader'

export type CtaVariant = 'primary' | 'ghost' | 'soft' | 'destructive'

type Props = {
  label: string
  onPress: () => void
  variant?: CtaVariant
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  marginTop?: number
  marginBottom?: number
  accessibilityLabel?: string
}

export function PrimaryCta({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  loadingLabel = 'Guardando…',
  marginTop = 0,
  marginBottom = 0,
  accessibilityLabel,
}: Props) {
  const inactive = disabled || loading
  const isGhost = variant === 'ghost'
  const isSoft = variant === 'soft'
  const isDestructive = variant === 'destructive'

  const handlePress = () => {
    if (inactive) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    onPress()
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={inactive}
      activeOpacity={0.85}
      style={[
        styles.btn,
        isGhost && styles.btnGhost,
        isSoft && styles.btnSoft,
        isDestructive && styles.btnDestructive,
        inactive && !isGhost && !isSoft && styles.btnDisabled,
        { marginTop, marginBottom },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <StarLoader
            size={18}
            color={isGhost ? colors.leche : isSoft ? colors.magenta : '#FFFFFF'}
          />
          <Text style={[styles.label, isGhost && styles.labelGhost, isSoft && styles.labelSoft]}>
            {loadingLabel}
          </Text>
        </View>
      ) : (
        <Text
          style={[
            styles.label,
            isGhost && styles.labelGhost,
            isSoft && styles.labelSoft,
            inactive && !isGhost && !isSoft && styles.labelDisabled,
          ]}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: 4,
    backgroundColor: colors.magenta,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.ctaMagenta,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.bruma,
    shadowOpacity: 0,
    elevation: 0,
  },
  // Soft — keeps the magenta identity but calms it: tinted fill +
  // magenta border + a gentle (not saturated) glow. Reads as an
  // invitation, not a demand; matches the active-state language of
  // the TodayWorkoutButton pill.
  btnSoft: {
    backgroundColor: 'rgba(233,30,99,0.12)',
    borderWidth: 1.5,
    borderColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  // Destructive — same filled-CTA geometry, swapped to the warning
  // red with a matching red glow. For delete / sign-out confirms.
  btnDestructive: {
    backgroundColor: colors.feedbackError,
    shadowColor: colors.feedbackError,
  },
  btnDisabled: {
    backgroundColor: colors.bgCard2,
    shadowOpacity: 0,
    elevation: 0,
  },
  label: {
    fontFamily: typography.uiBold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 2.16,
    textTransform: 'uppercase',
  },
  labelGhost: {
    color: colors.leche,
    textTransform: 'none',
    letterSpacing: 0,
    fontFamily: typography.uiMedium,
    fontSize: 13.5,
  },
  labelSoft: {
    color: colors.magenta,
  },
  labelDisabled: {
    color: colors.niebla,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
})
