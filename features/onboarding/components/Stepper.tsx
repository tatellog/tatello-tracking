import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/theme'

type Props = {
  /** Label drawn above the value. Sentence-case, human (uxui override). */
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
  /**
   * Display font size of the big value. Defaults to 72 — the original
   * hero size, preserved EXACTLY for rhythm / sueño (which never pass
   * this). cycle passes a smaller value (48) because cycle length is
   * a secondary datum, not the screen's headline. The value's lineHeight,
   * the value-wrap minWidth and the unit's italic size all DERIVE from
   * this so the proportions stay balanced at any size.
   */
  valueSize?: number
}

// The original hero size. When valueSize === DEFAULT_VALUE_SIZE every
// derived metric below collapses to the historical literals, so the
// two existing consumers (rhythm, sueño) render byte-identically.
const DEFAULT_VALUE_SIZE = 72

/*
 * A simple stepper: − [big value] +. Used for sleep hours (3–14, step
 * 0.5) and cycle length (21–45, step 1). Built with two Pressables
 * and a giant display number — no slider library, no PanResponder.
 * One tap = one step. Haptic confirms each change.
 *
 * The buttons disable themselves at the bounds so the user can't push
 * past min/max. Visual style mirrors the rest of the wizard (cream
 * label, magenta accents). The big value carries a SUBTLE warm halo
 * (magentaHot @ 0.18) — the same inputFilled glow as about-you's filled
 * values — so the number reads as premium light, not flat ink (applies
 * to BOTH consumers: "7.0 horas" and "28 días" both gain the warm glow,
 * a deliberate coherence decision).
 *
 * LABEL (uxui override #5): the label is sentence-case Hanken upright
 * (uiMedium, letterSpacing ~0.2, bone), a clear human field label — not
 * uppercase technical tracking. rhythm passes label="" so this is
 * invisible there; the label COPY is the caller's (pending behavioral /
 * voice-and-copy sign-off).
 */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  decimals = 0,
  valueSize = DEFAULT_VALUE_SIZE,
}: Props) {
  const clamped = Math.max(min, Math.min(max, value))
  const canDec = clamped > min
  const canInc = clamped < max

  // Derived proportions. At the default 72 these resolve to the original
  // literals (lineHeight 72, minWidth 140, unit = sizes.title) so the
  // existing screens are untouched; at 48 they scale down proportionally.
  const ratio = valueSize / DEFAULT_VALUE_SIZE
  const valueLineHeight = valueSize
  const valueMinWidth = Math.round(140 * ratio)
  const unitFontSize = Math.round(typography.sizes.title * ratio)

  const handleStep = (direction: -1 | 1) => {
    const next = Math.max(min, Math.min(max, clamped + direction * step))
    if (next !== clamped) {
      Haptics.selectionAsync().catch(() => {})
      onChange(next)
    }
  }

  return (
    <View style={styles.wrap}>
      {/* Always render the label node (even when empty) so rhythm —
          which passes label="" — keeps its exact previous layout (the
          wrap's gap:14 already accounted for this empty Text). */}
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

        <View style={[styles.valueWrap, { minWidth: valueMinWidth }]}>
          <Text style={[styles.value, { fontSize: valueSize, lineHeight: valueLineHeight }]}>
            {clamped.toFixed(decimals)}
          </Text>
          {unit ? <Text style={[styles.unit, { fontSize: unitFontSize }]}>{unit}</Text> : null}
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
  // Sentence-case Hanken upright (uxui override #5) — a clear, human field
  // label, not uppercase technical tracking. bone for warm legibility.
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.bone,
    letterSpacing: 0.2,
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
  // Buttons are FIXED (52×52, hitSlop) regardless of valueSize —
  // usability of the touch targets never scales down.
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
    fontSize: typography.sizes.deltaNum,
    color: colors.leche,
    lineHeight: 32,
    includeFontPadding: false,
  },
  btnGlyphDisabled: {
    color: colors.niebla,
  },
  // minWidth is supplied inline (derived from valueSize); the rest stays
  // constant so the baseline-aligned unit keeps its relationship.
  valueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    justifyContent: 'center',
  },
  // fontSize + lineHeight are supplied inline (derived from valueSize).
  // The warm halo (magentaHot @ 0.18 / radius 8) is the same inputFilled
  // glow as about-you's filled values — the big number reads as premium
  // light rather than flat ink, for both consumers.
  value: {
    fontFamily: typography.displayHeavy,
    color: colors.leche,
    letterSpacing: -2,
    includeFontPadding: false,
    textShadowColor: 'rgba(255,72,134,0.18)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  // fontSize supplied inline (derived from valueSize).
  unit: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    color: colors.magenta,
  },
})
