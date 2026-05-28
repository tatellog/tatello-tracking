import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg'

import { useBriefContext } from '@/features/brief/hooks'
import { useUpsertMacroTargets } from '@/features/macros/hooks'
import { StepHeader, WizardLayout } from '@/features/onboarding/components'
import {
  type BiologicalSex,
  type CycleSituation,
  type MonthlyFocus,
  type TrainingFrequency,
} from '@/features/profile/api'
import { calculateMacros } from '@/features/profile/calcMacros'
import { useProfile, useUpdateProfile } from '@/features/profile/hooks'
import { ZODIAC, zodiacFromDate, type ZodiacSign } from '@/features/tabs/zodiac'
import { track } from '@/lib/analytics'
import { deviceTimezone } from '@/lib/time'
import { colors, typography } from '@/theme'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedLine = Animated.createAnimatedComponent(Line)

/** Verb phrase the reveal cites in the multi-datum line. Reads like
 *  the user's own goal, not a Stelar-side categorization. */
const FOCUS_VERB: Record<MonthlyFocus, string> = {
  weight: 'quieres bajar de peso',
  energy: 'quieres más energía',
  sleep: 'quieres dormir mejor',
  food: 'quieres cambiar tu relación con la comida',
  cycle: 'quieres conocer tu ciclo',
  patterns: 'quieres entender tus patrones',
  mind: 'quieres calmar la mente',
  other: 'estás buscando algo propio',
}

/*
 * Step 12 — Reveal. The emotional peak of the wizard. Marks
 * onboarding_completed_at (RouteGuard then lets the user into
 * /(tabs)) and shows the first personalised Voz de Stelar.
 *
 * The visual is a CONSTELLATION that reveals itself one point at a
 * time. The bright central body is Stelar's reading of the user;
 * each outer star represents a datum Stelar captured (signo, ciclo,
 * cuerpo, sueño, movimiento, intención, nombre). The stars twinkle
 * in one by one over ~2 seconds, then thin constellation lines draw
 * from the centre to each satellite — Stelar weaving the picture.
 *
 * Choreography (ms from mount):
 *   0      centre star starts blooming
 *   600    first satellite twinkles in
 *  +260    each subsequent satellite (7 total)
 *   2520   constellation lines fade in
 *   3000   haptic + headline drops
 *   3500   body line drops
 *   4000   meta block drops
 *
 * The user can tap "Entrar a tu órbita" at any time — the animation
 * is purely emotional, never a gate.
 */
