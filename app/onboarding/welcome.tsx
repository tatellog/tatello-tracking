import { useRouter } from 'expo-router'
import { useEffect } from 'react'
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
import Svg, { Circle, Defs, G, Line, LinearGradient, RadialGradient, Stop } from 'react-native-svg'

import { PrimaryCta } from '@/components/PrimaryCta'
import { ProgressBar, WizardBackdrop } from '@/features/onboarding/components'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)
const AnimatedG = Animated.createAnimatedComponent(G)

/*
 * Step 1 — Manifesto. The visual hero is a North Star: a single
 * luminous body with a long upward spike (the literal "dirección"
 * the manifesto names). Centred on the canvas, it gives the quote
 * an anchor instead of leaving the lower 60 % of the screen empty.
 *
 * The star breathes on a 5 s cycle, plus 4 satellite points orbit
 * it slowly — so the manifesto doesn't read as a static poster,
 * it reads as something alive that the user is being introduced to.
 */
export default function ManifiestoScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <WizardBackdrop />
      <View style={styles.progressWrap}>
        <ProgressBar current={1} total={12} />
      </View>

      <View style={styles.stage}>
        <Text style={styles.eyebrow}>Stelar · tu manifiesto</Text>
        <Text style={styles.quote}>La perfección{'\n'}no es necesaria.</Text>
        <Text style={styles.quoteEmphasis}>La dirección sí.</Text>

        <View style={styles.heroWrap}>
          <NorthStar />
        </View>

        <Text style={styles.meta}>
          Stelar te lee patrones, no perfección.{'\n'}
          <Text style={styles.metaStrong}>En 28 días</Text> ves tus primeros patrones confirmados.
        </Text>
      </View>

      <View style={styles.footer}>
        <PrimaryCta label="Continuar →" onPress={() => router.push('/onboarding/que-hace')} />
      </View>
    </SafeAreaView>
  )
}

/* The North Star — a cinematic luminous body rather than a vector
 * diagram. Five layers compose the body:
 *
 *   1. Atmospheric bloom — 5 concentric halos with smooth opacity
 *      falloff so the glow reads like light through dust, not
 *      stacked circles.
 *   2. Radial rays — 22 fine lines emanating at varied angles and
 *      lengths, very low opacity. Creates the "explosive starburst"
 *      effect of a real long-exposure photo.
 *   3. 8-point diffraction cross — 4 cardinal spikes (the upward
 *      one significantly longer = "norte") + 4 diagonal spikes,
 *      each drawn with a gradient that fades to transparent at the
 *      tip so the spikes feel like emitted light, not vector lines.
 *   4. Lens-flare artefacts — 2 small offset dots along the
 *      vertical axis, like camera halos. Sells the "this was
 *      photographed" feeling.
 *   5. The luminous core — white-hot centre + bright highlight,
 *      both pulsing with the breath cycle.
 *
 * Plus 3 satellite stars orbiting on slow elliptical paths. */
