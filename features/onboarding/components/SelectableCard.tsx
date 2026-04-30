import * as Haptics from 'expo-haptics'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props =
  | {
      variant: 'square'
      label: string
      icon?: string
      selected: boolean
      onPress: () => void
      description?: never
    }
  | {
      variant: 'row'
      label: string
      description?: string
      selected: boolean
      onPress: () => void
      icon?: never
    }

/*
 * Two flavours share a token surface so the selected state reads the
 * same regardless of layout: pearl-elevated when idle, mauveTinted +
 * mauveDeep border when picked. The square variant is for binary
 * choices laid side-by-side (sex, future on/off cards). The row
 * variant is for stacked lists with a description (goal selection).
 *
 * Built on TouchableOpacity, not Pressable — the function-style prop
 * on Pressable was failing to render backgroundColor in some iOS
 * native + RN combos, leaving cards invisible. activeOpacity gives
 * the same press-fade feedback without the function path.
 *
 * Square variant uses an explicit minHeight instead of aspectRatio
 * for the same reason — flex:1 + aspectRatio collapses to zero
 * height on iOS native when the parent's width hasn't measured yet.
 */
export function SelectableCard(props: Props) {
  const { variant, label, selected, onPress } = props

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {})
    onPress()
  }

  const surfaceStyle = [
    variant === 'square' ? styles.square : styles.row,
    selected ? styles.selected : styles.idle,
  ]

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={surfaceStyle}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      {variant === 'square' ? (
        <View style={styles.squareInner}>
          {props.icon ? <Text style={styles.squareIcon}>{props.icon}</Text> : null}
          <Text style={[styles.squareLabel, selected && styles.labelSelected]}>{label}</Text>
        </View>
      ) : (
        <View style={styles.rowInner}>
          <Text style={[styles.rowLabel, selected && styles.labelSelected]}>{label}</Text>
          {props.description ? (
            <Text style={styles.rowDescription}>{props.description}</Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  square: {
    flex: 1,
    minHeight: 140,
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  squareInner: {
    alignItems: 'center',
    gap: 10,
  },
  squareIcon: {
    fontFamily: typography.display,
    fontSize: 30,
    color: colors.inkPrimary,
  },
  squareLabel: {
    fontFamily: typography.uiMedium,
    fontSize: 14,
    letterSpacing: 0.2,
    color: colors.inkPrimary,
  },
  row: {
    width: '100%',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 12,
  },
  rowInner: {
    gap: 4,
  },
  rowLabel: {
    fontFamily: typography.uiSemi,
    fontSize: 14,
    color: colors.inkPrimary,
  },
  rowDescription: {
    fontFamily: typography.ui,
    fontSize: 12,
    lineHeight: 17,
    color: colors.labelMuted,
  },
  labelSelected: {
    color: colors.mauveDeep,
  },
  idle: {
    backgroundColor: colors.pearlElevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  selected: {
    backgroundColor: colors.mauveTinted,
    borderWidth: 1.5,
    borderColor: colors.mauveDeep,
  },
})