export default function RevealScreen() {
  const router = useRouter()
  const { data: profile } = useProfile()
  const { data: brief } = useBriefContext()
  const updateProfile = useUpdateProfile()
  const upsertMacros = useUpsertMacroTargets()
  const [advancing, setAdvancing] = useState(false)

  const firstName = useMemo(
    () => (profile?.display_name ?? '').trim().split(' ')[0] || 'tú',
    [profile?.display_name],
  )
  const focusVerb = useMemo(() => {
    const k = (profile?.monthly_focus as MonthlyFocus | null) ?? null
    return k ? FOCUS_VERB[k] : 'tu intención'
  }, [profile?.monthly_focus])

  // Signo zodiacal — derivado de date_of_birth. We need both the
  // label (for the body line) AND the sign key (to look up the
  // constellation figure for the reveal). Fallback to 'geminis' if
  // somehow date_of_birth is missing — the user almost never reaches
  // the reveal without it, but the constellation needs SOMETHING to
  // render.
  const zodiacSign: ZodiacSign = useMemo(() => {
    return profile?.date_of_birth ? zodiacFromDate(profile.date_of_birth) : 'geminis'
  }, [profile?.date_of_birth])
  const zodiacLabel = useMemo(() => {
    return profile?.date_of_birth ? ZODIAC[zodiacSign].label : null
  }, [profile?.date_of_birth, zodiacSign])

  // Star count drives the reveal-stagger duration.
  const starCount = ZODIAC[zodiacSign].stars.length

  // Estado del ciclo — solo lo cito si la usuaria menstrúa.
  const cycleActiveSituations: readonly CycleSituation[] = [
    'menstruates',
    'contraception',
    'irregular',
  ]
  const showsCycle =
    profile?.cycle_situation != null &&
    cycleActiveSituations.includes(profile.cycle_situation as CycleSituation)

  // Centre-star bloom uses the same shared-value contract as before:
  // rises 0 → 1 over 900 ms, then breathes 1 → 1.08 forever.
  const centreClock = useSharedValue(0)

  // Satellite reveal: a Set of indices that have ignited. Each one
  // mounts at its own scheduled timeout; once mounted, the satellite
  // animates its bloom via ZoomIn-equivalent shared values.
  const [satellitesLit, setSatellitesLit] = useState<readonly number[]>([])
  const [linesLit, setLinesLit] = useState(false)
  const [headlineReady, setHeadlineReady] = useState(false)
  const [bodyReady, setBodyReady] = useState(false)
  const [metaReady, setMetaReady] = useState(false)

  useEffect(() => {
    centreClock.value = withSequence(
      withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }),
      withRepeat(withTiming(1.08, { duration: 2400, easing: Easing.inOut(Easing.ease) }), -1, true),
    )

    // Stars lit one by one. The constellation has variable stars
    // (zodiac figures range ~5..11 points), so the schedule scales
    // with starCount.
    const satTimeouts = Array.from({ length: starCount }, (_, i) =>
      setTimeout(
        () => {
          // Tiny haptic per star — barely there, but adds the
          // tactile "Stelar saw this" beat.
          Haptics.selectionAsync().catch(() => {})
          setSatellitesLit((prev) => [...prev, i])
        },
        SAT_FIRST_AT + i * SAT_STAGGER,
      ),
    )

    // Lines draw once every star is on screen + a brief settle pause.
    const linesAt = SAT_FIRST_AT + starCount * SAT_STAGGER + 100
    const headlineAt = linesAt + POST_LINES_PAUSE
    const bodyAt = headlineAt + 500
    const metaAt = bodyAt + 500

    const linesT = setTimeout(() => setLinesLit(true), linesAt)
    const headlineT = setTimeout(() => {
      // Stronger haptic at the headline beat — the "Stelar speaks" moment.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
      setHeadlineReady(true)
    }, headlineAt)
    const bodyT = setTimeout(() => setBodyReady(true), bodyAt)
    const metaT = setTimeout(() => setMetaReady(true), metaAt)

    return () => {
      cancelAnimation(centreClock)
      satTimeouts.forEach(clearTimeout)
      clearTimeout(linesT)
      clearTimeout(headlineT)
      clearTimeout(bodyT)
      clearTimeout(metaT)
    }
  }, [centreClock, starCount])

  const handleStart = async () => {
    setAdvancing(true)
    try {
      await updateProfile.mutateAsync({
        onboarding_completed_at: new Date().toISOString(),
        timezone: deviceTimezone(),
      })
      track('onboarding_completed')
      const macros = calculateMacros({
        weight_kg: brief?.latest_measurement?.weight_kg ?? null,
        height_cm: profile?.height_cm ?? null,
        date_of_birth: profile?.date_of_birth ?? null,
        biological_sex: (profile?.biological_sex as BiologicalSex | null) ?? null,
        // monthly_focus replaces the legacy `goal` input — calcMacros
        // derives the deficit / maintain mode from it internally.
        monthly_focus: (profile?.monthly_focus as MonthlyFocus | null) ?? null,
        training_frequency: (profile?.training_frequency as TrainingFrequency | null) ?? null,
      })
      if (macros) {
        try {
          await upsertMacros.mutateAsync(macros)
        } catch {
          // Soft failure: macros are nice-to-have day 1, not blocking.
        }
      }
    } catch {
      // Día 1 re-fetches the profile on mount — transient patch failure
      // doesn't strand the user here.
    }
    router.replace('/onboarding/day-one')
  }

  return (
    <WizardLayout
      step={12}
      totalSteps={12}
      canContinue
      loading={advancing}
      onContinue={handleStart}
      continueLabel="Entrar a tu órbita →"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <StepHeader eyebrow="Stelar te lee" eyebrowColor="magenta" question="" />

        <View style={styles.stage}>
          <RevealConstellation
            centreClock={centreClock}
            satellitesLit={satellitesLit}
            linesLit={linesLit}
            sign={zodiacSign}
          />
        </View>

        {headlineReady ? (
          <Animated.Text entering={FadeIn.duration(520)} style={styles.headline}>
            {firstName}, <Text style={styles.headlineEm}>Stelar ya te lee</Text>.
          </Animated.Text>
        ) : (
          <View style={styles.headlinePlaceholder} />
        )}

        {bodyReady ? (
          <Animated.Text entering={FadeIn.duration(480)} style={styles.body}>
            {zodiacLabel ? <Text style={styles.bodyEm}>{zodiacLabel}</Text> : null}
            {zodiacLabel && showsCycle ? ', ' : null}
            {showsCycle ? (
              <>
                en <Text style={styles.bodyEm}>fase lútea</Text>
              </>
            ) : null}
            {zodiacLabel || showsCycle ? ', ' : null}
            {focusVerb}. Stelar empieza acá. Cuanto más registres, más se afina.
          </Animated.Text>
        ) : (
          <View style={styles.bodyPlaceholder} />
        )}

        {metaReady ? (
          <Animated.View entering={FadeIn.duration(440)}>
            <View style={styles.rule} />
            <Text style={styles.metaTitle}>QUÉ SIGUE</Text>
            <Text style={styles.metaBody}>
              Mañana, pasado y todos los días que vienen, Stelar arma tu lectura. Vas a ver patrones
              confirmados a partir del segundo ciclo.
            </Text>
          </Animated.View>
        ) : null}
      </ScrollView>
    </WizardLayout>
  )
}

