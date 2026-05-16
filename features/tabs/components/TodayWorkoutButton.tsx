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
 *
 * It reads as a tappable card, not a label: a soft magenta-tinted
 * surface with a large unchecked-checkbox circle and an imperative
 * title with a state-reminder subtitle. The fill and circle alone
 * carry the "tappable" signal — no loud border or glow, so the
 * constellation below stays the visual hero of the screen. The
 * circle is the only affordance — a check-in toggles state, so an
 * unchecked checkbox is the honest signal; a chevron would imply
 * navigation that does not happen.
 *
 * The whole card lives on the inner `card` View, not on the Pressable
 * — a function `style` on the Pressable did not apply here, so the
 * surface, border and row layout are all on a plain inner View.
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
      accessibilityHint="Aún no registras tu entreno de hoy"
    >
      <View style={styles.card}>
        <View style={styles.checkWrap}>
          <Svg width={30} height={30} viewBox="0 0 30 30">
            <Circle cx={15} cy={15} r={13} fill={colors.magentaTint2} />
            <Circle cx={15} cy={15} r={13} stroke={colors.magenta} strokeWidth={2} fill="none" />
          </Svg>
        </View>

        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>HOY</Text>
          <Text style={styles.title}>Marca tu entreno</Text>
          <Text style={styles.subtitle}>Aún no lo registras</Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(233,30,99,0.13)',
    marginBottom: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  checkWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    color: colors.magenta,
    letterSpacing: 2.4,
    marginBottom: 2,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: 19,
    color: colors.leche,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: typography.ui,
    fontSize: 12.5,
    color: colors.niebla,
    marginTop: 2,
  },
})
