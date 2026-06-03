import { memo, useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { useRouter } from 'expo-router'

import { ScreenCosmos } from '@/features/orbit/components/Cosmos'
import { requestOrbitSegment } from '@/features/orbit/pending-segment'
import { track } from '@/lib/analytics'
import { colors, typography } from '@/theme'

import type { PatternType } from '../logic'

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedPath = Animated.createAnimatedComponent(Path)

const MAGENTA = '#E91E63'
const ORO = '#D9AE6F'

// Figure canvas inside the card — node coordinates live in this box.
const FW = 300
const FH = 150

/* Cadence tier — the temporal depth of a pattern. Drives the AESTHETIC
 * and PRESENCE (never the copy's hardness): deeper = more cosmic gravity
 * + more tenderness, never more judgment (manifiesto). 'rooted' (3+ mo)
 * earns gold chrome + a corona; the lighter tiers stay magenta. */
type Tier = 'weekly' | 'monthly' | 'rooted'

type TierStyle = {
  /** Chrome accent — gold for the deepest patterns (the sky's light),
   *  magenta for the lighter ones. */
  chrome: string
  /** Filled CTA — solid so the action is unmistakable. */
  ctaFill: string
  ctaText: string
  corona: boolean
}

const TIER_STYLE: Record<Tier, TierStyle> = {
  weekly: { chrome: colors.oro, ctaFill: colors.magenta, ctaText: colors.leche, corona: false },
  monthly: { chrome: colors.oro, ctaFill: colors.magenta, ctaText: colors.leche, corona: false },
  // Gold fill needs dark text for contrast.
  rooted: { chrome: colors.oro, ctaFill: colors.oro, ctaText: colors.bg, corona: true },
}

type Node = { x: number; y: number; s: number }

type RevealConfig = {
  tier: Tier
  /** Gold eyebrow — coach voice, never "patrón en tus datos". */
  eyebrow: string
  /** Cadence whisper ("ESTA SEMANA"). NEVER a duration count
   *  ("3 meses") — that would be a verdict (manifiesto). */
  cadence: string | null
  /** "From your days" — turns surveillance into a mirror. */
  anchor: string | null
  nodes: Node[]
  closed: boolean
  /** Faint "stars that waited" beneath — they were always yours. */
  ghost: boolean
}

const CONFIG: Record<PatternType, RevealConfig> = {
  night_eating: {
    tier: 'weekly',
    eyebrow: 'ALGO QUE NOTÉ',
    cadence: 'ESTA SEMANA',
    anchor: 'Esto viene de ti',
    nodes: [
      { x: 34, y: 124, s: 0.72 }, // the origin is a whisper
      { x: 98, y: 100, s: 0.9 },
      { x: 160, y: 74, s: 1.0 },
      { x: 222, y: 48, s: 1.15 },
      { x: 276, y: 26, s: 1.35 }, // the header — radiant destination
    ],
    closed: false,
    ghost: false,
  },
  abandonment: {
    // A return after an absence is the deepest, tenderest moment — it
    // earns the rooted ceremony (gold + ghost stars that waited).
    tier: 'rooted',
    eyebrow: 'TU CIELO',
    cadence: null,
    anchor: null,
    nodes: [
      { x: 150, y: 24, s: 1.1 },
      { x: 214, y: 64, s: 0.95 },
      { x: 192, y: 128, s: 0.95 },
      { x: 108, y: 128, s: 0.95 },
      { x: 86, y: 64, s: 0.95 },
    ],
    closed: true,
    ghost: true,
  },
}

/* A smooth curve through the nodes (Catmull-Rom → Bézier). A constellation
 * thread is drawn with light, never rigid straight segments. `len` is the
 * euclidean sum nudged +8% to cover the curve's extra arc length — enough
 * for the strokeDashoffset draw-on. */
function buildPath(nodes: Node[], closed: boolean): { d: string; len: number } {
  if (nodes.length < 2) return { d: '', len: 0 }
  const p = nodes
  const n = p.length
  const t = 0.5 // tension
  let d = `M ${p[0]!.x} ${p[0]!.y}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!
    const p1 = p[i]!
    const p2 = p[i + 1]!
    const p3 = p[i + 2] ?? p2
    const c1x = p1.x + ((p2.x - p0.x) / 6) * t * 2
    const c1y = p1.y + ((p2.y - p0.y) / 6) * t * 2
    const c2x = p2.x - ((p3.x - p1.x) / 6) * t * 2
    const c2y = p2.y - ((p3.y - p1.y) / 6) * t * 2
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`
  }
  let euclid = 0
  for (let i = 1; i < n; i++) {
    euclid += Math.hypot(p[i]!.x - p[i - 1]!.x, p[i]!.y - p[i - 1]!.y)
  }
  if (closed && n > 1) {
    d += ` C ${p[n - 1]!.x} ${p[n - 1]!.y} ${p[0]!.x} ${p[0]!.y} ${p[0]!.x} ${p[0]!.y} Z`
    euclid += Math.hypot(p[0]!.x - p[n - 1]!.x, p[0]!.y - p[n - 1]!.y)
  }
  return { d, len: euclid * 1.08 }
}

