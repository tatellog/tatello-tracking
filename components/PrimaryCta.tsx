import * as Haptics from 'expo-haptics'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors, shadows, typography } from '@/theme'

export type CtaVariant = 'primary' | 'ghost'

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
        inactive && !isGhost && styles.btnDisabled,
        { marginTop, marginBottom },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={isGhost ? colors.leche : '#FFFFFF'} size="small" />
          <Text style={[styles.label, isGhost && styles.labelGhost]}>{loadingLabel}</Text>
        </View>
      ) : (
        <Text
          style={[
            styles.label,
            isGhost && styles.labelGhost,
            inactive && !isGhost && styles.labelDisabled,
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
  labelDisabled: {
    color: colors.niebla,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
})
