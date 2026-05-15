import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

type Props = {
  committed: boolean
  onConfirm: () => void
  onUndo: () => void
}

/**
 * Daily workout check-in. Single pill silhouette that toggles between
 * two states — same height/radius/padding so the transition reads as
 * one control flipping rather than two unrelated UI objects.
 *
 *   committed=false → magenta-tinted bg, full magenta border + glow,
 *                     "HOY · Marcar entreno · ○". The empty circle
 *                     icon evokes an unchecked checkbox — tap to fill.
 *                     Verb+noun "marcar entreno" makes the action
 *                     explicit (it's a check-in, not "go train").
 *   committed=true  → softer magenta tint + dimmer magenta border +
 *                     half-intensity glow, "✓ · Entrenaste hoy · ×".
 *                     The × icon carries the "tap to undo" affordance
 *                     so the shape still feels alive without a verbose
 *                     hint string. Empty circle → filled check tells
 *                     the toggle's micro-narrative without copy.
 */
export function TodayWorkoutButton({ committed, onConfirm, onUndo }: Props) {
  const handlePress = () => {
    Haptics.notificationAsync(
      committed
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success,
    ).catch(() => {})
    if (committed) onUndo()
    else onConfirm()
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={committed ? 'Deshacer entreno de hoy' : 'Marcar entreno de hoy'}
      accessibilityState={{ selected: committed }}
      style={({ pressed }) => [
        committed ? styles.committedShell : styles.activeShell,
        pressed && styles.pressed,
      ]}
    >
      {committed ? <CommittedContent /> : <ActiveContent />}
    </Pressable>
  )
}

function ActiveContent() {
  return (
    <View style={styles.row}>
      <Text style={styles.activeEyebrow}>HOY</Text>
      <Text style={styles.activeTitle}>Marcar entreno</Text>
      <View style={styles.activeCheckWrap}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9} stroke={colors.magenta} strokeWidth={1.6} fill="none" />
        </Svg>
      </View>
    </View>
  )
}

function CommittedContent() {
  return (
    <View style={styles.row}>
      <View style={styles.committedCheckWrap}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path
            d="M5 12.5l4.5 4.5L19 7"
            stroke={colors.magenta}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </View>
      <Text style={styles.committedTitle}>Entrenaste hoy</Text>
      <View style={styles.committedCloseWrap}>
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path
            d="M6 6l12 12M18 6L6 18"
            stroke={colors.magenta}
            strokeOpacity={0.7}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  )
}

const SHELL_HEIGHT = 52

const styles = StyleSheet.create({
  activeShell: {
    height: SHELL_HEIGHT,
    borderRadius: SHELL_HEIGHT / 2,
    backgroundColor: 'rgba(233,30,99,0.12)',
    borderWidth: 1.5,
    borderColor: colors.magenta,
    marginBottom: 18,
    paddingHorizontal: 22,
    justifyContent: 'center',
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 4,
  },
  // Same silhouette as activeShell so the toggle reads as one
  // control flipping state. Magenta tint stays present but dims —
  // the × icon on the right side now carries the "tap to undo"
  // affordance instead of a literal hint string.
  committedShell: {
    height: SHELL_HEIGHT,
    borderRadius: SHELL_HEIGHT / 2,
    backgroundColor: 'rgba(233,30,99,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(233,30,99,0.45)',
    marginBottom: 18,
    paddingHorizontal: 22,
    justifyContent: 'center',
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 2,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeEyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    color: colors.magenta,
    letterSpacing: 2.4,
  },
  activeTitle: {
    flex: 1,
    fontFamily: typography.displayHeavy,
    fontSize: 18,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  activeCheckWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  committedCheckWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  committedTitle: {
    flex: 1,
    fontFamily: typography.displayHeavy,
    fontSize: 18,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  committedCloseWrap: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