function NorthStar() {
  const W = 260
  const H = 300
  const CX = W / 2
  const CY = H * 0.6 // sit the core slightly below mid so the up-spike has room
  const CORE_R = 18
  const SPIKE_UP_LEN = CY - 6
  const SPIKE_DOWN_LEN = 50
  const SPIKE_H_LEN = 86
  const SPIKE_DIAG_LEN = 40

  // 5 s breath drives bloom + spike intensity.
  const t = useSharedValue(0)
  // 22 s slow rotation drives the satellite orbits.
  const orbit = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
    orbit.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(orbit)
    }
  }, [t, orbit])

  // 5-layer atmospheric bloom — smooth opacity ramp.
  const halo5 = useAnimatedProps(() => {
    'worklet'
    const w = t.value
    return { r: CORE_R * 7 + w * 8, opacity: 0.02 + w * 0.025 }
  })
  const halo4 = useAnimatedProps(() => {
    'worklet'
    const w = t.value
    return { r: CORE_R * 5 + w * 6, opacity: 0.05 + w * 0.05 }
  })
  const halo3 = useAnimatedProps(() => {
    'worklet'
    const w = t.value
    return { r: CORE_R * 3.4 + w * 4, opacity: 0.1 + w * 0.08 }
  })
  const halo2 = useAnimatedProps(() => {
    'worklet'
    const w = t.value
    return { r: CORE_R * 2.1 + w * 2.4, opacity: 0.18 + w * 0.12 }
  })
  const halo1 = useAnimatedProps(() => {
    'worklet'
    const w = t.value
    return { r: CORE_R * 1.35 + w * 1.4, opacity: 0.28 + w * 0.15 }
  })

  // Core highlight — bright tiny white centre.
  const coreHighlight = useAnimatedProps(() => {
    'worklet'
    const w = t.value
    return { r: CORE_R * 0.4 + w * 1.1, opacity: 0.88 + w * 0.12 }
  })

  // Spike opacities — all ride the breath but at different amplitudes
  // so the upward "norte" spike is always the loudest.
  const upSpikeOpacity = useAnimatedProps(() => {
    'worklet'
    return { opacity: 0.85 + t.value * 0.15 }
  })
  const cardinalSpikeOpacity = useAnimatedProps(() => {
    'worklet'
    return { opacity: 0.45 + t.value * 0.2 }
  })
  const diagSpikeOpacity = useAnimatedProps(() => {
    'worklet'
    return { opacity: 0.22 + t.value * 0.12 }
  })
  const raysOpacity = useAnimatedProps(() => {
    'worklet'
    return { opacity: 0.55 + t.value * 0.25 }
  })

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <RadialGradient id="ns-core" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="38%" stopColor="#FBD7E3" />
          <Stop offset="100%" stopColor="#9A2150" />
        </RadialGradient>
        {/* Spike gradients — bright at the core, fade to transparent
            at the tip so the lines read as light leaks, not lines. */}
        <LinearGradient id="ns-spike-up" x1="50%" y1="100%" x2="50%" y2="0%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="50%" stopColor="#FBD7E3" stopOpacity={0.55} />
          <Stop offset="100%" stopColor="#FBD7E3" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="ns-spike-down" x1="50%" y1="0%" x2="50%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="60%" stopColor="#FBD7E3" stopOpacity={0.45} />
          <Stop offset="100%" stopColor="#FBD7E3" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="ns-spike-h" x1="0%" y1="50%" x2="100%" y2="50%">
          <Stop offset="0%" stopColor="#FBD7E3" stopOpacity={0} />
          <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={1} />
          <Stop offset="100%" stopColor="#FBD7E3" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* 3 satellite stars orbiting on slow ellipses. Render first so
          they sit behind the bloom. */}
      <OrbitDot orbit={orbit} cx={CX} cy={CY} radius={88} angleBase={0.3} sizeBase={2} />
      <OrbitDot
        orbit={orbit}
        cx={CX}
        cy={CY}
        radius={100}
        angleBase={Math.PI * 0.85}
        sizeBase={1.4}
      />
      <OrbitDot
        orbit={orbit}
        cx={CX}
        cy={CY}
        radius={84}
        angleBase={Math.PI * 1.4}
        sizeBase={1.8}
      />

      {/* 22 radial rays — varied angles and lengths so the eye reads
          "explosive light" instead of "ruler-drawn lines". Generated
          deterministically; the field is the same every render. */}
      <AnimatedG animatedProps={raysOpacity}>
        {RAYS.map((ray, i) => (
          <Line
            key={`ray-${i}`}
            x1={CX}
            y1={CY}
            x2={CX + Math.cos(ray.angle) * ray.length}
            y2={CY + Math.sin(ray.angle) * ray.length}
            stroke="#FBD7E3"
            strokeWidth={ray.width}
            strokeOpacity={ray.opacity}
            strokeLinecap="round"
          />
        ))}
      </AnimatedG>

      {/* 5-layer atmospheric bloom. */}
      <AnimatedCircle cx={CX} cy={CY} fill={colors.magenta} animatedProps={halo5} />
      <AnimatedCircle cx={CX} cy={CY} fill={colors.magenta} animatedProps={halo4} />
      <AnimatedCircle cx={CX} cy={CY} fill={colors.magenta} animatedProps={halo3} />
      <AnimatedCircle cx={CX} cy={CY} fill={colors.magenta} animatedProps={halo2} />
      <AnimatedCircle cx={CX} cy={CY} fill={colors.magenta} animatedProps={halo1} />

      {/* 4 diagonal spikes — 45°/135°/225°/315°, shorter than the
          cardinal cross, low opacity so they recede. */}
      <AnimatedG animatedProps={diagSpikeOpacity}>
        {[45, 135, 225, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180
          return (
            <Line
              key={`diag-${deg}`}
              x1={CX}
              y1={CY}
              x2={CX + Math.cos(rad) * SPIKE_DIAG_LEN}
              y2={CY + Math.sin(rad) * SPIKE_DIAG_LEN}
              stroke="#FFFFFF"
              strokeWidth={0.8}
              strokeLinecap="round"
            />
          )
        })}
      </AnimatedG>

      {/* Horizontal spike — symmetric, gradient at both ends. */}
      <AnimatedLine
        x1={CX - SPIKE_H_LEN}
        y1={CY}
        x2={CX + SPIKE_H_LEN}
        y2={CY}
        stroke="url(#ns-spike-h)"
        strokeWidth={1.2}
        strokeLinecap="round"
        animatedProps={cardinalSpikeOpacity}
      />

      {/* Downward spike — shorter than up, gradient fades to top. */}
      <AnimatedLine
        x1={CX}
        y1={CY}
        x2={CX}
        y2={CY + SPIKE_DOWN_LEN}
        stroke="url(#ns-spike-down)"
        strokeWidth={1.1}
        strokeLinecap="round"
        animatedProps={cardinalSpikeOpacity}
      />

      {/* Upward spike — the "norte". Longest, brightest, with a
          gradient that fades to transparent at the very top so the
          line dissolves into the cosmos. */}
      <AnimatedLine
        x1={CX}
        y1={CY - SPIKE_UP_LEN}
        x2={CX}
        y2={CY}
        stroke="url(#ns-spike-up)"
        strokeWidth={1.6}
        strokeLinecap="round"
        animatedProps={upSpikeOpacity}
      />

      {/* The luminous core. */}
      <Circle cx={CX} cy={CY} r={CORE_R} fill="url(#ns-core)" />
      <AnimatedCircle cx={CX} cy={CY} fill="#FFFFFF" animatedProps={coreHighlight} />

      {/* Lens flare artefacts — 2 small offset dots along the
          upward axis. Tiny cosmic camera halos that sell the photo
          aesthetic. */}
      <Circle cx={CX} cy={CY - SPIKE_UP_LEN * 0.35} r={1.6} fill="#FBD7E3" opacity={0.7} />
      <Circle cx={CX} cy={CY - SPIKE_UP_LEN * 0.65} r={1.1} fill="#F4ABC8" opacity={0.45} />
    </Svg>
  )
}

