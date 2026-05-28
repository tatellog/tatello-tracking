import { useEffect, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

/*
 * The streak line — a compact "X días en órbita" sat right under the
 * Hoy check-in. It's the *stake* of the toggle: what each log
 * protects and extends. Loss aversion is the strongest recurring
 * motivator there is, so the streak has to be visible — but STELAR is
 * anti-guilt, so it only ever names what's held, never threatens.
 *
 * `streak` comes from the server (`BriefContext.streak_days`) — one
 * source of truth, so this and the rest of the app always agree.
 *
 * On an increment the number does a scale-pop + a magenta→white
 * colour flash, so the eye catches the streak *growing* the moment
 * the user commits. Hidden under 2 days — a "1 día" / "0 días" line
 * would nag more than it rewards.
 */
export function StreakLine({ streak }: { streak: number }) {
  const pop = useSharedValue(0)
  const prev = useRef(streak)

  useEffect(() => {
    const before = prev.current
    prev.current = streak
    // Only an upward change is a reward — a reset is felt by its
    // absence, it shouldn't get an animation.
    if (streak > before) {
      pop.value = 0
      pop.value = withSequence(
        withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.4)) }),
        withTiming(0, { duration: 360, easing: Easing.inOut(Easing.cubic) }),
      )
    }
  }, [streak, pop])

  const numStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pop.value * 0.18 }],
    color: interpolateColor(pop.value, [0, 1], [colors.magenta, '#FFF3FA']),
  }))

  if (streak < 2) return null

  return (
    <View style={styles.row}>
      <Text style={styles.star}>✦</Text>
      <Animated.Text style={[styles.num, numStyle]}>{streak}</Animated.Text>
      <Text style={styles.label}>días en órbita</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // Tucked up close to the check-in pill — the streak belongs to the
  // toggle, not to the section below it.
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 4,
    marginBottom: 4,
    // Bronze hairline border underneath the streak — same colour
    // family as the constellation card's frame so the chip reads
    // as part of the same visual vocabulary, not an isolated UI
    // element. Tiny self-aligned to stay subtle.
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomWidth: 0.8,
    borderColor: 'rgba(217, 174, 111, 0.28)',
  },
  star: {
    fontSize: typography.sizes.smallLabel,
    color: colors.magenta,
  },
  num: {
    fontFamily: typography.displaySemi,
    fontSize: typography.sizes.ui,
    color: colors.magenta,
    letterSpacing: -0.3,
  },
  // Serif italic — the cosmic register; "en órbita" is STELAR's voice.
  label: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    color: colors.niebla,
  },
})
