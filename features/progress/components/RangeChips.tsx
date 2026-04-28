import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radius, spacing, typography } from '@/theme'

export type RangeKey = '7d' | '30d' | '90d' | 'all'

const ORDER: RangeKey[] = ['7d', '30d', '90d', 'all']
const LABELS: Record<RangeKey, string> = {
  '7d': '7 D',
  '30d': '30 D',
  '90d': '90 D',
  all: 'TODO',
}

type Props = {
  value: RangeKey
  onChange: (next: RangeKey) => void
}

/*
 * Pearl Mauve range pills — siempre 4, scrollable nunca. Activa toma
 * el accent (mauveDeep + pearl text); inactivas son `pearlElevated`
 * sobre `borderSubtle`. Touch target 36px alto.
 */
export function RangeChips({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {ORDER.map((key) => {
        const active = key === value
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={[styles.pill, active && styles.pillActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Rango ${LABELS[key]}`}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{LABELS[key]}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  pillActive: {
    backgroundColor: colors.mauveDeep,
    borderColor: colors.mauveDeep,
  },
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.labelMuted,
  },
  labelActive: {
    fontFamily: typography.uiSemi,
    fontWeight: typography.fontWeight.semi,
    color: colors.pearlElevated,
  },
})