/* Deterministic ray spec: 22 light rays at evenly-spaced angles
 * with subtle variation in length, width, opacity so the starburst
 * doesn't read as ruler-drawn. */
type Ray = { angle: number; length: number; width: number; opacity: number }
const RAYS: readonly Ray[] = (() => {
  const out: Ray[] = []
  const N = 22
  const rand = (i: number) => {
    const v = Math.sin(i * 9301 + 49297) * 233280
    return v - Math.floor(v)
  }
  for (let i = 0; i < N; i++) {
    const baseAngle = (i / N) * 2 * Math.PI
    const angle = baseAngle + (rand(i + 1) - 0.5) * 0.08
    // Length varies dramatically — some rays short, some long, so
    // the eye reads organic starlight, not a sun-icon.
    const len = 30 + rand(i + 100) * 80
    const width = 0.4 + rand(i + 200) * 0.5
    const opacity = 0.08 + rand(i + 300) * 0.22
    out.push({ angle, length: len, width, opacity })
  }
  return out
})()

/* One small satellite star orbiting the core. Uses two animated
 * shared values: position around the orbit + a slight breath so
 * each satellite twinkles independently. */
function OrbitDot({
  orbit,
  cx,
  cy,
  radius,
  angleBase,
  sizeBase,
}: {
  orbit: SharedValue<number>
  cx: number
  cy: number
  radius: number
  angleBase: number
  sizeBase: number
}) {
  const props = useAnimatedProps(() => {
    'worklet'
    const a = angleBase + orbit.value * 2 * Math.PI
    const x = cx + Math.cos(a) * radius
    const y = cy + Math.sin(a) * radius * 0.6 // squash vertically so orbits feel like ellipses
    // Twinkle: opacity rides the position so each dot peaks at
    // different points in its orbit.
    const w = 0.5 + 0.5 * Math.sin(a * 2)
    return { cx: x, cy: y, r: sizeBase * (0.8 + w * 0.4), opacity: 0.4 + w * 0.45 }
  })
  return <AnimatedCircle animatedProps={props} fill="#FBD7E3" />
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
  quote: {
    fontFamily: typography.displayHeavy,
    fontSize: 38,
    lineHeight: 40,
    color: colors.leche,
    letterSpacing: -1.6,
  },
  quoteEmphasis: {
    marginTop: 6,
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 34,
    color: colors.magenta,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  meta: {
    fontFamily: typography.uiMedium,
    fontSize: 13,
    lineHeight: 20,
    color: colors.bone,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  metaStrong: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 14.5,
    color: colors.magenta,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
  },
})
