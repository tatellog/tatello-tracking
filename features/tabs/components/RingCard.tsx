import { StyleSheet, Text, View } from 'react-native'

import { EyebrowLabel } from '@/components/EyebrowLabel'
import { colors, typography } from '@/theme'

import { MacroRing } from './MacroRing'

type Props = {
  label: string
  value: number
  /** Italic serif suffix, e.g. "/ 130 g", "kcal restantes". */
  unitSuffix: string
  /** Big number text, already formatted ("98", "1.5"). */
  formatted: string
  target: number
  ringColor?: string
  /** Smaller ring + number so the secondary card doesn't compete with the primary. */
  small?: boolean
  ringDelay?: number
  /** Budget mode (e.g. calories): `value` is the *remaining* amount,
   *  not the consumed amount. Ring starts full and depletes; the big
   *  number counts down. Disables the "empty translucent" treatment
   *  because value=0 here means "fully consumed", not "not started". */
  budget?: boolean
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
  budget = false,
}: Props) {
  const ringSize = small ? 76 : 88
  // Empty state: when nothing's been logged in an *accumulating* card,
  // the big "0" reads as failure rather than invitation. Match the
  // constellation's day-0 pattern — dim the number to translucent and
  // swap the unit suffix for a poetic prompt. Budget cards skip this
  // entirely: in budget mode, value=0 means "fully consumed" (real
  // info), and the full-budget state shows the target instead of 0.
  const isEmpty = !budget && value <= 0
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
          <Text
            style={[styles.value, small && styles.valueSmall, isEmpty && styles.valueEmpty]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >
            {formatted}
          </Text>
          <Text style={[styles.subtitle, isEmpty && styles.subtitleEmpty]}>
            {isEmpty ? 'todavía sin sumar' : unitSuffix}
          </Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    minWidth: 0,
    gap: 10,
    // Subtle card container anchors the macro as its own unit of info
    // (was previously floating against the page bg, competing with the
    // constellation hero above). Very low-alpha leche tint + hairline
    // bruma border give structure without adding visual weight.
    backgroundColor: 'rgba(244,236,222,0.035)',
    borderColor: colors.bruma,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 14,
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
  valueEmpty: {
    opacity: 0.42,
  },
  subtitle: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.bone,
  },
  subtitleEmpty: {
    opacity: 0.72,
  },
})
