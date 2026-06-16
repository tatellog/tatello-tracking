import { type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'

import { colors, radius, typography } from '@/theme'

import { usePressFeedback } from './usePressFeedback'

/**
 * The button SHAPE signifier — a pill. A card is never a pill, so the shape
 * itself reads as "action" even where colour can't (magenta is overloaded in
 * Stelar). Default is a clean OUTLINED pill (transparent fill); pass
 * `accentFill` for a soft tinted emphasis. Signals: shape + label + press
 * feedback (≥2).
 *
 * Chrome lives on the inner View — border/background don't render applied
 * straight to a Pressable in this RN setup.
 */
export function InteractivePill({
  label,
  onPress,
  accent = colors.magenta,
  accentFill = 'transparent',
  leading,
  accessibilityHint,
  style,
}: {
  label: string
  onPress: () => void
  /** Border + label colour. */
  accent?: string
  /** Translucent fill behind the label (default transparent). */
  accentFill?: string
  leading?: ReactNode
  accessibilityHint?: string
  style?: ViewStyle
}) {
  const { onPressIn, onPressOut, animatedStyle } = usePressFeedback({ scale: true })

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      hitSlop={8}
      style={style}
    >
      <Animated.View style={[styles.wrap, animatedStyle]}>
        <View style={[styles.pill, { borderColor: accent, backgroundColor: accentFill }]}>
          {leading}
          <Text style={[styles.label, { color: accent }]}>{label}</Text>
        </View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  label: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    letterSpacing: 0.3,
  },
})
