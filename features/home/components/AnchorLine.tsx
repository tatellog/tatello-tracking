import { StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/theme'

type Props = {
  text: string
}

/*
 * The 'anchor of the day' — a single imperative line that names
 * the next concrete action. Label `ANCLA DE HOY` sits above in the
 * uppercase chrome treatment; the action below is Inter Medium 17px
 * (no serif, no italic — Pearl Mauve).
 */
export function AnchorLine({ text }: Props) {
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Ancla de hoy: ${text}`}
    >
      <Text style={styles.label}>ANCLA DE HOY</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  label: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.semi,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.labelMuted,
    marginBottom: spacing.sm,
  },
  text: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.anchor,
    fontWeight: typography.fontWeight.medium,
    color: colors.inkPrimary,
    textAlign: 'center',
    lineHeight: typography.sizes.anchor * typography.lineHeight.statement,
  },
})
