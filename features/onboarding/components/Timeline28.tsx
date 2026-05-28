import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

const DOT_COUNT = 28
const TODAY_IDX = 0
const TARGET_IDX = DOT_COUNT - 1

/**
 * 28-dot horizontal timeline. Day 1 pulses, Day 28 rotates a dashed
 * ring, a magenta scan line sweeps left→right every 6 s. Static dots
 * in between are alpha-leche; the animations only run on day 1 / 28.
 */
export function Timeline28() {
  const scan = useSharedValue(0)
  const pulse = useSharedValue(0)
  const ring = useSharedValue(0)

  useEffect(() => {
    scan.value = withDelay(
      2000,
      withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.cubic) }), -1, false),
    )
    pulse.value = withDelay(
      1200,
      withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) }), -1, false),
    )
    ring.value = withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1, false)

    return () => {
      cancelAnimation(scan)
      cancelAnimation(pulse)
      cancelAnimation(ring)
    }
  }, [scan, pulse, ring])

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -60 + scan.value * 320 }],
    opacity: scan.value > 0.1 && scan.value < 0.9 ? 1 : 0,
  }))

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 4 }],
    opacity: (1 - pulse.value) * 0.55,
  }))

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ring.value * 360}deg` }],
  }))

  return (
    <View style={styles.wrap} accessible={false}>
      <View style={styles.track} />
      <Animated.View style={[styles.scan, scanStyle]} />
      <View style={styles.dotsRow}>
        {Array.from({ length: DOT_COUNT }).map((_, i) => {
          if (i === TODAY_IDX) {
            return (
              <View key={i} style={styles.dotWrap}>
                <Animated.View style={[styles.day1Pulse, pulseStyle]} />
                <View style={styles.day1} />
              </View>
            )
          }
          if (i === TARGET_IDX) {
            return (
              <View key={i} style={styles.dotWrap}>
                <Animated.View style={[styles.day28Ring, ringStyle]} />
                <View style={styles.day28} />
              </View>
            )
          }
          return <View key={i} style={styles.dot} />
        })}
      </View>
      <View style={styles.labels}>
        <Text style={[styles.label, styles.labelNow]}>Día 1</Text>
        <Text style={styles.label}>Día 28</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 64,
    marginTop: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  track: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.bruma,
  },
  scan: {
    position: 'absolute',
    top: 0,
    width: 60,
    height: 40,
    backgroundColor: 'rgba(233, 30, 99, 0.18)',
    borderRadius: 30,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    height: 40,
  },
  dotWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 14,
    height: 14,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(244, 236, 222, 0.22)',
  },
  day1: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  day1Pulse: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.magenta,
  },
  day28: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.magenta,
    backgroundColor: 'transparent',
  },
  day28Ring: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.magenta,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  label: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.tinyLabel,
    color: colors.niebla,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  labelNow: {
    color: colors.magenta,
  },
})
