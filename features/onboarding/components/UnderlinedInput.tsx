import { useState } from 'react'
import { Platform, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  keyboardType?: TextInputProps['keyboardType']
  maxLength?: number
  autoCapitalize?: TextInputProps['autoCapitalize']
  autoCorrect?: boolean
  returnKeyType?: TextInputProps['returnKeyType']
  onSubmitEditing?: () => void
  /** Narrows the value font for grid cells (edad / altura). */
  compact?: boolean
}

export function UnderlinedInput({
  label,
  value,
  onChangeText,
  placeholder,
  autoFocus,
  keyboardType,
  maxLength,
  autoCapitalize = 'sentences',
  autoCorrect,
  returnKeyType,
  onSubmitEditing,
  compact = false,
}: Props) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.bruma}
        autoFocus={autoFocus}
        autoCorrect={autoCorrect}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        maxLength={maxLength}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={colors.magenta}
        style={[
          styles.input,
          compact && styles.inputCompact,
          focused && styles.inputFocused,
          Platform.OS === 'web' && styles.inputWeb,
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
  },
  label: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.niebla,
    letterSpacing: 2.2,
  },
  input: {
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.bruma,
    fontFamily: typography.uiBold,
    fontSize: 24,
    letterSpacing: -0.5,
    color: colors.leche,
    backgroundColor: 'transparent',
  },
  inputCompact: {
    fontSize: 22,
  },
  inputFocused: {
    borderBottomColor: colors.magenta,
  },
  inputWeb: {
    // @ts-expect-error — outline* is web-only; RNW accepts it.
    outlineStyle: 'none',
  },
})