/* Deterministic micro-stars scattered in the figure's sky — depth so the
 * constellation lights "over a sky that was already there", not on a flat
 * panel. Kept off the ascending path band (top-left + bottom-right). */
const FIELD_STARS: { x: number; y: number; r: number; op: number }[] = [
  { x: 60, y: 38, r: 0.7, op: 0.34 },
  { x: 112, y: 28, r: 0.5, op: 0.24 },
  { x: 38, y: 66, r: 0.6, op: 0.3 },
  { x: 200, y: 122, r: 0.8, op: 0.4 },
  { x: 250, y: 104, r: 0.55, op: 0.26 },
  { x: 150, y: 136, r: 0.6, op: 0.32 },
  { x: 286, y: 72, r: 0.5, op: 0.22 },
  { x: 20, y: 108, r: 0.6, op: 0.3 },
  { x: 236, y: 138, r: 0.7, op: 0.36 },
]

/* One star of the figure — a compact flare, fades in (staggered).
 * memo'd so the post-layout re-render (corona) doesn't recreate every
 * node's worklet. */
const RevealNode = memo(function RevealNode({
  node,
  appearAt,
  progress,
  twinkle,
  header = false,
}: {
  node: Node
  appearAt: number
  progress: SharedValue<number>
  /** Slow looping phase (0..2π) — a gentle shimmer so the lit figure
   *  breathes like a real sky instead of a frozen diagram. */
  twinkle: SharedValue<number>
  /** The dominant star (destination of the rise) — gets diagonal rays +
   *  a sparkle so it clearly leads the figure. */
  header?: boolean
}) {
  const props = useAnimatedProps(() => {
    const appear = interpolate(progress.value, [appearAt, appearAt + 0.2], [0, 1], 'clamp')
    // Per-node phase (from appearAt) so they don't pulse in unison.
    const shimmer = 0.84 + 0.16 * Math.sin(twinkle.value + appearAt * 9)
    return { opacity: appear * shimmer }
  })
  const s = node.s
  const { x, y } = node
  return (
    <AnimatedG animatedProps={props}>
      <Circle cx={x} cy={y} r={11 * s} fill="url(#pr-aura)" />
      {header ? (
        <>
          <Ellipse
            cx={x}
            cy={y}
            rx={7.5 * s}
            ry={0.9}
            fill="url(#pr-streak)"
            opacity={0.32}
            transform={`rotate(45, ${x}, ${y})`}
          />
          <Ellipse
            cx={x}
            cy={y}
            rx={7.5 * s}
            ry={0.9}
            fill="url(#pr-streak)"
            opacity={0.32}
            transform={`rotate(-45, ${x}, ${y})`}
          />
        </>
      ) : null}
      <Ellipse cx={x} cy={y} rx={10 * s} ry={1.1 * s} fill="url(#pr-streak)" opacity={0.72} />
      <Ellipse cx={x} cy={y} rx={1 * s} ry={7 * s} fill="url(#pr-streak)" opacity={0.5} />
      <Circle cx={x} cy={y} r={5 * s} fill="url(#pr-bloom)" />
      <Circle cx={x} cy={y} r={2.5 * s} fill={MAGENTA} />
      <Circle cx={x} cy={y} r={1.1 * s} fill="#FFFFFF" opacity={0.95} />
      {header ? <Circle cx={x + 10} cy={y - 8} r={0.8} fill="#FFFFFF" opacity={0.6} /> : null}
    </AnimatedG>
  )
})

