import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { colors, radius, spacing } from '@/theme'

/*
 * Loading placeholder shown while the first BriefContext fetch is
 * in flight. Occupies the same vertical real estate as the real
 * Home so the hand-off doesn't reflow. Every block pulses opacity
 * 0.3 ↔ 0.6 on a 1.5 s cycle, phase-shared (not staggered) so the
 * skeleton reads as one uniform 'loading' state, not as content
 * entering.
 */
export function HomeSkeleton() {
  const pulse = useSharedValue(0.6)

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
  }, [pulse])

  const animStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))

  return (
    <View style={styles.root}>
      {/* header row */}
      <View style={styles.row}>
        <View style={{ gap: spacing.xs }}>
          <Animated.View style={[styles.headerBar, animStyle]} />
          <Animated.View style={[styles.headerBarSmall, animStyle]} />
        </View>
        <Animated.View style={[styles.toggle, animStyle]} />
      </View>

      {/* streak card */}
      <Animated.View style={[styles.card, animStyle]} />

      {/* macros card */}
      <Animated.View style={[styles.macrosCard, animStyle]} />

      {/* log meal CTA */}
      <Animated.View style={[styles.logCta, animStyle]} />

      {/* deltas */}
      <View style={styles.deltasRow}>
        <Animated.View style={[styles.deltaBlock, animStyle]} />
        <Animated.View style={[styles.deltaBlock, animStyle]} />
      </View>

      {/* anchor */}
      <View style={styles.anchorWrap}>
        <Animated.View style={[styles.anchorLabel, animStyle]} />
        <Animated.View style={[styles.anchorText, animStyle]} />
      </View>

      {/* swipe */}
      <Animated.View style={[styles.swipe, animStyle]} />

      {/* quick actions */}
      <View style={styles.quickRow}>
        <Animated.View style={[styles.pill, animStyle]} />
        <Animated.View style={[styles.pill, animStyle]} />
      </View>

      {/* mood */}
      <View style={styles.moodWrap}>
        <Animated.View style={[styles.moodLabel, animStyle]} />
        <View style={styles.orbs}>
          <Animated.View style={[styles.orb, animStyle]} />
          <Animated.View style={[styles.orb, animStyle]} />
          <Animated.View style={[styles.orb, animStyle]} />
        </View>
      </View>
    </View>
  )
}

const BLOCK = colors.borderSubtle

const styles = StyleSheet.create({
  root: {
    gap: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerBar: {
    width: 140,
    height: 12,
    borderRadius: 4,
    backgroundColor: BLOCK,
  },
  headerBarSmall: {
    width: 60,
    height: 10,
    borderRadius: 4,
    backgroundColor: BLOCK,
  },
  toggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BLOCK,
  },
  card: {
    height: 230,
    borderRadius: radius.card,
    backgroundColor: BLOCK,
  },
  macrosCard: {
    height: 220,
    borderRadius: radius.card,
    backgroundColor: BLOCK,
  },
  logCta: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: BLOCK,
  },
  deltasRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.md,
  },
  deltaBlock: {
    width: 110,
    height: 52,
    borderRadius: 6,
    backgroundColor: BLOCK,
  },
  anchorWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  anchorLabel: {
    width: 90,
    height: 10,
    borderRadius: 4,
    backgroundColor: BLOCK,
  },
  anchorText: {
    width: 220,
    height: 22,
    borderRadius: 4,
    backgroundColor: BLOCK,
  },
  swipe: {
    height: 62,
    borderRadius: radius.pill,
    backgroundColor: BLOCK,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: BLOCK,
  },
  moodWrap: {
    alignItems: 'center',
    gap: spacing.md,
  },
  moodLabel: {
    width: 120,
    height: 10,
    borderRadius: 4,
    backgroundColor: BLOCK,
  },
  orbs: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  orb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BLOCK,
  },
})
