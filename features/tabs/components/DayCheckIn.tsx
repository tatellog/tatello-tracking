import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

export type DayState = 'undecided' | 'trained' | 'rested'

type Props = {
  state: DayState
  /** Next state — the parent maps it to the workout/rest mutations. */
  onChange: (next: DayState) => void
}

// Star = a trained day (the constellation's glyph); moon = a rest day.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'
const MOON_PATH = 'M15.8 3.2 A 9 9 0 1 0 15.8 20.8 A 7 7 0 1 1 15.8 3.2 Z'

function SegGlyph({ kind, color }: { kind: 'star' | 'moon'; color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path d={kind === 'star' ? STAR_PATH : MOON_PATH} fill={color} />
    </Svg>
  )
}

type SegmentProps = {
  label: string
  kind: 'star' | 'moon'
  active: boolean
  onPress: () => void
}

function Segment({ label, kind, active, onPress }: SegmentProps) {
  const tint = active ? colors.magenta : colors.niebla
  return (
    <Pressable
      onPress={onPress}
      style={[styles.seg, active && styles.segActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <SegGlyph kind={kind} color={tint} />
      <Text style={[styles.segText, { color: tint }]}>{label}</Text>
    </Pressable>
  )
}

/**
 * The daily check-in — a persistent two-segment toggle: Entrené /
 * Descansé. One control owns the whole day's state:
 *   - tap a side to answer,
 *   - tap the *active* side again to clear back to undecided.
 * So a single toggle does mark, switch and undo for both training and
 * rest. Both answers are equal and valid — neither reads as failure.
 *
 * The control persists (it doesn't unmount once answered) so the day's
 * state is always visible and editable in one place. When 'rested' is
 * active a supportive, evidence-based line shows below — rest framed
 * as recovery, never guilt.
 */
export function DayCheckIn({ state, onChange }: Props) {
  const pick = (seg: 'trained' | 'rested') => {
    Haptics.selectionAsync().catch(() => {})
    // Tapping the active side clears it; tapping the other switches.
    onChange(state === seg ? 'undecided' : seg)
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>Hoy</Text>
      <View style={styles.pill}>
        <Segment
          label="Entrené"
          kind="star"
          active={state === 'trained'}
          onPress={() => pick('trained')}
        />
        <Segment
          label="Descansé"
          kind="moon"
          active={state === 'rested'}
          onPress={() => pick('rested')}
        />
      </View>
      {state === 'rested' ? (
        <Text style={styles.restMessage}>
          El músculo se reconstruye en el reposo. Mañana vuelves{' '}
          <Text style={styles.restEm}>más fuerte</Text>.
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    color: colors.magenta,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  // One stadium pill, two segments — the same control vocabulary as
  // the meal-slot pills (bgCard2, hairline, inner padding).
  pill: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard2,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 4,
  },
  seg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 22,
  },
  // The chosen side — a soft magenta capsule.
  segActive: {
    backgroundColor: colors.magentaTint2,
  },
  segText: {
    fontFamily: typography.uiBold,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  // Editorial voice — serif italic, evidence not guilt.
  restMessage: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: colors.bone,
    marginTop: 10,
    marginLeft: 2,
  },
  restEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    color: colors.magenta,
  },
})