type RevealedPattern = { id: string; type: PatternType; message: string }

/* The animated body — mounted only while visible, so all hooks here run
 * unconditionally. A centered card that is BORN from a point of light at
 * the screen's centre: a bloom flashes, the card condenses out of it,
 * then the figure ignites. Over a blurred, paused Hoy. */
function RevealBody({ pattern, onClose }: { pattern: RevealedPattern; onClose: () => void }) {
  const { width, height } = useWindowDimensions()
  const reduced = useReducedMotion() ?? false
  const router = useRouter()

  const cfg = CONFIG[pattern.type]
  const tier = TIER_STYLE[cfg.tier]
  const { d, len } = buildPath(cfg.nodes, cfg.closed)
  const n = cfg.nodes.length
  // The dominant "header" star (rise destination) — weekly only; a rooted
  // figure is a circle of equals, no leader.
  const headerIdx = cfg.tier === 'rooted' ? -1 : n - 1
  // The line body glows toward the header (weekly) or stays even (rooted).
  const lineMid = cfg.tier === 'rooted' ? '#FBD7E3' : 'url(#pr-line)'
  const cardW = Math.min(width - 56, 348)

  const [cardSize, setCardSize] = useState<{ w: number; h: number } | null>(null)

  const blurT = useSharedValue(0)
  const scrimOp = useSharedValue(0)
  const bloomT = useSharedValue(0)
  const cardT = useSharedValue(0)
  const starsT = useSharedValue(0)
  const lineT = useSharedValue(0)
  const lineT2 = useSharedValue(0) // cream filament — chases the under-glow
  const eyebrowOp = useSharedValue(0)
  const msgOp = useSharedValue(0)
  const ctaOp = useSharedValue(0)
  // Perpetual ambient life around the card.
  const twinkle = useSharedValue(0)
  const breath = useSharedValue(0)

  useEffect(() => {
    track('coach_message_shown', { pattern_type: pattern.type })
    const timers: ReturnType<typeof setTimeout>[] = []

    if (reduced) {
      // No birth-from-a-point (vestibular safety): the world softens and
      // the card is simply already there, in one calm crossfade.
      blurT.value = withTiming(1, { duration: 320 })
      scrimOp.value = withTiming(1, { duration: 320 })
      bloomT.value = 0
      cardT.value = withTiming(1, { duration: 360 })
      starsT.value = withDelay(160, withTiming(1, { duration: 320 }))
      lineT.value = withDelay(160, withTiming(1, { duration: 360 }))
      lineT2.value = withDelay(160, withTiming(1, { duration: 360 }))
      eyebrowOp.value = withDelay(200, withTiming(1, { duration: 320 }))
      msgOp.value = withDelay(300, withTiming(1, { duration: 360 }))
      ctaOp.value = withDelay(500, withTiming(1, { duration: 320 }))
    } else {
      // 0 · the world softens first ("calma, y entonces aparezco").
      blurT.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) })
      scrimOp.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) })
      // 1 · the seed bloom — a star is born at the centre, with a recoil.
      bloomT.value = withDelay(
        120,
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
          withTiming(0, { duration: 620, easing: Easing.inOut(Easing.cubic) }),
        ),
      )
      // 2 · the card condenses out of the bloom.
      cardT.value = withDelay(
        360,
        withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }),
      )
      // 3 · the figure ignites inside the card.
      starsT.value = withDelay(
        820,
        withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) }),
      )
      lineT.value = withDelay(
        1180,
        withTiming(1, { duration: 680, easing: Easing.inOut(Easing.cubic) }),
      )
      lineT2.value = withDelay(
        1300,
        withTiming(1, { duration: 680, easing: Easing.inOut(Easing.cubic) }),
      )
      // 4 · copy + CTA arrive after the art has settled.
      eyebrowOp.value = withDelay(1480, withTiming(1, { duration: 460 }))
      msgOp.value = withDelay(1680, withTiming(1, { duration: 520 }))
      ctaOp.value = withDelay(2120, withTiming(1, { duration: 460 }))

      // Perpetual ambient — the figure shimmers + the card's halo
      // breathes, so the modal feels alive in a living sky (not frozen).
      twinkle.value = withDelay(
        900,
        withRepeat(withTiming(Math.PI * 2, { duration: 3800, easing: Easing.linear }), -1, false),
      )
      breath.value = withDelay(
        700,
        withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true),
      )

      // Haptic at birth (the bloom peak) + a second beat at the figure's
      // close for the rooted tier — the deeper pattern lands heavier.
      timers.push(
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        }, 440),
      )
      timers.push(
        setTimeout(() => {
          if (cfg.tier === 'rooted') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
          }
        }, 1820),
      )
    }

    return () => {
      timers.forEach(clearTimeout)
      // Stop any in-flight clock writing to an unmounted component.
      cancelAnimation(blurT)
      cancelAnimation(scrimOp)
      cancelAnimation(bloomT)
      cancelAnimation(cardT)
      cancelAnimation(starsT)
      cancelAnimation(lineT)
      cancelAnimation(lineT2)
      cancelAnimation(eyebrowOp)
      cancelAnimation(msgOp)
      cancelAnimation(ctaOp)
      cancelAnimation(twinkle)
      cancelAnimation(breath)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern.type, reduced])

  // Fade the blur layer by OPACITY (cheap) instead of animating BlurView
  // `intensity` per frame, which re-runs the gaussian every frame and
  // janks on real devices / Android (reanimated-guardian).
  const blurStyle = useAnimatedStyle(() => ({ opacity: blurT.value }))
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOp.value * 0.5 }))
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: bloomT.value,
    transform: [{ scale: 0.4 + bloomT.value * 1.1 }],
  }))
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardT.value,
    transform: [{ scale: 0.86 + cardT.value * 0.14 }],
  }))
  const eyebrowStyle = useAnimatedStyle(() => ({
    opacity: eyebrowOp.value,
    transform: [{ translateY: (1 - eyebrowOp.value) * 6 }],
  }))
  const msgStyle = useAnimatedStyle(() => ({
    opacity: msgOp.value,
    transform: [{ translateY: (1 - msgOp.value) * 10 }],
  }))
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOp.value }))
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - lineT.value) }))
  const lineProps2 = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - lineT2.value) }))
  // The card's halo breathes once the card has condensed.
  const haloStyle = useAnimatedStyle(() => ({
    opacity: cardT.value * (0.5 + breath.value * 0.5),
    transform: [{ scale: 0.92 + cardT.value * 0.08 + breath.value * 0.05 }],
  }))

  const close = (): void => {
    Haptics.selectionAsync().catch(() => {})
    onClose()
  }
  const goToOrbit = (): void => {
    // Land on the Semana segment — night_eating is a weekly pattern. The
    // segment goes through the mailbox (params don't reach a tab screen
    // reliably); navigate FIRST, then close, so the unmount can't race
    // the navigation. Object pathname form (the one that navigated).
    requestOrbitSegment('semana')
    router.navigate({ pathname: '/orbit' })
    onClose()
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Hoy softens behind — paused, not replaced. */}
      <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
        <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}
        pointerEvents="none"
      />
      {/* Living cosmos AROUND the card — drifting nebulae, twinkling
          stars, the odd shooting star. The card floats in the same sky
          as the Órbita, not on a dead panel. */}
      <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
        <ScreenCosmos width={width} height={height} />
      </Animated.View>

      {/* The backdrop IS the centering container: tapping the blurred sky
          closes. Leaving without "accepting" the observation is a
          first-class exit (te veo, no te vigilo). */}
      <Pressable
        style={[StyleSheet.absoluteFill, styles.center]}
        onPress={close}
        accessibilityLabel="Cerrar el mensaje"
      >
        {/* The card's breathing halo — a slow magenta pulse behind it,
            so the card glows like it's alive in the sky. */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.centerAbs, haloStyle]}
          pointerEvents="none"
        >
          <Svg width={cardW * 1.35} height={cardW * 1.35} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="pr-halo" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={MAGENTA} stopOpacity={0.32} />
                <Stop offset="45%" stopColor={MAGENTA} stopOpacity={0.12} />
                <Stop offset="100%" stopColor={MAGENTA} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={50} cy={50} r={50} fill="url(#pr-halo)" />
          </Svg>
        </Animated.View>

        {/* The seed bloom — the point of light the card is born from. */}
        <Animated.View style={[styles.bloom, bloomStyle]} pointerEvents="none">
          <Svg width={220} height={220} viewBox="0 0 220 220">
            <Defs>
              <RadialGradient id="pr-seed" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
                <Stop offset="26%" stopColor="#FFE9D6" stopOpacity={0.5} />
                <Stop offset="64%" stopColor={MAGENTA} stopOpacity={0.22} />
                <Stop offset="100%" stopColor={MAGENTA} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={110} cy={110} r={110} fill="url(#pr-seed)" />
          </Svg>
        </Animated.View>

        {/* Card absorbs its own taps (empty onPress) so tapping the card
            never bubbles up to the backdrop and closes by accident. */}
        <Pressable onPress={() => {}}>
          <Animated.View
            style={[styles.card, { width: cardW }, cardStyle]}
            onLayout={(e) => {
              const { width: w, height: h } = e.nativeEvent.layout
              setCardSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }))
            }}
            accessibilityViewIsModal
          >
            {/* Corona — a broken gold ring, the signature of a rooted
              pattern (an old star in your sky). */}
            {tier.corona && cardSize ? (
              <Svg
                width={cardSize.w + 16}
                height={cardSize.h + 16}
                style={styles.corona}
                pointerEvents="none"
              >
                <Rect
                  x={6}
                  y={6}
                  width={cardSize.w + 4}
                  height={cardSize.h + 4}
                  rx={32}
                  fill="none"
                  stroke={ORO}
                  strokeWidth={1}
                  strokeOpacity={0.5}
                  strokeDasharray="46 12 110 12"
                  strokeLinecap="round"
                />
              </Svg>
            ) : null}

            <Animated.Text style={[styles.eyebrow, { color: tier.chrome }, eyebrowStyle]}>
              {cfg.eyebrow}
            </Animated.Text>
            {cfg.cadence ? (
              <Animated.Text style={[styles.cadence, eyebrowStyle]}>
                · {cfg.cadence} ·
              </Animated.Text>
            ) : null}

            <View style={styles.figureWrap} pointerEvents="none">
              <Svg width={cardW - 36} height={FH} viewBox={`0 0 ${FW} ${FH}`}>
                <Defs>
                  <RadialGradient id="pr-aura" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={MAGENTA} stopOpacity={0.42} />
                    <Stop offset="40%" stopColor={MAGENTA} stopOpacity={0.18} />
                    <Stop offset="74%" stopColor="#FBD7E3" stopOpacity={0.06} />
                    <Stop offset="100%" stopColor={MAGENTA} stopOpacity={0} />
                  </RadialGradient>
                  <RadialGradient id="pr-bloom" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.92} />
                    <Stop offset="32%" stopColor="#FFE9D6" stopOpacity={0.5} />
                    <Stop offset="72%" stopColor={MAGENTA} stopOpacity={0.16} />
                    <Stop offset="100%" stopColor={MAGENTA} stopOpacity={0} />
                  </RadialGradient>
                  <RadialGradient id="pr-streak" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
                    <Stop offset="40%" stopColor="#FFFFFF" stopOpacity={0.32} />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                  {/* Nebula veil — depth behind the figure (galaxy-bulb hue). */}
                  <RadialGradient id="pr-veil" cx="62%" cy="34%" r="62%">
                    <Stop offset="0%" stopColor="#7A2A60" stopOpacity={0.28} />
                    <Stop offset="42%" stopColor="#7A2A60" stopOpacity={0.12} />
                    <Stop offset="100%" stopColor="#7A2A60" stopOpacity={0} />
                  </RadialGradient>
                  <RadialGradient id="pr-veil2" cx="22%" cy="86%" r="55%">
                    <Stop offset="0%" stopColor="#A6164A" stopOpacity={0.14} />
                    <Stop offset="100%" stopColor="#A6164A" stopOpacity={0} />
                  </RadialGradient>
                  <RadialGradient id="pr-veil-gold" cx="50%" cy="50%" r="62%">
                    <Stop offset="0%" stopColor={ORO} stopOpacity={0.1} />
                    <Stop offset="100%" stopColor={ORO} stopOpacity={0} />
                  </RadialGradient>
                  {/* Line body glows toward the header. */}
                  <LinearGradient id="pr-line" x1="0" y1="1" x2="1" y2="0">
                    <Stop offset="0%" stopColor={MAGENTA} stopOpacity={0.5} />
                    <Stop offset="60%" stopColor={colors.magentaHot} stopOpacity={0.85} />
                    <Stop offset="100%" stopColor="#FFD9E6" stopOpacity={1} />
                  </LinearGradient>
                </Defs>

                {/* Cosmic veil — the figure lights over a sky, not a panel. */}
                {cfg.tier === 'rooted' ? (
                  <Rect x={0} y={0} width={FW} height={FH} fill="url(#pr-veil-gold)" />
                ) : (
                  <>
                    <Rect x={0} y={0} width={FW} height={FH} fill="url(#pr-veil)" />
                    <Rect x={0} y={0} width={FW} height={FH} fill="url(#pr-veil2)" />
                  </>
                )}

                {/* Field stars — faint depth, the sky that was already there. */}
                {FIELD_STARS.map((fs) => (
                  <Circle
                    key={`f-${fs.x}-${fs.y}`}
                    cx={fs.x}
                    cy={fs.y}
                    r={fs.r}
                    fill="#FBD7E3"
                    opacity={fs.op}
                  />
                ))}

                {/* The stars that waited (rooted/abandonment) — already
                  yours, faintly haloed beneath the re-ignition. */}
                {cfg.ghost
                  ? cfg.nodes.map((nd) => (
                      <G key={`g-${nd.x}-${nd.y}`}>
                        <Circle cx={nd.x} cy={nd.y} r={6} fill="url(#pr-aura)" opacity={0.18} />
                        <Circle cx={nd.x} cy={nd.y} r={1.8} fill={colors.bone} opacity={0.28} />
                      </G>
                    ))
                  : null}

                {/* The connecting line — drawn with light: a wide under-glow,
                  a hot body that brightens toward the header, and a fine
                  cream filament that chases just behind. */}
                <AnimatedPath
                  d={d}
                  fill="none"
                  stroke={MAGENTA}
                  strokeWidth={5}
                  opacity={0.14}
                  strokeDasharray={len}
                  animatedProps={lineProps}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <AnimatedPath
                  d={d}
                  fill="none"
                  stroke={lineMid}
                  strokeWidth={2.2}
                  opacity={0.5}
                  strokeDasharray={len}
                  animatedProps={lineProps}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <AnimatedPath
                  d={d}
                  fill="none"
                  stroke="#FBD7E3"
                  strokeWidth={0.9}
                  opacity={0.7}
                  strokeDasharray={len}
                  animatedProps={lineProps2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {cfg.nodes.map((nd, i) => (
                  <RevealNode
                    key={`${nd.x}-${nd.y}`}
                    node={nd}
                    appearAt={(i / Math.max(1, n - 1)) * 0.62}
                    progress={starsT}
                    twinkle={twinkle}
                    header={i === headerIdx}
                  />
                ))}
              </Svg>
            </View>

            <Animated.View style={msgStyle}>
              <Text style={styles.message} accessibilityRole="text">
                {pattern.message}
              </Text>
              {cfg.anchor ? <Text style={styles.anchor}>{cfg.anchor}</Text> : null}
            </Animated.View>

            <Animated.View style={[styles.ctaWrap, ctaStyle]}>
              {pattern.type === 'abandonment' ? (
                <Pressable
                  onPress={close}
                  style={({ pressed }) => [
                    styles.ctaPrimary,
                    { backgroundColor: tier.ctaFill, shadowColor: tier.ctaFill },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.ctaPrimaryText, { color: tier.ctaText }]}>Aquí sigo</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    onPress={goToOrbit}
                    style={({ pressed }) => [
                      styles.ctaPrimary,
                      { backgroundColor: tier.ctaFill, shadowColor: tier.ctaFill },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.ctaPrimaryText, { color: tier.ctaText }]}>
                      Verlo en mi órbita
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={close}
                    hitSlop={10}
                    style={({ pressed }) => [styles.ctaSecondary, pressed && styles.pressed]}
                  >
                    <Text style={styles.ctaSecondaryText}>Lo veo</Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </View>
  )
}

type Props = {
  pattern: RevealedPattern | null
  onClose: () => void
}

/*
 * The pattern reveal — Stelar's core moment. A centered card BORN from a
 * point of light at the screen's centre, over a blurred, paused Hoy
 * (not a full-screen takeover — a whisper, not an interruption). Dynamic
 * per pattern + cadence tier (weekly / monthly / rooted): the deeper the
 * pattern, the more cosmic gravity (gold, corona) AND the more tender —
 * never more judgment. No mascot, no paywall, no verdict.
 *
 * Tone-dependent appear delay: abandonment is a hug (soon); night_eating
 * must not ambush a cold open, so it waits for the home to settle.
 */
export function PatternReveal({ pattern, onClose }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!pattern) {
      setVisible(false)
      return
    }
    const delay = pattern.type === 'abandonment' ? 450 : 1800
    const id = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(id)
  }, [pattern])

  if (!pattern || !visible) return null
  // key by type → a clean remount if the pattern ever changes in place,
  // so the per-node hook count can never mismatch (reanimated-guardian).
  return <RevealBody key={pattern.type} pattern={pattern} onClose={onClose} />
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '-4%', // optical centre, slightly high
  },
  bloom: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerAbs: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#1A0C11',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(233,30,99,0.22)',
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    // Soft magenta halo — the single highlight (quiet luxury).
    shadowColor: MAGENTA,
    shadowOpacity: 0.35,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  corona: {
    position: 'absolute',
    top: -8,
    left: -8,
  },
  eyebrow: {
    fontFamily: typography.uiBold,
    fontSize: 11,
    letterSpacing: 3.2,
    textAlign: 'center',
  },
  cadence: {
    fontFamily: typography.uiMedium,
    fontSize: 9,
    letterSpacing: 2.4,
    color: colors.niebla,
    textAlign: 'center',
    marginTop: 6,
  },
  figureWrap: {
    marginTop: 14,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 23,
    lineHeight: 31,
    color: colors.leche,
    textAlign: 'center',
  },
  anchor: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    letterSpacing: 0.4,
    color: colors.niebla,
    textAlign: 'center',
    marginTop: 12,
  },
  ctaWrap: {
    alignItems: 'center',
    marginTop: 22,
  },
  ctaPrimary: {
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 42,
    alignItems: 'center',
    // Glow so the filled pill reads as the clear action.
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  ctaPrimaryText: {
    fontFamily: typography.uiBold,
    fontSize: typography.sizes.bodyLarge,
    letterSpacing: 0.3,
  },
  ctaSecondary: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  ctaSecondaryText: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
  pressed: { opacity: 0.6 },
})