/* ─────────────────────── Constellation ─────────────────────── */

// Timing constants (ms from mount). The stagger between star
// ignitions is fixed; LINES_AT shifts with the constellation's star
// count so the lines fade in only after every star is present.
const SAT_FIRST_AT = 500
const SAT_STAGGER = 200
const POST_LINES_PAUSE = 600

const STAGE_SIZE = 360
// The constellation's [0..1] viewport maps onto this central area
// of the SVG canvas. Spread tuned so all 12 zodiac figures fit
// comfortably inside STAGE_SIZE without the brightest stars hugging
// the edge.
const CONSTELLATION_SPREAD_X = 280
const CONSTELLATION_SPREAD_Y = 250

/** Map a zodiac star's normalised (x, y) coords (0..1) onto canvas
 *  coords centred on (CX, CY). */
function projectStar(x: number, y: number, cx: number, cy: number) {
  return {
    x: cx + (x - 0.5) * CONSTELLATION_SPREAD_X,
    y: cy + (y - 0.5) * CONSTELLATION_SPREAD_Y,
  }
}

/** Star size factor from the figure's iconographic magnitude.
 *  Finer bands at the bright end so Pollux (mag 1.14) clearly out-
 *  shines Castor (mag 1.58) the way it does in the sky. */
function magToSize(mag: number): number {
  if (mag <= 1.3) return 1.55 // brightest anchor (Pollux, Aldebarán, …)
  if (mag <= 1.7) return 1.3 // anchor (Castor, Hamal, …)
  if (mag <= 2.1) return 1.05 // bright connector (Alhena, …)
  if (mag <= 2.7) return 0.9
  if (mag <= 3.3) return 0.75
  return 0.6 // faint
}

/** The reveal constellation: the user's actual zodiac figure lights
 *  up star by star, then the connector lines fade in to draw the
 *  silhouette. Each star is rendered as a small bloom + core sized
 *  by its iconographic magnitude (anchors brightest, connectors
 *  faintest). Behind the figure, a soft magenta radial wash gives
 *  the canvas Stelar's "I'm reading you" presence without competing
 *  with the constellation as a focal point. */
