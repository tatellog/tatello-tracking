import * as Haptics from 'expo-haptics'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { colors, shadows, typography } from '@/theme'

type Props = {
  label: string
  selected: boolean
  onPress: () => void
  /**
   * Visually distinct opt-out variant ("Prefiero no decir") — uppercase
   * niebla instead of body bone so it doesn't read as "another option".
   */
  neutral?: boolean
}

export function OptionRow({ label, selected, onPress, neutral = false }: Props) {
  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {})
    onPress()
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={[styles.row, selected && styles.rowSelected]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
    >
      <Text
        style={[neutral ? styles.labelNeutral : styles.label, selected && styles.labelSelected]}
      >
        {label}
      </Text>
      <View style={[styles.tick, selected && styles.tickSelected]}>
        {selected ? (
          <Svg width={10} height={8} viewBox="0 0 10 8" fill="none">
            <Path
              d="M1 4L4 7L9 1"
              stroke="#FFFFFF"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard,
    borderRadius: 4,
    marginBottom: 7,
  },
  rowSelected: {
    backgroundColor: colors.magentaTint,
    borderColor: colors.magenta,
    ...shadows.ctaMagenta,
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  label: {
    flex: 1,
    fontFamily: typography.uiSemi,
    fontSize: 13.5,
    color: colors.bone,
  },
  labelNeutral: {
    flex: 1,
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelSelected: {
    color: colors.leche,
  },
  tick: {
    width: 18,
    height: 18,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.bruma,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickSelected: {
    backgroundColor: colors.magenta,
    borderColor: colors.magenta,
  },
})
