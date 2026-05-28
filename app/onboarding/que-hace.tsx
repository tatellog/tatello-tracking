import { useRouter } from 'expo-router'
import { useEffect, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg'

import { PrimaryCta } from '@/components/PrimaryCta'
import { ProgressBar, WizardBackdrop } from '@/features/onboarding/components'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedLine = Animated.createAnimatedComponent(Line)

/*
 * Step 2 — what Stelar does. Three labelled mini-previews of the
 * three real surfaces the user will see in the app:
 *
 *   DÍA    — a sunrise from space: a small luminous body just
 *             above the planet's horizon with a vertical light beam.
 *   SEMANA — 2 spiral arms (a thumbnail of WeekConstellation).
 *   MES    — a black void + photon ring (a thumbnail of MonthSky).
 *
 * The thumbnails are big enough to be recognisable (90 × 90), each
 * with its own gentle animation so the screen reads as alive. The
 * three previews are connected by a dashed line that magenta dots
 * flow along — same vocabulary as the manifesto's North Star.
 *
 * Psychology: showing the actual visuals up-front primes the user
 * for what they'll see. The wizard becomes less "fill out form"
 * and more "earn this view".
 */
export default function QueHaceScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <WizardBackdrop />
      <View style={styles.progressWrap}>
        <ProgressBar current={2} total={12} />
      </View>

      <View style={styles.stage}>
        <Text style={styles.eyebrow}>Lo que Stelar hace</Text>

        <Text style={styles.title}>
          No cuento calorías.{'\n'}
          <Text style={styles.titleEm}>Leo tus patrones.</Text>
        </Text>

        <Text style={styles.body}>
          Stelar lee tu día, tu semana y tu ciclo. Encuentra qué te sostiene, qué te drena y te
          ayuda a moverte a tu favor.
        </Text>

        <View style={styles.previewBlock}>
          <PreviewRow />
        </View>
      </View>

      <View style={styles.footer}>
        <PrimaryCta label="Empezar →" onPress={() => router.push('/onboarding/atribucion')} />
      </View>
    </SafeAreaView>
  )
}

/* Three mini-previews + the flowing dashed connector beneath. The
 * three previews share one orchestrated clock so the screen feels
 * coordinated rather than like three independent widgets. */
function PreviewRow() {
  const clock = useSharedValue(0)
  useEffect(() => {
    clock.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(clock)
  }, [clock])

  const W = 320
  const TILE = 90
  const labelY = TILE + 24
  const lineY = TILE + 6
  const positions = [{ x: 0 + TILE / 2 }, { x: W / 2 }, { x: W - TILE / 2 }]

  return (
    <View style={{ width: W, height: TILE + 44 }}>
      {/* Background connector — dashed magenta line with 3 flowing
          particles staggered in phase. */}
      <Svg width={W} height={lineY + 16} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Line
          x1={positions[0]!.x}
          y1={lineY}
          x2={positions[2]!.x}
          y2={lineY}
          stroke={colors.magenta}
          strokeOpacity={0.32}
          strokeWidth={1}
          strokeDasharray="2 5"
        />
        <FlowingParticle
          clock={clock}
          x0={positions[0]!.x}
          x1={positions[2]!.x}
          y={lineY}
          offset={0}
        />
        <FlowingParticle
          clock={clock}
          x0={positions[0]!.x}
          x1={positions[2]!.x}
          y={lineY}
          offset={0.33}
        />
        <FlowingParticle
          clock={clock}
          x0={positions[0]!.x}
          x1={positions[2]!.x}
          y={lineY}
          offset={0.66}
        />
      </Svg>

      {/* The 3 thumbnails — each is absolute-positioned around its
          centre so the row stays geometrically clean. Tiles are TILE
          wide; left tile aligned left, middle centred, right aligned
          right. */}
      <View style={[styles.tileWrap, { left: 0, top: 0 }]}>
        <DiaPreview size={TILE} clock={clock} />
        <Text style={[styles.tileLabel, { top: labelY }]}>DÍA</Text>
      </View>
      <View style={[styles.tileWrap, { left: W / 2 - TILE / 2, top: 0 }]}>
        <SemanaPreview size={TILE} clock={clock} />
        <Text style={[styles.tileLabel, { top: labelY }]}>SEMANA</Text>
      </View>
      <View style={[styles.tileWrap, { right: 0, top: 0 }]}>
        <MesPreview size={TILE} clock={clock} />
        <Text style={[styles.tileLabel, { top: labelY }]}>MES</Text>
      </View>
    </View>
  )
}

