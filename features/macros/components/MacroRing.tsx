import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { colors, duration, easing, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type RingColor = 'protein' | 'calories'

type Props = {
  current: number
  target: number
  label: string
  unit: string
  color: RingColor
  size?: number
  delayMs?: number
  accessibilityLabel?: string
}

const STROKE_WIDTH = 10

const RING_COLORS: Record<RingColor, string> = {
  protein: colors.inkPrimary,
  calories: colors.mauveDeep,
}

const OVER_COLORS: Record<RingColor, string> = {
  // Pearl Mauve is bichromatic — both 'over' states resolve to mauve
  // so the ring keeps reading inside the system instead of reaching
  // for a contrasting alarm hue.
  protein: colors.mauveDeep,
  calories: colors.mauveDeep,
}

/*
 * Animated circular progress ring. Renders the stroke with
 * strokeDashoffset driven by a shared value on the UI thread:
 *
 *   empty state: dashoffset = circumference (stroke invisible)
 *   filled to p: dashoffset = circumference * (1 - clamp(p, 0, 1))
 *
 * When `current` changes post-mount (user logged a meal), the hook
 * cancels any in-flight animation and re-drives from the current
 * position to the new target, so rapid updates don't stack and the
 * ring always lands on truth.
 *
 * The Svg is rotated -90° so the fill starts at 12 o'clock — the
 * natural 'start' point readers expect.
 */
export function MacroRing({
  current,
  target,
  label,
  unit,
  color,
  size = 140,
  delayMs = 0,
  accessibilityLabel,
}: Props) {
  const radius = (size - STROKE_WIDTH) / 2
  const circumference = 2 * Math.PI * radius

  const hasTarget = target > 0

  const dashOffset = useSharedValue(circumference)

  useEffect(() => {
    if (!hasTarget) return
    const pct = current / target
    const clamped = Math.max(0, Math.min(1, pct))
    const nextOffset = circumference * (1 - clamped)
    cancelAnimation(dashOffset)
    dashOffset.value = withDelay(
      delayMs,
      withTiming(nextOffset, { duration: duration.slow * 3, easing: easing.out }),
    )
  }, [current, target, hasTarget, circumference, delayMs, dashOffset])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }))

  // Defensive: a target of 0 or less shouldn't happen (the DB CHECK
  // enforces > 0), but if bad data slips through we render a muted
  // placeholder instead of misleading math (div-by-zero → empty
  // ring + "+N over" indicator pretending the user blew past an
  // undefined goal).
  if (!hasTarget) {
    return (
      <View
        style={{ width: size, height: size }}
        accessibilityLabel={accessibilityLabel ?? `${label} sin meta`}
      >
        <Svg width={size} height={size} style={styles.svg}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.pearlMuted}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
        </Svg>
        <View style={styles.centerWrap} pointerEvents="none">
          <Text style={styles.number}>—</Text>
          <Text style={styles.label}>{label.toUpperCase()}</Text>
        </View>
      </View>
    )
  }

  const over = Math.max(0, Math.round(current - target))
  const ringColor = over > 0 ? OVER_COLORS[color] : RING_COLORS[color]

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={
        accessibilityLabel ?? `${label} ${Math.round(current)} de ${target} ${unit}`
      }
    >
      <Svg width={size} height={size} style={styles.svg}>
        {/* Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.pearlMuted}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
        />
      </Svg>

      <View style={styles.centerWrap} pointerEvents="none">
        <View style={styles.numberRow}>
          <Text style={styles.number}>{Math.round(current)}</Text>
          {over > 0 && <Text style={[styles.over, { color: ringColor }]}>+{over}</Text>}
        </View>
        <Text style={styles.target}>
          / {target} {unit}
        </Text>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  svg: {
    transform: [{ rotate: '-90deg' }],
  },
  centerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  number: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.macroNum,
    fontWeight: typography.fontWeight.regular,
    color: colors.inkPrimary,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  over: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.body,
    fontWeight: typography.fontWeight.regular,
  },
  target: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.labelMuted,
    marginTop: 2,
  },
  label: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.labelDim,
    marginTop: 6,
  },
})
