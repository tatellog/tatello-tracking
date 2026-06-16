import { Feather } from '@expo/vector-icons'
import { type StyleProp, type TextStyle } from 'react-native'

import { colors } from '@/theme'

export type ChevronDirection = 'right' | 'down' | 'up'

// A clean Feather chevron — right = "opens a screen", down = "expands",
// up = "collapse". (A real chevron glyph, NOT a rotated ›, which reads as a
// crooked bracket.)
const ICON: Record<ChevronDirection, 'chevron-right' | 'chevron-down' | 'chevron-up'> = {
  right: 'chevron-right',
  down: 'chevron-down',
  up: 'chevron-up',
}

/**
 * The chevron signifier. ALWAYS one of ≥2 signals (never alone) — it pairs
 * with press feedback / a label / an active border. Decorative for a11y; the
 * parent Pressable carries the role + hint.
 */
export function ChevronHint({
  direction = 'right',
  color = colors.niebla,
  size = 18,
  style,
}: {
  direction?: ChevronDirection
  color?: string
  size?: number
  style?: StyleProp<TextStyle>
}) {
  return (
    <Feather
      name={ICON[direction]}
      size={size}
      color={color}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  )
}