/* DÍA mini — a sunrise from space. A small luminous body sits just
 * above the planetary horizon (a subtle curve at ~64 % height),
 * shooting a vertical beam of light upward. Echoes the "amanecer
 * desde la órbita" reference and reads instantly as "día" — the
 * moment light arrives — without resembling an atom diagram. */
function DiaPreview({ size, clock }: { size: number; clock: SharedValue<number> }) {
  const CX = size / 2
  // Horizon curve sits at ~64 % down. The sun-body sits just above
  // it, so the beam can rise tall through the upper canvas.
  const HORIZON_Y = size * 0.64
  const SUN_Y = HORIZON_Y - 2
  // Planet curvature — wide arc that bulges downward off-screen so
  // the visible slice reads as the edge of a sphere, not a flat line.
  const planetCurve = useMemo(() => {
    const w = size
    // Two control points pulling a smooth shallow arc across the tile.
    return `M -4 ${HORIZON_Y + 4} Q ${w / 2} ${HORIZON_Y - 2} ${w + 4} ${HORIZON_Y + 4}`
  }, [size, HORIZON_Y])

  // Breath drives both the sun bloom and the beam intensity.
  const sunProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { r: 2.6 + wave * 0.7, opacity: 0.9 + wave * 0.1 }
  })
  const sunHaloProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { r: 6 + wave * 2, opacity: 0.28 + wave * 0.14 }
  })
  const beamProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { opacity: 0.55 + wave * 0.25 }
  })

  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="dia-sun" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="55%" stopColor="#FBD7E3" />
          <Stop offset="100%" stopColor={colors.magenta} />
        </RadialGradient>
        {/* Vertical beam — bright at the sun, fades to invisible at
            the top of the tile. */}
        <LinearGradient id="dia-beam" x1="50%" y1="100%" x2="50%" y2="0%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
          <Stop offset="50%" stopColor="#FBD7E3" stopOpacity={0.4} />
          <Stop offset="100%" stopColor="#FBD7E3" stopOpacity={0} />
        </LinearGradient>
        {/* Sky gradient above the horizon — warm magenta haze near
            the sun, fading to nothing at the top. */}
        <LinearGradient id="dia-sky" x1="50%" y1="100%" x2="50%" y2="0%">
          <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Warm sky haze rising from the horizon up. */}
      <Path
        d={`M 0 ${HORIZON_Y} L ${size} ${HORIZON_Y} L ${size} 0 L 0 0 Z`}
        fill="url(#dia-sky)"
        opacity={0.7}
      />

      {/* Vertical light beam — drawn behind the sun so the sun
          punches through it. Tall, fades upward. */}
      <AnimatedLine
        x1={CX}
        y1={SUN_Y}
        x2={CX}
        y2={4}
        stroke="url(#dia-beam)"
        strokeWidth={1.4}
        strokeLinecap="round"
        animatedProps={beamProps}
      />

      {/* Planet curvature — a subtle highlight on the horizon edge.
          A second stroke beneath gives it body. */}
      <Path d={planetCurve} fill="none" stroke="#3A0A1F" strokeWidth={6} strokeLinecap="round" />
      <Path
        d={planetCurve}
        fill="none"
        stroke="#F4ABC8"
        strokeOpacity={0.5}
        strokeWidth={0.8}
        strokeLinecap="round"
      />

      {/* Sun halo + sun body. */}
      <AnimatedCircle cx={CX} cy={SUN_Y} fill={colors.magenta} animatedProps={sunHaloProps} />
      <AnimatedCircle cx={CX} cy={SUN_Y} fill="url(#dia-sun)" animatedProps={sunProps} />
    </Svg>
  )
}

/* SEMANA mini — 2 spiral arms with a central nucleus. Thumbnail of
 * WeekConstellation. The arms rotate slowly as a group. */
