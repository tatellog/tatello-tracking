import { StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/theme'

type Props = {
  text: string
}

/*
 * The 'anchor of the day' — a single imperative serif line that
 * tells the user the next concrete action. Label 'ANCLA DE HOY'
 * sits above, tracking-wide, followed by the action in a display
 * serif at 22px centered.
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
    fontSize: typography.sizes.smallLabel,
    letterSpacing: typography.letterSpacing.label,
    color: colors.goldBurnt,
    marginBottom: spacing.sm,
  },
  text: {
    fontFamily: typography.display,
    fontSize: typography.sizes.anchor,
    color: colors.forestDeep,
    letterSpacing: typography.letterSpacing.display,
    textAlign: 'center',
  },
})
