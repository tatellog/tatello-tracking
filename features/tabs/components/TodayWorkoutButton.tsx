import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'

import { colors, typography } from '@/theme'

type Props = {
  committed: boolean
  onConfirm: () => void
  onUndo: () => void
}

/**
 * Daily workout check-in. Two contained visual states — neither
 * dominates the hero. The constellation below is the hero; this
 * button is the verb that lights it up.
 *
 *   committed=false → bordered ghost pill, magenta-tinted bg, magenta
 *                     glow. Reads as "an invitation, not a demand".
 *   committed=true  → quiet stamp chip, dark surface, cream text.
 *                     Visually steps back so the constellation can
 *                     hold attention.
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
      <Text style={styles.activeTitle}>Entrenar</Text>
      <View style={styles.activeStarWrap}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Path
            d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3 8.2 13.9 2 9.4h7.6z"
            fill="none"
            stroke={colors.magenta}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </View>
  )
}

function CommittedContent() {
  return (
    <View style={styles.row}>
      <View style={styles.committedStarWrap}>
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path
            d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3 8.2 13.9 2 9.4h7.6z"
            fill={colors.magenta}
          />
        </Svg>
      </View>
      <Text style={styles.committedTitle}>Entrenaste hoy</Text>
      <Text style={styles.committedHint}>tocar para deshacer</Text>
    </View>
  )
}

const ACTIVE_HEIGHT = 52
const COMMITTED_HEIGHT = 44

const styles = StyleSheet.create({
  activeShell: {
    height: ACTIVE_HEIGHT,
    borderRadius: ACTIVE_HEIGHT / 2,
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
  committedShell: {
    height: COMMITTED_HEIGHT,
    borderRadius: COMMITTED_HEIGHT / 2,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.bruma,
    marginBottom: 18,
    paddingHorizontal: 18,
    justifyContent: 'center',
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
  activeStarWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  committedStarWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  committedTitle: {
    flex: 1,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 15,
    color: colors.leche,
  },
  committedHint: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 11,
    color: colors.niebla,
  },
})
