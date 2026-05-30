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
 * A wrap-grid of single-select chips. Currently used by atribucion
 * (acquisition source, 6 options): chips fold into 2-3 rows on phone
 * widths, the picked one fills magenta. Different from SelectableCard
 * (which is for richer rows with descriptions); chips are for short
 * labels where the visual focus is the choice itself.
 *
 * Each chip carries `accessibilityRole="radio"`. The consumer is
 * expected to wrap the group (and any mutually-exclusive opt-out) in a
 * `radiogroup` container so VoiceOver announces the single-select set.
 *
 * Touch target: paddingVertical 13 + body line-height lands the chip at
 * ~44pt tall, meeting the a11y minimum without changing the wrap layout.
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
    paddingVertical: 13,
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
    fontSize: typography.sizes.body,
    color: colors.bone,
  },
  labelSelected: {
    color: colors.leche,
  },
})
