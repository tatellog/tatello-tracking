import { StyleSheet, Text, View } from 'react-native'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { MacroRing } from './MacroRing'

type Props = {
  label: string
  value: number
  /** Italic serif suffix, e.g. "de 130 g", "de 1.8 k". */
  unitSuffix: string
  /** Big number text, already formatted ("98", "1.5"). */
  formatted: string
  target: number
  ringColor?: string
  /** Smaller ring + number so the secondary card doesn't compete with the primary. */
  small?: boolean
  ringDelay?: number
}

export function RingCard({
  label,
  value,
  unitSuffix,
  formatted,
  target,
  ringColor = colors.magenta,
  small = false,
  ringDelay = 200,
}: Props) {
  const ringSize = small ? 76 : 88
  return (
    <View style={styles.column}>
      <EyebrowLabel tone="magenta" size={11} tracking={3}>
        {label}
      </EyebrowLabel>
      <View style={styles.row}>
        <MacroRing
          value={value}
          target={target}
          size={ringSize}
          color={ringColor}
          delay={ringDelay}
        />
        <View style={styles.numberStack}>
          <Text style={[styles.value, small && styles.valueSmall]}>{formatted}</Text>
          <Text style={styles.subtitle}>{unitSuffix}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    minWidth: 0,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minWidth: 0,
  },
  numberStack: {
    flexShrink: 1,
    minWidth: 0,
  },
  value: {
    fontFamily: typography.displayHeavy,
    fontSize: 38,
    color: colors.leche,
    letterSpacing: -1.6,
    lineHeight: 38,
  },
  valueSmall: {
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -1.3,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.bone,
  },
})
