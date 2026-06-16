import { type ReactNode } from 'react'
import { Pressable, StyleSheet, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'

import { colors, radius, spacing } from '@/theme'

import { ChevronHint } from './ChevronHint'
import { usePressFeedback } from './usePressFeedback'

export type InteractiveCardVariant = 'info' | 'navigate' | 'expand'

/**
 * The card-level interaction wrapper — encodes the rules so every card across
 * the app speaks the same language:
 *
 *  - `info`     → inert: flat border, NO chevron, NO press feedback. (Must not
 *                 look clickable.)
 *  - `navigate` → Pressable + scale + haptic + a › chevron (opens a screen).
 *  - `expand`   → Pressable + scale + haptic + a ⌄/⌃ chevron + an active
 *                 border while `expanded`.
 *
 * The chrome + scale live on the inner Animated.View; the Pressable is only
 * the hit layer (border/bg don't render straight on a Pressable here).
 * Children own their own layout; the chevron is overlaid top-right.
 */
export function InteractiveCard({
  children,
  variant = 'info',
  expanded = false,
  onPress,
  accent = colors.magenta,
  showChevron = true,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  children: ReactNode
  variant?: InteractiveCardVariant
  /** For `expand` — flips the chevron and lights the border. */
  expanded?: boolean
  onPress?: () => void
  /** Active-border colour for the expanded state. */
  accent?: string
  showChevron?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
  style?: ViewStyle
}) {
  const interactive = variant !== 'info' && !!onPress
  const { onPressIn, onPressOut, animatedStyle } = usePressFeedback({ scale: interactive })

  const body = (
    <Animated.View
      style={[
        styles.card,
        variant === 'expand' && expanded ? { borderColor: accent } : null,
        interactive ? animatedStyle : null,
        style,
      ]}
    >
      {children}
      {interactive && showChevron ? (
        <ChevronHint
          direction={variant === 'expand' ? (expanded ? 'up' : 'down') : 'right'}
          style={styles.chevron}
        />
      ) : null}
    </Animated.View>
  )

  if (!interactive) return body

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={
        accessibilityHint ?? (variant === 'expand' ? 'Expande sección' : 'Abre detalle')
      }
    >
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: colors.bgCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
  chevron: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.md,
  },
})
