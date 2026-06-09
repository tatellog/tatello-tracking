import LottieView from 'lottie-react-native'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import type { CyclePhase } from '@/features/cycle/phase'
import { arcPath, dayToAngle, phaseBounds, pointOnRing } from '@/features/cycle/ring-geometry'
import { useScreenActive } from '@/features/orbit/useScreenActive'
import { colors, typography } from '@/theme'

// Created ONCE at module scope — re-creating animated components on every
// render breaks Reanimated's prop wiring.
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedPath = Animated.createAnimatedComponent(Path)

const SIZE = 200
const C = SIZE / 2
const R = 78
// Small angular gap between base arcs (in day-units) so the four phases
// read as sectors, not one continuous aro.
const GAP = 0.18

const PHASE_ORDER: CyclePhase[] = ['menstrual', 'folicular', 'ovulatoria', 'lutea']

// Base-arc opacity per phase — a cool silver-blue family whose brightness
// rises toward the ovulatory "noon" (rendered in oro), never a saturated
// rainbow. The active phase is painted brighter on top of this.
const BASE_OPACITY: Record<CyclePhase, number> = {
  menstrual: 0.2,
  folicular: 0.16,
  ovulatoria: 0.24,
  lutea: 0.18,
}

/** Magenta only for the phases that matter to the scale (período + the
 *  week before); oro for the calm mid-cycle stretch. Keeps magenta to the
 *  manifesto's 2-accent ceiling. */
function accentFor(phase: CyclePhase): string {
  return phase === 'menstrual' || phase === 'lutea' ? colors.magenta : colors.oro
}

/*
 * The cycle as a celestial ORBITAL RING. Day 1 at the top, the "today"
 * point a moon traveling clockwise along the border, the active phase arc
 * lit and breathing on an 8 s clock (the same pulse as the constellation).
 * The day + phase label sit quiet in the negative space at the centre.
 *
 * NOT a fertility wheel: no fertile/infertile sectors, no ovulation
 * window framing, no blood-red. The phases are named by experience in the
 * label, and the colour is a cool moon palette with oro at the cenit.
 */
export function CycleRing({
  day,
  length,
  phaseKey,
  phaseLabel,
  reduce,
}: {
  day: number
  length: number
  phaseKey: CyclePhase
  phaseLabel: string
  reduce: boolean
}) {
  // Pause the ring's loops when the Progreso tab isn't focused. The clock
  // drives AnimatedCircle/AnimatedPath INSIDE the <Svg>, so every frame
  // repaints the whole 200px ring tree — and it used to run forever, even
  // off-tab. Gating on `useScreenActive()` drops the off-tab cost to zero
  // (and pauses during scroll where a ScrollPauseContext is provided).
  const active = useScreenActive()

  // One shared clock for the whole ring (8 s linear loop). Reduced motion OR
  // off-tab parks it at a pleasant mid-glow instead of repeating.
  const t = useSharedValue(0)
  useEffect(() => {
    if (reduce || !active) {
      t.value = 0.25
      return () => cancelAnimation(t)
    }
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(t)
  }, [t, reduce, active])

  const accent = accentFor(phaseKey)
  const bounds = phaseBounds(length)
  const [aStart, aEnd] = bounds[phaseKey]

  // Active-arc gradient endpoints (userSpaceOnUse), so the lit arc fades
  // leche → accent → leche along its own length, like the constellation's
  // lit connector lines.
  const gStart = pointOnRing(C, C, R, dayToAngle(aStart, length))
  const gEnd = pointOnRing(C, C, R, dayToAngle(aEnd + 1, length))

  const today = pointOnRing(C, C, R, dayToAngle(day, length))

  // Breathing halo behind the active arc — opacity only (numeric, UI-thread
  // safe). 0.10 ↔ 0.22 on the shared clock.
  const haloProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * Math.PI * 2)
    return { strokeOpacity: 0.1 + 0.12 * wave }
  })

  // The "today" moon — a soft radius + opacity pulse. r and opacity are
  // numbers, safe to animate on the UI thread.
  const moonProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * Math.PI * 2)
    return { r: 10 + 2 * wave, opacity: 0.18 + 0.12 * wave }
  })

  return (
    <View style={styles.wrap}>
      {/* Ambient Genshin glow BEHIND the ring — drifting cool dust + faint
          halo + slow gold glints. Pure decoration: pointerEvents none.
          Suppressed under reduced motion AND off-tab (`!active`): a looping
          Lottie keeps decoding frames forever otherwise; unmounting it stops
          that off-tab and it just restarts on return (imperceptible glow). */}
      {reduce || !active ? null : (
        <View style={styles.glow} pointerEvents="none">
          <LottieView
            source={require('../../../assets/lottie/cycle-ring-glow.json')}
            autoPlay
            loop
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
        </View>
      )}
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <LinearGradient
            id="cycleActiveArc"
            gradientUnits="userSpaceOnUse"
            x1={gStart.x}
            y1={gStart.y}
            x2={gEnd.x}
            y2={gEnd.y}
          >
            <Stop offset="0" stopColor={colors.oroLeche} stopOpacity={0.9} />
            <Stop offset="0.5" stopColor={accent} stopOpacity={0.55} />
            <Stop offset="1" stopColor={colors.oroLeche} stopOpacity={0.9} />
          </LinearGradient>
        </Defs>

        {/* 1 · Ambient cool wash — concentric faint rings (layered strokes,
            not a RadialGradient: alpha gradients render unreliably on iOS). */}
        <Circle
          cx={C}
          cy={C}
          r={R + 14}
          stroke={colors.dimension.ciclo}
          strokeWidth={1}
          strokeOpacity={0.04}
          fill="none"
        />
        <Circle
          cx={C}
          cy={C}
          r={R + 6}
          stroke={colors.dimension.ciclo}
          strokeWidth={1}
          strokeOpacity={0.06}
          fill="none"
        />

        {/* 2 · Four base phase arcs — cool family, oro at the cenit. */}
        {PHASE_ORDER.map((k) => {
          const [s, e] = bounds[k]
          return (
            <Path
              key={k}
              d={arcPath(C, C, R, s + GAP, e + 1 - GAP, length)}
              stroke={k === 'ovulatoria' ? colors.oro : colors.dimension.ciclo}
              strokeWidth={1.5}
              strokeOpacity={BASE_OPACITY[k]}
              strokeLinecap="round"
              fill="none"
            />
          )
        })}

        {/* 3a · Breathing halo behind the active phase arc. */}
        <AnimatedPath
          d={arcPath(C, C, R, aStart, aEnd + 1, length)}
          stroke={accent}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          animatedProps={haloProps}
        />
        {/* 3b · The lit active arc — leche↔accent gradient. */}
        <Path
          d={arcPath(C, C, R, aStart, aEnd + 1, length)}
          stroke="url(#cycleActiveArc)"
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />

        {/* 4 · The "today" moon — bloom + body + white core. */}
        <AnimatedCircle cx={today.x} cy={today.y} fill={accent} animatedProps={moonProps} />
        <Circle cx={today.x} cy={today.y} r={4.5} fill={colors.leche} />
        <Circle cx={today.x} cy={today.y} r={1.8} fill="#FFFFFF" />
      </Svg>

      {/* Centre — day + phase label in the ring's negative space. */}
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.dayNum}>Día {day}</Text>
        <Text style={styles.phaseLabel}>{phaseLabel}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontFamily: typography.displayHeavy,
    fontSize: 30,
    color: colors.leche,
    letterSpacing: -0.8,
  },
  phaseLabel: {
    marginTop: 2,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    color: colors.bone,
    letterSpacing: -0.2,
  },
})
