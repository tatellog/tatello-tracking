import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  /** Uppercase label drawn above the value. */
  label: string
  /** Current value. Clamped to [min, max] on every render. */
  value: number
  onChange: (next: number) => void
  /** Inclusive bounds. */
  min: number
  max: number
  /** Increment per tap. Defaults to 1. */
  step?: number
  /** Optional suffix (e.g. "horas", "días") shown next to the value. */
  unit?: string
  /** Number of decimals to render. Defaults to 0. */
  decimals?: number
}

/*
 * A simple stepper: − [big value] +. Used for sleep hours (3–14, step
 * 0.5) and cycle length (21–45, step 1). Built with two Pressables
 * and a giant display number — no slider library, no PanResponder.
 * One tap = one step. Haptic confirms each change.
 *
 * The buttons disable themselves at the bounds so the user can't push
 * past min/max. Visual style mirrors the rest of the wizard (cream
 * label, magenta accents).
 */
export function Stepper({ label, value, onChange, min, max, step = 1, unit, decimals = 0 }: Props) {
  const clamped = Math.max(min, Math.min(max, value))
  const canDec = clamped > min
  const canInc = clamped < max

  const handleStep = (direction: -1 | 1) => {
    const next = Math.max(min, Math.min(max, clamped + direction * step))
    if (next !== clamped) {
      Haptics.selectionAsync().catch(() => {})
      onChange(next)
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          onPress={() => handleStep(-1)}
          disabled={!canDec}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Disminuir"
          style={({ pressed }) => [
            styles.btn,
            pressed && canDec && styles.btnPressed,
            !canDec && styles.btnDisabled,
          ]}
        >
          <Text style={[styles.btnGlyph, !canDec && styles.btnGlyphDisabled]}>−</Text>
        </Pressable>

        <View style={styles.valueWrap}>
          <Text style={styles.value}>{clamped.toFixed(decimals)}</Text>
          {unit ? <Text style={styles.unit}>{unit}</Text> : null}
        </View>

        <Pressable
          onPress={() => handleStep(1)}
          disabled={!canInc}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Aumentar"
          style={({ pressed }) => [
            styles.btn,
            pressed && canInc && styles.btnPressed,
            !canInc && styles.btnDisabled,
          ]}
        >
          <Text style={[styles.btnGlyph, !canInc && styles.btnGlyphDisabled]}>+</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  label: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    color: colors.niebla,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  // Centred group with gap, not space-between — keeps the value
  // visually attached to its − / + controls instead of stranding the
  // number in the middle of the screen with the buttons at the edges.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  btn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    backgroundColor: colors.magentaTint,
    borderColor: colors.magenta,
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnGlyph: {
    fontFamily: typography.displaySemi,
    fontSize: 28,
    color: colors.leche,
    lineHeight: 32,
    includeFontPadding: false,
  },
  btnGlyphDisabled: {
    color: colors.niebla,
  },
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    minWidth: 140,
    justifyContent: 'center',
  },
  value: {
    fontFamily: typography.displayHeavy,
    fontSize: 72,
    color: colors.leche,
    letterSpacing: -2,
    lineHeight: 72,
    includeFontPadding: false,
  },
  unit: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 16,
    color: colors.magenta,
  },
})
