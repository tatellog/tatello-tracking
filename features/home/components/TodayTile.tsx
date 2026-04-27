import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { colors, radius, shadows, spacing, typography } from '@/theme'

type State = 'morning' | 'day' | 'urgent'

type Props = {
  state: State
  topLabel: string
  bottomText: string
  size: number
  onMark: () => void
}

/*
 * The 2x2 in-grid prompt that replaces the bottom-right four cells
 * when today's workout isn't marked. Three pending variants share the
 * same shell — only halo speed, breathing depth and bottom-text
 * weight differ. `urgent` intensifies all three.
 *
 * Press choreography:
 *   onPressIn  → haptic Medium + scale 1 → 0.96 (spring).
 *   onPress    → cross-fade '＋ → ✓' (250ms) + 350ms hold, then
 *                fire onMark(). The optimistic mutation flips
 *                today_workout_completed = true upstream, the parent
 *                stops rendering the tile, and the missing four
 *                cells reappear with a stagger entrance. Total ≈ 900ms
 *                from tap to grid-completed.
 */
const INTENSITY: Record<
  State,
  {
    haloMs: number
    haloMaxOpacity: number
    breathMs: number
    breathMaxScale: number
    bottomWeight: '500' | '600'
    bottomLetterSpacing: number
  }
> = {
  morning: {
    haloMs: 2600,
    haloMaxOpacity: 0.8,
    breathMs: 2800,
    breathMaxScale: 1.04,
    bottomWeight: '500',
    bottomLetterSpacing: 0,
  },
  day: {
    haloMs: 2600,
    haloMaxOpacity: 0.8,
    breathMs: 2800,
    breathMaxScale: 1.04,
    bottomWeight: '500',
    bottomLetterSpacing: 0,
  },
  urgent: {
    haloMs: 1800,
    haloMaxOpacity: 1.0,
    breathMs: 1800,
    breathMaxScale: 1.06,
    bottomWeight: '600',
    bottomLetterSpacing: 0.5,
  },
}

// U+FF0B FULLWIDTH PLUS SIGN — visually balanced inside an Inter-style
// system face. If a system fallback can't render it, the bounding box
// stays the same width as a regular '+' so layout doesn't shift.
const PLUS_GLYPH = '＋'

const PRESS_HOLD_MS = 600 // 250ms cross-fade + 350ms hold with check

export function TodayTile({ state, topLabel, bottomText, size, onMark }: Props) {
  const intensity = INTENSITY[state]
  const [pressed, setPressed] = useState(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Bail out cleanly if the component unmounts mid-press (user navs
  // away in the 600ms hold window) — otherwise the setTimeout would
  // fire onMark on a stale handler.
  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current)
    }
  }, [])

  const haloOpacity = useSharedValue(0.4)
  const haloScale = useSharedValue(1)
  const breath = useSharedValue(1)
  const plusBob = useSharedValue(0)
  const pressScale = useSharedValue(1)
  const checkOpacity = useSharedValue(0)

  useEffect(() => {
    haloOpacity.value = withRepeat(
      withSequence(
        withTiming(intensity.haloMaxOpacity, {
          duration: intensity.haloMs / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0.4, {
          duration: intensity.haloMs / 2,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    )
    haloScale.value = withRepeat(
      withTiming(1.04, {
        duration: intensity.haloMs,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    )
    return () => {
      cancelAnimation(haloOpacity)
      cancelAnimation(haloScale)
    }
  }, [intensity.haloMs, intensity.haloMaxOpacity, haloOpacity, haloScale])

  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(intensity.breathMaxScale, {
          duration: intensity.breathMs / 2,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: intensity.breathMs / 2,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    )
    return () => cancelAnimation(breath)
  }, [intensity.breathMs, intensity.breathMaxScale, breath])

  useEffect(() => {
    plusBob.value = withRepeat(
      withSequence(
        withTiming(2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(-2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    )
    return () => cancelAnimation(plusBob)
  }, [plusBob])

  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloOpacity.value,
    transform: [{ scale: haloScale.value }],
  }))
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value * pressScale.value }],
  }))
  const plusStyle = useAnimatedStyle(() => ({
    opacity: 1 - checkOpacity.value,
    transform: [{ translateY: plusBob.value }],
  }))
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
  }))

  const handlePressIn = () => {
    if (pressed) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    pressScale.value = withSpring(0.96, { damping: 14, stiffness: 220 })
  }

  const handlePressOut = () => {
    if (pressed) return
    pressScale.value = withSpring(1, { damping: 14, stiffness: 220 })
  }

  const handlePress = () => {
    if (pressed) return
    setPressed(true)
    checkOpacity.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) })
    pressTimer.current = setTimeout(onMark, PRESS_HOLD_MS)
  }

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`${topLabel}. ${bottomText}.`}
      style={[styles.pressable, { width: size, height: size }]}
    >
      <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
      <Animated.View style={[styles.body, bodyStyle]}>
        <LinearGradient
          colors={[colors.mauveLight, colors.mauveDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text
            style={styles.topLabel}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {topLabel.toUpperCase()}
          </Text>
          <View style={styles.glyphSlot}>
            <Animated.Text style={[styles.glyph, plusStyle]}>{PLUS_GLYPH}</Animated.Text>
            <Animated.Text style={[styles.glyph, styles.check, checkStyle]}>✓</Animated.Text>
          </View>
          <Text
            style={[
              styles.bottomText,
              {
                fontWeight: intensity.bottomWeight,
                letterSpacing: intensity.bottomLetterSpacing,
              },
            ]}
            numberOfLines={2}
          >
            {bottomText}
          </Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: radius.tile + 2,
    borderWidth: 1.5,
    borderColor: colors.mauveDeep,
  },
  body: {
    width: '100%',
    height: '100%',
    borderRadius: radius.tile,
    borderWidth: 2,
    borderColor: colors.pearlElevated,
    overflow: 'hidden',
    ...shadows.tileBig,
  },
  gradient: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topLabel: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.semi,
    letterSpacing: typography.letterSpacing.uppercaseWide,
    color: colors.pearlElevated,
    opacity: 0.85,
    textAlign: 'center',
  },
  glyphSlot: {
    height: typography.sizes.tilePlus + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    position: 'absolute',
    fontFamily: typography.display,
    fontWeight: typography.fontWeight.light,
    fontSize: typography.sizes.tilePlus,
    color: colors.pearlElevated,
    textAlign: 'center',
    includeFontPadding: false,
  },
  check: {
    fontWeight: typography.fontWeight.medium,
    fontSize: typography.sizes.tilePlus * 0.82,
  },
  bottomText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.smallLabel + 0.5,
    lineHeight: (typography.sizes.smallLabel + 0.5) * typography.lineHeight.statement,
    color: colors.pearlElevated,
    textAlign: 'center',
  },
})