function RevealConstellation({
  centreClock,
  satellitesLit,
  linesLit,
  sign,
}: {
  centreClock: SharedValue<number>
  satellitesLit: readonly number[]
  linesLit: boolean
  sign: ZodiacSign
}) {
  const CX = STAGE_SIZE / 2
  const CY = STAGE_SIZE / 2
  const figure = ZODIAC[sign]
  const stars = figure.stars
  const lines = figure.lines

  return (
    <Svg width={STAGE_SIZE} height={STAGE_SIZE} viewBox={`0 0 ${STAGE_SIZE} ${STAGE_SIZE}`}>
      <Defs>
        <RadialGradient id="reveal-anchor" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="40%" stopColor="#FBD7E3" />
          <Stop offset="100%" stopColor={colors.magenta} />
        </RadialGradient>
        <RadialGradient id="reveal-star" cx="50%" cy="50%" r="60%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="55%" stopColor="#FBD7E3" />
          <Stop offset="100%" stopColor={colors.magenta} />
        </RadialGradient>
        <RadialGradient id="reveal-ambient" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={colors.magenta} stopOpacity={0.16} />
          <Stop offset="50%" stopColor={colors.magenta} stopOpacity={0.06} />
          <Stop offset="100%" stopColor={colors.magenta} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Ambient magenta wash — replaces the prior dominant centre
          body. Gives the canvas Stelar's "presence" without a focal
          element competing with the constellation. Drives off the
          centreClock so it pulses with the user's reveal beat. */}
      <AmbientWash clock={centreClock} cx={CX} cy={CY} />

      {/* Constellation lines — star → star per FIGURES[sign].lines.
          Drawn before the stars so the blooms cover the line ends
          where they meet at each star. */}
      {linesLit
        ? lines.map((pair, i) => {
            const a = stars[pair[0]]
            const b = stars[pair[1]]
            if (!a || !b) return null
            const p1 = projectStar(a.x, a.y, CX, CY)
            const p2 = projectStar(b.x, b.y, CX, CY)
            return (
              <ConstellationLine
                key={`line-${i}`}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                delay={i * 60}
              />
            )
          })
        : null}

      {/* Stars — mounted one by one as they ignite. The brightest
          star (anchor) gets bigger bloom + magenta core; connectors
          stay cream-white. */}
      {satellitesLit.map((i) => {
        const star = stars[i]
        if (!star) return null
        const { x, y } = projectStar(star.x, star.y, CX, CY)
        return (
          <ConstellationStar
            key={`star-${i}`}
            cx={x}
            cy={y}
            size={magToSize(star.mag)}
            isAnchor={star.mag <= 1.7}
          />
        )
      })}
    </Svg>
  )
}

/** Soft magenta radial wash behind the constellation — gives the
 *  canvas Stelar's "reading you" presence without a focal point. */
function AmbientWash({ clock, cx, cy }: { clock: SharedValue<number>; cx: number; cy: number }) {
  const props = useAnimatedProps(() => {
    'worklet'
    const w = Math.min(1, clock.value)
    const breath = Math.max(0, clock.value - 1)
    return {
      r: 140 + w * 30 + breath * 8,
      opacity: 0.4 + w * 0.6,
    }
  })
  return <AnimatedCircle cx={cx} cy={cy} fill="url(#reveal-ambient)" animatedProps={props} />
}

/** A single constellation star. Twinkles in on mount with a 420 ms
 *  bloom (spring back-out), then breathes forever. Visually: 2 halo
 *  layers + 4-spike diffraction cross + magenta-gradient core. The
 *  anchor flag boosts the bloom + uses the brighter gradient for the
 *  one or two iconic stars of each zodiac figure (e.g. Castor +
 *  Pollux in Géminis, Aldebaran in Tauro). */
