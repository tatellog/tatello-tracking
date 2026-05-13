import * as Haptics from 'expo-haptics'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors, typography } from '@/theme'

type Option<T extends string> = {
  value: T
  label: string
}

type Props<T extends string> = {
  value: T | null
  options: readonly Option<T>[]
  onChange: (next: T) => void
}

/*
 * Segmented toggle Norte (femenino/masculino). Container con border
 * bruma + fondo bg-card; los botones internos son transparentes hasta
 * seleccionarse, donde toman bg magenta-tint2 + inset border magenta
 * y texto cream.
 */
export function SegmentedToggle<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <View style={styles.container} accessibilityRole="radiogroup">
      {options.map((opt) => {
        const selected = opt.value === value
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              onChange(opt.value)
            }}
            activeOpacity={0.85}
            style={[styles.button, selected && styles.buttonOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
          >
            <Text style={[styles.label, selected && styles.labelOn]}>{opt.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    borderColor: colors.bruma,
    borderRadius: 4,
    padding: 3,
    gap: 3,
  },
  button: {
    flex: 1,
    height: 40,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonOn: {
    backgroundColor: colors.magentaTint2,
    borderWidth: 1,
    borderColor: colors.magenta,
  },
  label: {
    fontFamily: typography.uiBold,
    fontSize: 12,
    color: colors.niebla,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  labelOn: {
    color: colors.leche,
  },
})
