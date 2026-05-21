import * as Haptics from 'expo-haptics'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/*
 * Horizontal touch slider for the height step. Three cinematic
 * upgrades over the previous version:
 *
 *   1. The 58 px hero number breathes (1 ↔ 1.02 over 4 s) and
 *      pulses (scale 1.04 spring) on every integer change, so the
 *      drag has tactile presence visually. A cream textShadow gives
 *      the digits a soft halo against the dark backdrop.
 *
 *   2. The thumb is a tiny cosmic body (core + 2 halo layers +
 *      4-point spike cross) instead of a flat magenta dot — same
 *      vocabulary as the welcome NorthStar and reveal satellites.
 *
 *   3. The track-fill is a magenta gradient (faint → saturated) so
 *      the filled portion reads as "warming up" toward the thumb,
 *      not a flat coloured bar.
 *
 * Range is integer cm; the slider snaps to whole numbers. Each new
 * integer fires a selection haptic so the drag feels tactile.
 */

type Props = {
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
}

const TRACK_HEIGHT = 3
const THUMB_BOX = 36
const STAR_R = 6

export function HeightSlider({ value, onChange, min = 140, max = 200 }: Props) {
  const [trackWidth, setTrackWidth] = useState(0)

  const progress = useSharedValue(0)
  useEffect(() => {
    const frac = trackWidth === 0 ? 0 : (value - min) / (max - min)
    progress.value = withTiming(Math.max(0, Math.min(1, frac)), {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    })
  }, [value, min, max, trackWidth, progress])

  // Slow breath drives the thumb's halo + the number's quiet pulse.
  const breath = useSharedValue(0)
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [breath])

  // Number scale-pulse — fires every time the user lands on a new
  // integer. The withSpring keeps the bounce subtle (no rubber).
  const numberPulse = useSharedValue(1)
  useEffect(() => {
    numberPulse.value = 1
    numberPulse.value = withSpring(1.04, { damping: 12, stiffness: 320 })
    const t = setTimeout(() => {
      numberPulse.value = withSpring(1, { damping: 14, stiffness: 220 })
    }, 80)
    return () => clearTimeout(t)
  }, [value, numberPulse])

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w !== trackWidth) setTrackWidth(w)
  }

  const handleTouch = (locationX: number) => {
    if (trackWidth <= 0) return
    const frac = Math.min(1, Math.max(0, locationX / trackWidth))
    const next = Math.round(min + (max - min) * frac)
    if (next !== value) {
      Haptics.selectionAsync().catch(() => {})
      onChange(next)
    }
  }

  const thumbStyle = useAnimatedStyle(() => ({
    left: progress.value * trackWidth - THUMB_BOX / 2,
  }))
  const fillStyle = useAnimatedStyle(() => ({
    width: progress.value * trackWidth,
  }))
  const numberStyle = useAnimatedStyle(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { transform: [{ scale: numberPulse.value * (1 + b * 0.012) }] }
  })

  // Thumb-orb: single bloom with RadialGradient (no concentric
  // ring artefacts) + small white-hot core. No 4-point cross — the
  // track already tells the user it's a slider; adding a + makes
  // the thumb read as a crosshair next to the calibration body.
  const bloomProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { r: STAR_R * 2.4 + b * 1.2, opacity: 0.7 + b * 0.2 }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const b = 0.5 + 0.5 * Math.sin(breath.value * 2 * Math.PI)
    return { r: STAR_R * (0.9 + b * 0.1) }
  })

  return (
    <View style={styles.wrap}>
      {/* Hero number with cream halo + scale-pulse on change. */}
      <View style={styles.valueRow}>
        <Animated.Text style={[styles.value, numberStyle]} accessibilityLiveRegion="polite">
          {value}
        </Animated.Text>
        <Text style={styles.unit}>cm</Text>
      </View>

      <View
        style={styles.trackHit}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => handleTouch(e.nativeEvent.locationX)}
        onResponderMove={(e) => handleTouch(e.nativeEvent.locationX)}
        accessibilityRole="adjustable"
        accessibilityValue={{ min, max, now: value }}
      >
        <View style={styles.track} />
        {/* Track-fill: gradient from faint magenta → saturated, so
            the filled portion reads as warming up. */}
        <Animated.View style={[styles.trackFillWrap, fillStyle]}>
          <LinearGradient
            colors={['rgba(217,39,102,0.45)', colors.magenta]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.trackFillGradient}
          />
        </Animated.View>

        {/* Thumb-orb — single bloom + core. No cross (the track is the
            slider affordance; the orb only marks position). */}
        <Animated.View style={[styles.thumbWrap, thumbStyle]} pointerEvents="none">
          <Svg width={THUMB_BOX} height={THUMB_BOX}>
            <Defs>
              <RadialGradient id="thumb-bloom" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.85} />
                <Stop offset="55%" stopColor={colors.magenta} stopOpacity={0.3} />
                <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="thumb-core" cx="50%" cy="50%" r="60%">
                <Stop offset="0%" stopColor="#FFFFFF" />
                <Stop offset="50%" stopColor="#FBD7E3" />
                <Stop offset="100%" stopColor={colors.magenta} />
              </RadialGradient>
            </Defs>
            <AnimatedCircle
              cx={THUMB_BOX / 2}
              cy={THUMB_BOX / 2}
              fill="url(#thumb-bloom)"
              animatedProps={bloomProps}
            />
            <AnimatedCircle
              cx={THUMB_BOX / 2}
              cy={THUMB_BOX / 2}
              fill="url(#thumb-core)"
              animatedProps={coreProps}
            />
            <Circle cx={THUMB_BOX / 2} cy={THUMB_BOX / 2} r={STAR_R * 0.35} fill="#FFFFFF" />
          </Svg>
        </Animated.View>
      </View>

      <View style={styles.ticks}>
        <Text style={styles.tick}>{min}</Text>
        <Text style={styles.tick}>{max}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'stretch',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 26,
  },
  value: {
    fontFamily: typography.displayHeavy,
    fontSize: 58,
    lineHeight: 60,
    color: colors.leche,
    letterSpacing: -2,
    includeFontPadding: false,
    // Cream halo against the dark backdrop — depth without bloom
    // that competes with the magenta thumb.
    textShadowColor: 'rgba(252, 246, 235, 0.20)',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  unit: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 20,
    color: colors.magenta,
  },
  trackHit: {
    height: 44,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  trackFillWrap: {
    position: 'absolute',
    left: 0,
    height: TRACK_HEIGHT,
    top: (44 - TRACK_HEIGHT) / 2,
    overflow: 'hidden',
    borderRadius: TRACK_HEIGHT / 2,
  },
  trackFillGradient: {
    flex: 1,
    height: TRACK_HEIGHT,
  },
  thumbWrap: {
    position: 'absolute',
    top: (44 - THUMB_BOX) / 2,
    width: THUMB_BOX,
    height: THUMB_BOX,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  tick: {
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.niebla,
  },
})
