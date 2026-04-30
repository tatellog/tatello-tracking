import { useState } from 'react'
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  value: string
  onChangeText: (v: string) => void
  unit: string
  placeholder?: string
  decimal?: boolean
  autoFocus?: boolean
}

/*
 * Display-sized numeric entry used by height/weight steps. The number
 * is rendered as a 56 px Inter Tight Light glyph aligned on the
 * baseline with the unit label, so when the user types "165 cm" the
 * digits and "cm" share a baseline rather than floating in two
 * different columns. Border-bottom shifts to mauveDeep on focus to
 * confirm the input is live.
 */
export function NumberInput({
  value,
  onChangeText,
  unit,
  placeholder,
  decimal = false,
  autoFocus = false,
}: Props) {
  const [focused, setFocused] = useState(false)

  // Block any character that's not a digit (and a decimal separator
  // when allowed). The OS keyboard is configured for digits only, but
  // hardware keyboards / paste can still feed letters through.
  const handleChange = (text: string) => {
    if (decimal) {
      const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '.')
      const parts = cleaned.split('.')
      const next = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('').slice(0, 1)}` : cleaned
      onChangeText(next)
    } else {
      onChangeText(text.replace(/[^0-9]/g, ''))
    }
  }

  return (
    <View style={[styles.row, focused && styles.rowFocused]}>
      <TextInput
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.labelDim}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        autoFocus={autoFocus}
        maxLength={decimal ? 6 : 4}
        style={[styles.input, Platform.OS === 'web' && styles.inputWeb]}
      />
      <Text style={styles.unit}>{unit}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    width: '100%',
    paddingBottom: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowFocused: {
    borderBottomColor: colors.mauveDeep,
  },
  input: {
    // flex: 1 lets the input share the row with the unit instead of
    // claiming an intrinsic auto-width — RNW's <input> defaults size
    // to fit the placeholder otherwise, which on a phone-width
    // viewport pushes "cm" off the right edge.
    flex: 1,
    minWidth: 0,
    fontFamily: typography.display,
    fontSize: 56,
    letterSpacing: -1,
    color: colors.inkPrimary,
    backgroundColor: 'transparent',
    padding: 0,
  },
  // RNW renders TextInput as a real <input>; the browser's default
  // focus outline clashes with the mauve border-bottom we draw on
  // the parent row. Strip it on web only.
  inputWeb: {
    // @ts-expect-error — outline* is a web-only style accepted by RNW.
    outlineStyle: 'none',
  },
  unit: {
    flexShrink: 0,
    fontFamily: typography.uiMedium,
    fontSize: 14,
    color: colors.labelMuted,
    letterSpacing: 0.3,
  },
})
