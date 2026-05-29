import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Shared full-screen atmosphere for the onboarding wizard. Extracted
 * from welcome.tsx (step 1) so steps 1 and 2 breathe with the same
 * sky — same cool edge wash, same vertical density, same off-centre
 * warm glow — and only the glow's centre/radius moves to give each
 * step its own composition.
 *
 * Three static layers, all whisper-low (alphas 0.03–0.12), all
 * resolving to transparent so the bg shows through. Static on purpose:
 * the motion lives in each step's foreground field so this never
 * competes with it. pointerEvents none.
 *
 *   S0. Cool edge wash — diagonal índigo (sueno) → silver-blue (ciclo),
 *       the cold stratum that recedes (aerial perspective).
 *   S1. Vertical density — lightens the ceiling, sinks the floor into
 *       near-bg so the canvas reads top→bottom.
 *   S2. Off-centre warm glow — the "sun outside the frame". Position
 *       and radius are the `glow` prop; default reproduces step 1
 *       exactly (38% / 42% / 65%).
 *
 * The glow is rendered with an SVG RadialGradient (true falloff to
 * transparent). The id is derived from the glow coordinates so two
 * mounts on the same screen can never collide on a shared gradient id.
 */

type Glow = { cx: string; cy: string; r: string }

const DEFAULT_GLOW: Glow = { cx: '38%', cy: '42%', r: '65%' }

export function AtmosphericSky({ glow = DEFAULT_GLOW }: { glow?: Glow }) {
  // Per-instance gradient id so a second AtmosphericSky on the same
  // screen (different glow) never shares S2's def with the first.
  const gid = `skyGlow-${glow.cx}-${glow.cy}-${glow.r}`.replace(/[^a-zA-Z0-9-]/g, '')
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* S0. Cool edge wash — índigo → transparent → silver-blue. */}
      <LinearGradient
        colors={['rgba(124,143,255,0.06)', 'rgba(124,143,255,0)', 'rgba(181,196,221,0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* S1. Vertical density — sinks the floor into near-bg shadow. */}
      <LinearGradient
        colors={['rgba(10,6,8,0)', 'rgba(10,6,8,0)', 'rgba(8,4,6,0.6)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* S2. Off-centre warm glow — the "sun outside the frame". */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={gid} cx={glow.cx} cy={glow.cy} r={glow.r}>
            <Stop offset="0" stopColor={colors.magentaHot} stopOpacity="0.10" />
            <Stop offset="0.5" stopColor={colors.magentaDeep} stopOpacity="0.04" />
            <Stop offset="1" stopColor={colors.magentaDeep} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={glow.cx} cy={glow.cy} r={glow.r} fill={`url(#${gid})`} />
      </Svg>
    </View>
  )
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/*
 * Cosmic dust mote — suspended light rising bottom→top with sway, used
 * by both onboarding steps. The rising kinematics (position + fade
 * curve) are computed ONCE in a derived value; the soft halo and the
 * inner core only differ in their final opacity factor, so two
 * AnimatedCircles share one worklet of math (×N motes → N worklets).
 *
 * `stage` is the canvas height the mote travels (defaults to a 320
 * square = step 1). `clock` is a shared 0→1 ramp (the step's dust
 * clock); the mote derives its own phase from it.
 */
export function DustMote({
  x,
  baseR,
  period,
  sway,
  opacity,
  phase,
  clock,
  stage = 320,
  fill = '#F8DBCE',
}: {
  x: number
  baseR: number
  period: number
  sway: number
  opacity: number
  phase: number
  clock: SharedValue<number>
  stage?: number
  fill?: string
}) {
  const baseX = x * stage
  const motion = useDerivedValue(() => {
    'worklet'
    const u = (clock.value / period + phase) % 1
    const y = stage + 10 - u * (stage + 20)
    const cx = baseX + Math.sin(u * Math.PI * 2) * sway
    let op = opacity
    if (u < 0.12) op *= u / 0.12
    else if (u > 0.88) op *= 1 - (u - 0.88) / 0.12
    return { cx, cy: y, op }
  })
  const haloProps = useAnimatedProps(() => {
    'worklet'
    return { cx: motion.value.cx, cy: motion.value.cy, opacity: motion.value.op * 0.3 }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    return { cx: motion.value.cx, cy: motion.value.cy, opacity: motion.value.op }
  })
  return (
    <>
      <AnimatedCircle cx={baseX} cy={stage} r={baseR * 3} fill={fill} animatedProps={haloProps} />
      <AnimatedCircle cx={baseX} cy={stage} r={baseR} fill={fill} animatedProps={coreProps} />
    </>
  )
}
