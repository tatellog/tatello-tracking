import * as Haptics from 'expo-haptics'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors, typography } from '@/theme'

export type Choice<V extends string> = {
  value: V
  label: string
}

type Props<V extends string> = {
  options: readonly Choice<V>[]
  value: V | null
  onChange: (next: V) => void
}

/*
 * A wrap-grid of single-select chips. Used for monthly_focus in
 * tu-intencion (7 options): chips fold into 2-3 rows on phone widths,
 * the picked one fills magenta. Different from SelectableCard
 * (which is for richer rows with descriptions); chips are for short
 * labels where the visual focus is the choice itself.
 */
export function ChoiceChips<V extends string>({ options, value, onChange }: Props<V>) {
  return (
    <View style={styles.wrap}>
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={0.85}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              onChange(opt.value)
            }}
            style={[styles.chip, selected ? styles.chipSelected : styles.chipIdle]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{opt.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
  },
  chipIdle: {
    backgroundColor: colors.bgCard,
    borderColor: colors.bruma,
  },
  chipSelected: {
    backgroundColor: colors.magentaTint,
    borderColor: colors.magenta,
  },
  label: {
    fontFamily: typography.uiBold,
    fontSize: 13,
    color: colors.bone,
  },
  labelSelected: {
    color: colors.leche,
  },
})
