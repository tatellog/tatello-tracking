import { Feather } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { colors, duration, easing, radius, spacing, typography } from '@/theme'

export type FieldIcon = 'mail' | 'lock'

type FieldProps = {
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  icon: FieldIcon
  accessibilityLabel: string
  disabled?: boolean
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoComplete?: 'email' | 'password' | 'password-new' | 'off'
  textContentType?: 'emailAddress' | 'password' | 'newPassword'
  returnKeyType?: 'next' | 'go' | 'done' | 'send'
  onSubmitEditing?: () => void
  onBlur?: () => void
  trailing?: React.ReactNode
}

/*
 * The auth text field. Focus interpolates the border + icon + glow to
 * oro (the sky's light) — deliberately NOT magenta, so the screen's
 * only magenta stays the CTA (caret is the second, permitted accent).
 */
export function Field({
  value,
  onChangeText,
  placeholder,
  icon,
  accessibilityLabel,
  disabled,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
  onBlur,
  trailing,
}: FieldProps) {
  const [focused, setFocused] = useState(false)
  const focusProgress = useSharedValue(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) {
      focusProgress.value = focused ? 1 : 0
      return
    }
    focusProgress.value = withTiming(focused ? 1 : 0, {
      duration: duration.standard,
      easing: easing.standard,
    })
    return () => cancelAnimation(focusProgress)
  }, [focusProgress, focused, reduceMotion])

  const animatedContainer = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      [colors.hairlineStrong, colors.oro],
    ),
    shadowOpacity: focusProgress.value * 0.5,
  }))

  return (
    <Animated.View style={[styles.inputContainer, animatedContainer]}>
      <Feather name={icon} size={18} color={focused ? colors.oro : colors.niebla} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          onBlur?.()
        }}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.niebla}
        selectionColor={colors.magenta}
        cursorColor={colors.magenta}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        textContentType={textContentType}
        editable={!disabled}
        returnKeyType={returnKeyType}
        style={styles.input}
      />
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.tile,
    borderWidth: 1,
    backgroundColor: colors.bgCard,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    // Oro glow on focus (shadowOpacity driven by the animated style).
    shadowColor: colors.oro,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    shadowOpacity: 0,
  },
  input: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingVertical: 14,
    paddingRight: spacing.sm,
    fontSize: typography.sizes.body,
    fontFamily: typography.ui,
    color: colors.leche,
  },
  trailing: {
    paddingHorizontal: spacing.sm,
  },
})
