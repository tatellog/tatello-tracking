import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
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

type State = 'morning' | 'day' | 'urgent' | 'first-day'

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
 * Press choreography — matches the calendar Cell behaviour (no
 * checkmark beat, immediate toggle):
 *   onPressIn  → haptic Medium + scale 1 → 0.96 (spring).
 *   onPress    → fire onMark() immediately. The optimistic mutation
 *                flips today_workout_completed = true upstream; the
 *                parent stops rendering the tile (FadeOut.300ms), and
 *                the missing four cells stagger in.
 *
 * Earlier this used a ＋ → ✓ cross-fade with a 600 ms hold; in a 2×2
 * tile the check rendered visually huge relative to a single-cell
 * mark, so we removed the intermediate state and let the dismiss
 * animation be the confirmation.
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
  // first-day shares morning's gentleness — the user is brand new,
  // the tile shouldn't be shouting. The germinate entrance below
  // does the work of drawing attention without intensity boosts.
  'first-day': {
    haloMs: 2600,
    haloMaxOpacity: 0.8,
    breathMs: 2800,
    breathMaxScale: 1.04,
    bottomWeight: '500',
    bottomLetterSpacing: 0,
  },
}

// U+FF0B FULLWIDTH PLUS SIGN — visually balanced inside an Inter-style
// system face. If a system fallback can't render it, the bounding box
// stays the same width as a regular '+' so layout doesn't shift.
const PLUS_GLYPH = '＋'

export function TodayTile({ state, topLabel, bottomText, size, onMark }: Props) {
  const intensity = INTENSITY[state]
  const [pressed, setPressed] = useState(false)

  const haloOpacity = useSharedValue(0.4)
  const haloScale = useSharedValue(1)
  const breath = useSharedValue(1)
  const plusBob = useSharedValue(0)
  const pressScale = useSharedValue(1)
  // Germinate: 0 → 1.2 (overshoot bezier) → 1 (spring rest). Only
  // armed for first-day; every other state starts at full size so a
  // re-render doesn't trigger a phantom entrance animation.
  const entryScale = useSharedValue(state === 'first-day' ? 0 : 1)

  useEffect(() => {
    if (state !== 'first-day') {
      entryScale.value = 1
      return
    }
    entryScale.value = withSequence(
      withTiming(1.2, { duration: 400, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }),
      withSpring(1, { stiffness: 100, damping: 12 }),
    )
  }, [state, entryScale])

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
    transform: [{ scale: breath.value * pressScale.value * entryScale.value }],
  }))
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: plusBob.value }],
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
    // Fire immediately — same instant-toggle as the calendar Cells.
    // The 300 ms FadeOut on the parent's Animated.View covers the
    // dismiss; no intermediate checkmark needed.
    onMark()
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
  bottomText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.smallLabel + 0.5,
    lineHeight: (typography.sizes.smallLabel + 0.5) * typography.lineHeight.statement,
    color: colors.pearlElevated,
    textAlign: 'center',
  },
})