function ConstellationStar({
  cx,
  cy,
  size,
  isAnchor,
}: {
  cx: number
  cy: number
  size: number
  isAnchor: boolean
}) {
  // Local clock: 0 → 1 over 380 ms (bloom-in), then breath.
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withSequence(
      withTiming(1, { duration: 420, easing: Easing.out(Easing.back(2)) }),
      withRepeat(withTiming(1.06, { duration: 2800, easing: Easing.inOut(Easing.ease) }), -1, true),
    )
    return () => cancelAnimation(t)
  }, [t])

  const baseR = (isAnchor ? 4.4 : 3.4) * size
  const spikeLen = baseR * 3.2
  const haloBoost = isAnchor ? 1.3 : 1

  const haloOuter = useAnimatedProps(() => {
    'worklet'
    const w = Math.min(1, t.value)
    const breath = Math.max(0, t.value - 1)
    return {
      r: baseR * 4 * haloBoost * (0.5 + 0.5 * w + breath * 0.5),
      opacity: (isAnchor ? 0.1 : 0.06) * w,
    }
  })
  const haloMid = useAnimatedProps(() => {
    'worklet'
    const w = Math.min(1, t.value)
    return {
      r: baseR * 2.2 * haloBoost * (0.5 + 0.5 * w),
      opacity: (isAnchor ? 0.24 : 0.16) * w,
    }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const w = Math.min(1, t.value)
    return { r: baseR * (0.4 + 0.6 * w) }
  })
  const coreHi = useAnimatedProps(() => {
    'worklet'
    const w = Math.min(1, t.value)
    return { r: baseR * 0.35 * w, opacity: 0.95 * w }
  })
  const spikeH = useAnimatedProps(() => {
    'worklet'
    const w = Math.min(1, t.value)
    const len = spikeLen * w
    return { x1: cx - len, x2: cx + len, opacity: 0.55 * w }
  })
  const spikeV = useAnimatedProps(() => {
    'worklet'
    const w = Math.min(1, t.value)
    const len = spikeLen * w
    return { y1: cy - len, y2: cy + len, opacity: 0.55 * w }
  })

  return (
    <>
      <AnimatedCircle cx={cx} cy={cy} fill={colors.magenta} animatedProps={haloOuter} />
      <AnimatedCircle cx={cx} cy={cy} fill={colors.magenta} animatedProps={haloMid} />
      <AnimatedLine
        y1={cy}
        y2={cy}
        stroke="#FFFFFF"
        strokeWidth={0.7}
        strokeLinecap="round"
        animatedProps={spikeH}
      />
      <AnimatedLine
        x1={cx}
        x2={cx}
        stroke="#FFFFFF"
        strokeWidth={0.7}
        strokeLinecap="round"
        animatedProps={spikeV}
      />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        fill={isAnchor ? 'url(#reveal-anchor)' : 'url(#reveal-star)'}
        animatedProps={coreProps}
      />
      <AnimatedCircle cx={cx} cy={cy} fill="#FFFFFF" animatedProps={coreHi} />
    </>
  )
}

/** A constellation line connecting the centre to a satellite. Fades
 *  in over 360 ms with a small per-index delay. Drawn as a thin
 *  dashed magenta whisper so it suggests the connection without
 *  competing with the stars. */
function ConstellationLine({
  x1,
  y1,
  x2,
  y2,
  delay,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  delay: number
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    const id = setTimeout(() => {
      t.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })
    }, delay)
    return () => {
      clearTimeout(id)
      cancelAnimation(t)
    }
  }, [t, delay])

  const props = useAnimatedProps(() => {
    'worklet'
    return { opacity: 0.18 * t.value }
  })

  return (
    <AnimatedLine
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="#FBD7E3"
      strokeWidth={0.7}
      strokeDasharray="2 4"
      strokeLinecap="round"
      animatedProps={props}
    />
  )
}

const styles = StyleSheet.create({
  stage: {
    marginTop: 6,
    alignItems: 'center',
  },
  headlinePlaceholder: {
    marginTop: 8,
    height: 36,
  },
  bodyPlaceholder: {
    marginTop: 14,
    height: 66,
  },
  headline: {
    marginTop: 8,
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.macroNum,
    lineHeight: 36,
    color: colors.leche,
    letterSpacing: -1,
  },
  headlineEm: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: typography.sizes.macroNum,
    color: colors.magenta,
  },
  body: {
    marginTop: 14,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.ui,
    lineHeight: 22,
    color: colors.bone,
  },
  bodyEm: {
    color: colors.magenta,
    fontFamily: typography.serifSemi,
  },
  rule: {
    marginTop: 22,
    height: 1,
    backgroundColor: colors.bruma,
  },
  metaTitle: {
    marginTop: 20,
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.smallLabel,
    color: colors.niebla,
    letterSpacing: 2.2,
  },
  metaBody: {
    marginTop: 8,
    fontFamily: typography.uiMedium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.bone,
  },
})