function SemanaPreview({ size, clock }: { size: number; clock: SharedValue<number> }) {
  const CX = size / 2
  const CY = size / 2
  // Build the spiral arm path once; rotate via animated group.
  const armPath = useMemo(() => buildSpiralPath(0, CX, CY), [CX, CY])
  const armPath2 = useMemo(() => buildSpiralPath(Math.PI, CX, CY), [CX, CY])
  const spinProps = useAnimatedProps(() => {
    'worklet'
    const deg = clock.value * 360
    return {
      transform: [
        { translateX: CX },
        { translateY: CY },
        { rotate: `${deg}deg` },
        { translateX: -CX },
        { translateY: -CY },
      ],
    }
  })
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="sem-mini-core" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="50%" stopColor="#FBD7E3" />
          <Stop offset="100%" stopColor={colors.magenta} />
        </RadialGradient>
      </Defs>
      <AnimatedG animatedProps={spinProps}>
        <Path d={armPath} fill="none" stroke="#F4ABC8" strokeOpacity={0.55} strokeWidth={0.9} />
        <Path d={armPath2} fill="none" stroke="#F4ABC8" strokeOpacity={0.4} strokeWidth={0.7} />
      </AnimatedG>
      <Circle cx={CX} cy={CY} r={5} fill={colors.magenta} opacity={0.25} />
      <Circle cx={CX} cy={CY} r={2.6} fill="url(#sem-mini-core)" />
    </Svg>
  )
}

/* MES mini — small dark void + bright photon ring + 4 tiny
 * satellites around it. Thumbnail of MonthSky's BH. */
function MesPreview({ size, clock }: { size: number; clock: SharedValue<number> }) {
  const CX = size / 2
  const CY = size / 2
  const voidR = 11
  const photonR = voidR * 1.18

  const ringProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    return { r: photonR + wave * 0.8, opacity: 0.78 + wave * 0.18 }
  })

  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="mes-mini-void" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#000000" />
          <Stop offset="80%" stopColor="#000000" />
          <Stop offset="100%" stopColor="#3A0A1F" />
        </RadialGradient>
        <RadialGradient id="mes-mini-ring" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="50%" stopColor="#FBD7E3" />
          <Stop offset="100%" stopColor={colors.magenta} />
        </RadialGradient>
      </Defs>
      {/* Outer magenta haze for depth */}
      <Circle cx={CX} cy={CY} r={size * 0.42} fill={colors.magenta} opacity={0.06} />
      <Circle cx={CX} cy={CY} r={size * 0.32} fill={colors.magenta} opacity={0.1} />
      {/* 4 satellite dots floating around the disc */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * 2 * Math.PI + Math.PI / 4
        const r = size * 0.38
        return (
          <Circle
            key={i}
            cx={CX + Math.cos(a) * r}
            cy={CY + Math.sin(a) * r}
            r={1.4}
            fill="#F4ABC8"
            opacity={0.55}
          />
        )
      })}
      {/* Void */}
      <Circle cx={CX} cy={CY} r={voidR} fill="url(#mes-mini-void)" />
      {/* Photon ring — breathes */}
      <AnimatedCircle
        cx={CX}
        cy={CY}
        fill="none"
        stroke="url(#mes-mini-ring)"
        strokeWidth={1.4}
        animatedProps={ringProps}
      />
    </Svg>
  )
}

/* A particle moving along the dashed connector between previews. */
function FlowingParticle({
  clock,
  x0,
  x1,
  y,
  offset,
}: {
  clock: SharedValue<number>
  x0: number
  x1: number
  y: number
  offset: number
}) {
  const props = useAnimatedProps(() => {
    'worklet'
    const phase = (clock.value + offset) % 1
    const x = x0 + phase * (x1 - x0)
    const edgeFade = Math.min(phase, 1 - phase) * 5
    return { cx: x, cy: y, opacity: Math.min(0.9, edgeFade) }
  })
  return <AnimatedCircle animatedProps={props} r={2.2} fill="#FFFFFF" />
}

/* Build a 2-turn logarithmic spiral arm path centered on (cx, cy)
 * with an angle offset (so two arms can sit opposite each other). */
function buildSpiralPath(angleOffset: number, cx: number, cy: number): string {
  const a = 3
  const b = 0.32
  const steps = 28
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 5.5
    const r = a * Math.exp(b * t)
    const ang = t + angleOffset
    const x = cx + r * Math.cos(ang)
    const y = cy + r * Math.sin(ang)
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `
  }
  return d
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  progressWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  stage: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 10.5,
    color: colors.magenta,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  title: {
    fontFamily: typography.displayHeavy,
    fontSize: 34,
    lineHeight: 38,
    color: colors.leche,
    letterSpacing: -1.4,
  },
  titleEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 34,
    color: colors.magenta,
    letterSpacing: -1,
  },
  body: {
    marginTop: 18,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
    color: colors.bone,
    maxWidth: 320,
  },
  previewBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileWrap: {
    position: 'absolute',
    alignItems: 'center',
  },
  tileLabel: {
    position: 'absolute',
    fontFamily: typography.uiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.magenta,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
  },
})
