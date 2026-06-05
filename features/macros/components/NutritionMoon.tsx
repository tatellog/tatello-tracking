import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import Svg, { Defs, Image as SvgImage, RadialGradient, Stop, Path } from 'react-native-svg'

import { moonIllumination, moonPhase } from '../moonPhase'
import { colors, typography } from '@/theme'

const MOON_PNG = require('@/assets/meals/moon.png')

const AnimatedPath = Animated.createAnimatedComponent(Path)

// Moon geometry in the 100×100 viewBox. The cropped asset centres the
// disc at (50,50); the shadow circle is a hair larger than the visible
// moon so its terminator always sweeps fully across the disc. Shadow
// painted in card bg → invisible where it spills onto the PNG's
// transparent corners, a crescent only where it overlaps the moon.
const CX = 50
const CY = 50
const R = 30
const SEG = 32
const SIZE = 104
const FILL_EASE = Easing.bezier(0.2, 0.7, 0.2, 1)

// 1-decimal rounding — cheaper than toFixed and plenty for a 100-unit
// viewBox. Used both at module scope and (inlined) in the worklet.
const r1 = (n: number) => Math.round(n * 10) / 10

// The shadow's LEFT outline (top→bottom) never moves — it's the moon's
// own left rim. Precompute it ONCE so the per-frame worklet only rebuilds
// the terminator, halving its work (see reanimated audit).
const LEFT_OUTLINE = (() => {
  let d = ''
  for (let i = 0; i <= SEG; i++) {
    const phi = Math.PI / 2 - Math.PI * (i / SEG)
    const x = CX - R * Math.cos(phi)
    const y = CY - R * Math.sin(phi)
    d += i === 0 ? `M${r1(x)} ${r1(y)}` : `L${r1(x)} ${r1(y)}`
  }
  return d
})()

type Props = {
  proteinValue: number
  /** Optional reference. When absent the moon is ambient (no %, no bar). */
  proteinTarget?: number
  caloriesValue: number
}

/*
 * Tu Cielo Nutricional — the day's protein as a growing moon.
 *
 * The moon (moon.png) is the hero; light grows from the right as protein
 * climbs, painted by an animated shadow mask (a 48-point terminator
 * polygon over a circle, so the crescent is geometrically real without
 * fighting SVG arc-flag ambiguity). A faint bar + "84 / 112 g" sit beside
 * it as a soft reference — never a countdown.
 *
 * Manifesto stance (vs the old DaySky, which refused any bar/%): the
 * moon reframes protein as NOURISHMENT/GROWTH, not deficit. Reaching or
 * passing the reference is a full moon — celebrated, never "te pasaste".
 * With no reference set the moon goes ambient ("X g registrados"), and
 * the optional-target banner below invites a soft reference.
 */
export function NutritionMoon({ proteinValue, proteinTarget, caloriesValue }: Props) {
  const reduced = useReducedMotion() ?? false
  const reference = proteinTarget != null && proteinTarget > 0 ? Math.round(proteinTarget) : null
  const illumination = moonIllumination(proteinValue, reference)
  const ambient = illumination == null
  const phase = ambient ? null : moonPhase(illumination)

  // k drives both the moon mask and the bar. Clamped to [0,1] — past
  // full is still a full moon, never an overflow.
  const target = Math.min(1, illumination ?? 1)
  const k = useSharedValue(0)
  useEffect(() => {
    if (reduced) k.value = target
    else k.value = withTiming(target, { duration: 1000, easing: FILL_EASE })
    return () => cancelAnimation(k)
  }, [k, target, reduced])

  // The unlit region: the static left rim + the terminator swept by k.
  // Only the terminator is rebuilt each frame (the rim is precomputed).
  const shadowProps = useAnimatedProps(() => {
    'worklet'
    const cosK = Math.cos(Math.PI * k.value)
    let d = LEFT_OUTLINE
    // Terminator, bottom → top (φ: −π/2 → +π/2).
    for (let i = 0; i <= SEG; i++) {
      const phi = -Math.PI / 2 + Math.PI * (i / SEG)
      const x = CX + R * Math.cos(phi) * cosK
      const y = CY - R * Math.sin(phi)
      d += `L${Math.round(x * 10) / 10} ${Math.round(y * 10) / 10}`
    }
    return { d: `${d}Z` }
  })

  const barStyle = useAnimatedStyle(() => ({ width: `${k.value * 100}%` }))

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.left}>
          <Text style={styles.eyebrow}>Tu cielo nutricional</Text>
          <View style={styles.spacer} />

          <View style={styles.readout}>
            <Text style={styles.value}>{Math.round(proteinValue)}</Text>
            {reference != null ? (
              <Text style={styles.reference}> / {reference} g</Text>
            ) : (
              <Text style={styles.reference}> g registrados</Text>
            )}
          </View>
          <Text style={styles.caption}>proteína</Text>

          {reference != null ? (
            <View style={styles.barTrack}>
              <Animated.View style={[styles.barFill, barStyle]} />
            </View>
          ) : null}

          <Text style={styles.coach}>
            {ambient ? 'Tu luna de hoy se va dibujando.' : phase!.caption}
          </Text>
        </View>

        <View style={styles.moonWrap}>
          {/* Soft warm glow behind the moon. */}
          <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={colors.magenta} stopOpacity={ambient ? 0.18 : 0.32} />
                <Stop offset="60%" stopColor={colors.magenta} stopOpacity={0.08} />
                <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Path d="M0 0 H100 V100 H0 Z" fill="url(#moonGlow)" />
          </Svg>

          <Svg width={SIZE} height={SIZE} viewBox="0 0 100 100">
            <SvgImage
              href={MOON_PNG}
              x={0}
              y={0}
              width={100}
              height={100}
              preserveAspectRatio="xMidYMid meet"
              opacity={ambient ? 0.9 : 1}
            />
            {/* Phase shadow — only when there's a reference to grow toward.
                Painted in card bg so it reads as a crescent on the moon and
                vanishes over the transparent corners. */}
            {ambient ? null : (
              <AnimatedPath animatedProps={shadowProps} fill={colors.bgCard} opacity={0.92} />
            )}
          </Svg>
        </View>
      </View>

      {/* Calories — a plain neutral fact below the hero. No target, no
          bar, no verdict: just what the day held. */}
      <View style={styles.calRow}>
        <Text style={styles.calLabel}>Calorías</Text>
        <Text style={styles.calValue}>{Math.round(caloriesValue)} kcal</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 132,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 16,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  left: {
    flex: 1,
    paddingRight: 8,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.magenta,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  spacer: {
    height: 14,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontFamily: typography.displayHeavy,
    fontSize: 40,
    color: colors.leche,
    letterSpacing: -1.4,
    lineHeight: 42,
  },
  reference: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.heading,
    color: colors.bone,
  },
  caption: {
    fontFamily: typography.uiSemi,
    fontSize: 9.5,
    color: colors.niebla,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  barTrack: {
    marginTop: 12,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.hairline,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.magenta,
  },
  coach: {
    marginTop: 10,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 17,
    color: colors.bone,
  },
  moonWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 14,
  },
  calLabel: {
    fontFamily: typography.uiBold,
    fontSize: 9.5,
    color: colors.niebla,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  calValue: {
    fontFamily: typography.uiSemi,
    fontSize: 12.5,
    color: colors.bone,
  },
})
