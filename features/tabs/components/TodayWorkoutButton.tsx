import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

import { colors, typography } from '@/theme'

type Props = {
  onConfirm: () => void
}

/**
 * Daily workout check-in CTA. A CTA exists to drive an action — once
 * the workout is marked it has no job left, so this component is only
 * rendered while the day is *un*marked (see app/(tabs)/index.tsx).
 *
 * The committed state lives elsewhere now: the constellation burst,
 * the coach line and the filled "HOY" star in the WeekStrip all
 * confirm the workout, and undoing happens by tapping that same star.
 * Keeping a committed pill here just repeated those signals in the
 * screen's most valuable slot.
 *
 * Magenta-tinted bg, full magenta border + glow, "HOY · Marcar
 * entreno · ○". The empty circle evokes an unchecked checkbox — tap
 * to fill. Verb+noun "marcar entreno" makes the action explicit
 * (it's a check-in, not "go train").
 */
export function TodayWorkoutButton({ onConfirm }: Props) {
  const handlePress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    onConfirm()
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Marcar entreno de hoy"
      style={({ pressed }) => [styles.shell, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <Text style={styles.eyebrow}>HOY</Text>
        <Text style={styles.title}>Marcar entreno</Text>
        <View style={styles.checkWrap}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Circle cx={12} cy={12} r={9} stroke={colors.magenta} strokeWidth={1.6} fill="none" />
          </Svg>
        </View>
      </View>
    </Pressable>
  )
}

const SHELL_HEIGHT = 52

const styles = StyleSheet.create({
  shell: {
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
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    color: colors.magenta,
    letterSpacing: 2.4,
  },
  title: {
    flex: 1,
    fontFamily: typography.displayHeavy,
    fontSize: 18,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  checkWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
