import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
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
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'

import { colors, typography } from '@/theme'

import { ZODIAC } from '../zodiac/data'
import type { ZodiacDef, ZodiacSign } from '../zodiac/types'

import AcuarioArt from '@/assets/zodiac-art/acuario-art.svg'
import AriesArt from '@/assets/zodiac-art/aries-art.svg'
import CancerArt from '@/assets/zodiac-art/cancer-art.svg'
import CapricornioArt from '@/assets/zodiac-art/capricornio-art.svg'
import EscorpioArt from '@/assets/zodiac-art/escorpio-art.svg'
import GeminisArt from '@/assets/zodiac-art/geminis-art.svg'
import LeoArt from '@/assets/zodiac-art/leo-art.svg'
import LibraArt from '@/assets/zodiac-art/libra-art.svg'
import PiscisArt from '@/assets/zodiac-art/piscis-art.svg'
import SagitarioArt from '@/assets/zodiac-art/sagitario-art.svg'
import TauroArt from '@/assets/zodiac-art/tauro-art.svg'
import VirgoArt from '@/assets/zodiac-art/virgo-art.svg'

import { ZodiacEngraving, type ZodiacEngravingProps } from './ZodiacEngraving'

// Per-sign art asset map — keyed by ZodiacSign so each of the 12
// signs gets its own illustrative backdrop. New signs added here
// auto-appear in SIGN_ENGRAVINGS below without touching the
// rendering logic.
const ART_BY_SIGN: Record<ZodiacSign, ZodiacEngravingProps['art']> = {
  acuario: AcuarioArt,
  aries: AriesArt,
  cancer: CancerArt,
  capricornio: CapricornioArt,
  escorpio: EscorpioArt,
  geminis: GeminisArt,
  leo: LeoArt,
  libra: LibraArt,
  piscis: PiscisArt,
  sagitario: SagitarioArt,
  tauro: TauroArt,
  virgo: VirgoArt,
}

// Per-sign engraving backdrop — every sign now has its art via the
// ART_BY_SIGN map. `artScale` defaults to 1.0 across the board so
// the ornate ring fits the canvas exactly; override per-sign here
// if a given asset needs a different framing.
const SIGN_ENGRAVINGS: Record<
  ZodiacSign,
  Pick<ZodiacEngravingProps, 'art' | 'artScale'>
> = Object.fromEntries(
  (Object.keys(ART_BY_SIGN) as ZodiacSign[]).map((sign) => [
    sign,
    { art: ART_BY_SIGN[sign], artScale: 1.0 },
  ]),
) as Record<ZodiacSign, Pick<ZodiacEngravingProps, 'art' | 'artScale'>>

// Per-sign constellation transform — each figure has its own
// natural bbox (Leo biases lower-left, Escorpio is centered, etc.)
// so the SVG transform that fits the asterism inside the ornate
// ring varies. Default is the Leo-tuned transform; signs that
// don't match that bias get their own override here.
const SIGN_CONSTELLATION_TRANSFORM: Record<ZodiacSign, string> = {
  acuario: 'translate(47 41) scale(0.68)',
  aries: 'translate(46 37) scale(0.68)',
  cancer: 'translate(42 52) scale(0.68)',
  capricornio: 'translate(33 46) scale(0.68)',
  // Escorpio uses a non-uniform scale (0.72 × 0.82) to stretch
  // the figure vertically — the asterism is elongated to match
  // the scorpion's tall body. Translate (50 22) shifts right
  // onto the scorpion's body axis (which sits ~5 % right of
  // canvas centre in the art).
  escorpio: 'translate(40 22) scale(0.72 0.82)',
  geminis: 'translate(52 43) scale(0.68)',
  leo: 'translate(56 64) scale(0.68)',
  libra: 'translate(48 33) scale(0.68)',
  piscis: 'translate(42 52) scale(0.68)',
  sagitario: 'translate(16 14) scale(0.68)',
  tauro: 'translate(29 44) scale(0.68)',
  virgo: 'translate(48 46) scale(0.68)',
}

// Inner-to-outer radius ratio of the 4-point star polygon. Lower
// values mean sharper "rays"; 0.32 matches the asterisk look in the
// reference design without crossing into a thin crucifix.
const STAR_INNER_RATIO = 0.32

// Steeper magnitude-to-radius curve than the astronomy module's
// generic helper: mag 1.5 anchors render ~3.5 px wider than mag 3.5
// secondaries, which reads as a clear visual hierarchy on a 290 px
// canvas. Clamps keep the brightest stars from devouring the canvas
// and the faintest from disappearing.
function starRadius(mag: number): number {
  // Bumped from `10 - 1.2 * mag` (clamp 2.5..9) so the asterism
  // reads more boldly now that the figure is no longer scaled
  // down 82% by the wrapper transform. Anchor stars (mag 1.5)
  // hit ~10.2 px, faint connectors (mag 3.9) sit around 7.3 px.
  const r = 12 - 1.2 * mag
  if (r < 4) return 4
  if (r > 11) return 11
  return r
}

// Days-since-marked → halo intensity multiplier for lit stars. Stars
// marked in the last week shine the brightest halo; halos fade across
// days 7..21 toward a floor that keeps old-lit stars visible without
// competing with recent ones. Two-segment piecewise linear keeps the
// shape readable and easy to tune.
function recencyHaloMultiplier(days: number): number {
  // TODAY's star (days === 0) gets a 1.45× boost — the figure
  // visibly responds to the coach copy ("Hoy encendiste X") with a
  // brighter halo on the same star, tying the words to the figure.
  if (days <= 0) return 1.45
  if (days <= 7) return 1 - (days / 7) * 0.45 // 1.0 → 0.55 over 7 days
  if (days <= 21) return 0.55 - ((days - 7) / 14) * 0.37 // 0.55 → 0.18 over next 14
  return 0.18 // floor — old stars still glow, just quietly
}

// 4-point star polygon path centred at (cx, cy). 8 alternating outer
// / inner vertices traced clockwise from 12 o'clock.
function fourPointStarPath(cx: number, cy: number, outer: number): string {
  const inner = outer * STAR_INNER_RATIO
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    pts.push(`${(cx + Math.cos(angle) * r).toFixed(2)},${(cy + Math.sin(angle) * r).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedLine = Animated.createAnimatedComponent(Line)
const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

const W = 290
const H = 290
// Inner padding around the figure. Lower values let the constellation
// spread closer to the canvas edges so the figure feels less cramped
// against the centre counter. The alpha's diffraction spikes extend
// ~r×7 (≈ 65 px) from its centre, so spikes near a PAD-edge can clip
// slightly — accepted as a "looking out through a porthole" framing
// rather than a layout bug.
const PAD = 18
const TARGET_DAYS = 28
// Bumped 22 → 60 for cosmic-depth feel (matches the Genshin-style
// nebula reference where the sky is generously populated, not
// sparse). Five buckets stagger the twinkle so the render cost
// stays one worklet per bucket regardless of star count.
const AMBIENT_STAR_COUNT = 60
const AMBIENT_BUCKET_COUNT = 5

// Per-element ignition duration. Stars take longer (flash+settle vs.
// a single stroke trace), and the queue waits this long before
// dequeuing the next element so each ignition gets to breathe.
const IGNITE_STAR_MS = 720
const IGNITE_LINE_MS = 520
const NUMBER_COUNTUP_MS = 800

type Resolved = {
  x: number
  y: number
  mag: number
}

// 'star'/'line' are figure elements; 'field' is a padding star — an
// unconnected point of sky added so a small figure still fills the
// whole 28-day cycle. See deriveProgress.
type SequenceEl = { type: 'star' | 'line' | 'field'; idx: number }

type Props = {
  /** 28-day boolean array; index i is the i-th cell. */
  trained: readonly boolean[]
  todayIdx: number
  sign?: ZodiacSign
  /** When true (today is already marked as complete), the "next"
   *  affordance — the dashed magenta ring around the upcoming star,
   *  and the dashed magenta segment for the next line — is hidden.
   *  Mirrors the app's philosophy that progress is a ritual, not a
   *  debt: once you've checked in today, the figure shouldn't be
   *  whispering "one more". The ring reappears the next day. */
  committed?: boolean
}

export function LunarConstellation({
  trained,
  todayIdx,
  sign = 'acuario',
  committed = false,
}: Props) {
  const zodiac = ZODIAC[sign]
  const cx = W / 2
  const cy = H / 2

  const { trainedCount, elementsLit, sequence, fieldStars, isComplete, intensity } = useMemo(
    () => deriveProgress(trained, todayIdx, zodiac),
    [trained, todayIdx, zodiac],
  )

  const stars: Resolved[] = useMemo(
    () =>
      zodiac.stars.map((s) => ({
        x: PAD + s.x * (W - 2 * PAD),
        y: PAD + s.y * (H - 2 * PAD),
        mag: s.mag,
      })),
    [zodiac],
  )

  // The figure's "alpha" — the star with the lowest magnitude. Used
  // to bias the nebula toward the alpha's quadrant so the sky has
  // directionality: the warm patch sits where the brightest star
  // radiates, the cool patch sits in the opposite quadrant. Without
  // this the canvas reads as a flat magenta wash; with it the
  // constellation feels placed somewhere specific in space.
  const alphaIdx = useMemo(() => {
    let minMag = Infinity
    let idx = 0
    for (let i = 0; i < stars.length; i++) {
      if (stars[i]!.mag < minMag) {
        minMag = stars[i]!.mag
        idx = i
      }
    }
    return idx
  }, [stars])

  const alphaPos = useMemo(() => {
    const a = stars[alphaIdx]
    return a ? { x: a.x, y: a.y } : { x: W / 2, y: H / 2 }
  }, [stars, alphaIdx])

  // BFS distance map from the alpha through the figure's line graph.
  // Drives the cascading "ripple" breath: the alpha pulses first, then
  // each shell of connected stars ~320 ms later. The constellation
  // feels like a neural network firing outward from a source instead
  // of a chorus chanting in unison — narrative weight on the alpha as
  // origin, with the rest of the figure responding to it.
  const starDepth = useMemo(() => {
    const adj: number[][] = stars.map(() => [])
    for (const [a, b] of zodiac.lines) {
      adj[a]?.push(b)
      adj[b]?.push(a)
    }
    const depth = new Map<number, number>()
    depth.set(alphaIdx, 0)
    const queue: number[] = [alphaIdx]
    while (queue.length > 0) {
      const u = queue.shift()!
      const d = depth.get(u) ?? 0
      for (const v of adj[u] ?? []) {
        if (depth.has(v)) continue
        depth.set(v, d + 1)
        queue.push(v)
      }
    }
    return depth
  }, [stars, zodiac.lines, alphaIdx])

  // Line depth = whichever of its endpoints is closer to the alpha.
  // A line lights up in sync with its nearest-to-alpha endpoint so
  // the wave radiates through stars and lines together.
  const lineDepth = useMemo(
    () =>
      zodiac.lines.map(([a, b]) => {
        const da = starDepth.get(a) ?? 0
        const db = starDepth.get(b) ?? 0
        return Math.min(da, db)
      }),
    [zodiac.lines, starDepth],
  )

  const litKeys = useMemo(() => {
    const set = new Set<string>()
    for (let i = 0; i < Math.min(elementsLit, sequence.length); i++) {
      const el = sequence[i]
      if (el) set.add(`${el.type}-${el.idx}`)
    }
    return set
  }, [elementsLit, sequence])

  // Centroid + radius of the LIT star cluster — drives a warm
  // cream-magenta wash that "bathes" the lit half of the figure
  // (LitClusterAura, rendered between FieldStars and LitLines so
  // every lit star sits inside the aura). Recomputed only when the
  // set of lit stars changes.
  const litCluster = useMemo(() => {
    const litStars: { x: number; y: number }[] = []
    for (let i = 0; i < stars.length; i++) {
      if (litKeys.has(`star-${i}`)) {
        const s = stars[i]
        if (s) litStars.push({ x: s.x, y: s.y })
      }
    }
    if (litStars.length === 0) return null
    // Centroid: simple mean of x/y.
    const cx = litStars.reduce((acc, p) => acc + p.x, 0) / litStars.length
    const cy = litStars.reduce((acc, p) => acc + p.y, 0) / litStars.length
    // Radius: max distance from centroid to any lit star, +24 padding
    // so the wash extends past the cluster edges into the surrounding
    // sky (otherwise the aura abruptly stops at the outer stars).
    const maxDist = litStars.reduce((acc, p) => Math.max(acc, Math.hypot(p.x - cx, p.y - cy)), 0)
    return { cx, cy, r: maxDist + 24, count: litStars.length }
  }, [stars, litKeys])

  // Map of lit-star idx → days since the user marked it. Reads:
  // recency 0 = today, 7 = a week ago, 27 = nearly four weeks ago.
  // Used by LitStar to scale its halo intensity — recent stars shine
  // bright, older ones taper to a quiet glow. Reinforces the app's
  // "body remembers recent rhythm more vividly than old" metaphor.
  const starRecency = useMemo(() => {
    const trainingDayIndices: number[] = []
    for (let i = 0; i <= todayIdx; i++) {
      if (trained[i]) trainingDayIndices.push(i)
    }
    const map = new Map<number, number>()
    for (let k = 0; k < Math.min(elementsLit, sequence.length); k++) {
      const el = sequence[k]
      if (el?.type !== 'star') continue
      const dayIdx = trainingDayIndices[k]
      if (dayIdx !== undefined) {
        map.set(el.idx, todayIdx - dayIdx)
      }
    }
    return map
  }, [trained, todayIdx, elementsLit, sequence])

  // When the user has marked today, suppress the "next" affordance so
  // neither the dashed ring around the upcoming star nor the dashed
  // line preview render. Tomorrow's render will set committed=false
  // again and the next affordance reappears.
  const nextEl: SequenceEl | null = committed ? null : (sequence[elementsLit] ?? null)

  // Two clocks share-drive every animation:
  //   t        — 8 s loop. Star breathing, ambient bucket twinkle,
  //              centre bloom ambient pulse, completion rings.
  //   slowT    — 5 s loop. The base silhouette breath so the
  //              placeholder lines+stars feel like a constellation
  //              waiting (not a static stamp), especially at count=0.
  //   breathT  — 16 s loop. Drives the cascading "ripple" breath —
  //              every cycle the alpha brightens first, then each
  //              shell of connected stars ~320 ms later, until the
  //              wave has rippled through the whole figure. The rest
  //              of the time each element twinkles independently.
  //              Reinforces "the alpha is the source; everything else
  //              is its light reaching outward".
  //   driftT   — 60 s loop. Slowly translates the two nebula patches
  //              along independent vector fields so the sky feels
  //              alive without distracting. Like clouds in a long
  //              exposure — perceptible only when you stare.
  // Single-thread clocks avoid spawning a timer per element.
  const t = useSharedValue(0)
  const slowT = useSharedValue(0)
  const breathT = useSharedValue(0)
  const driftT = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    slowT.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    breathT.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.linear }), -1, false)
    driftT.value = withRepeat(withTiming(1, { duration: 42000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(slowT)
      cancelAnimation(breathT)
      cancelAnimation(driftT)
    }
  }, [t, slowT, breathT, driftT])

  // ── Ignition engine ────────────────────────────────────────────────
  //
  // When `elementsLit` jumps up we want each newly-lit star/line to
  // play a one-shot flash before settling into its ambient state. The
  // engine has three moving parts:
  //   1. A queue of pending SequenceEl[] additions. Pushing to it
  //      kicks the dispatch effect.
  //   2. `ignitingKey` (the key currently mid-animation). While set,
  //      the regular lit/next layers skip it and IgnitingOverlay
  //      draws the flash on top.
  //   3. `igniteT` 0→1 shared value driving the flash and the line
  //      stroke trace. Reset to 0 + withTiming each dispatch.
  //
  // The bloom burst, number pulse and count-up fire once per tap
  // (regardless of how many elements bumped), since they live in the
  // centre and shouldn't strobe.
  const prevLitRef = useRef(elementsLit)
  const prevCountRef = useRef(trainedCount)
  const [ignitionQueue, setIgnitionQueue] = useState<SequenceEl[]>([])
  const [ignitingKey, setIgnitingKey] = useState<string | null>(null)
  // Increments once per upward commit — seeds the burst's per-commit
  // variability (spark count, jitter, hue) so no two fireworks match.
  const [burstId, setBurstId] = useState(0)

  const igniteT = useSharedValue(0)
  const numberPulse = useSharedValue(0)
  const displayedCount = useSharedValue(trainedCount)
  // 0→1→0 ripple of brightness across every star/line that is
  // already lit. Fires once per slider commit so the constellation
  // "breathes brighter" the moment the user marks the day.
  const litPulse = useSharedValue(0)
  // 0→1 radial wave that expands from the centre on each commit. Drives
  // a magenta ring expansion + a parallel placeholder-silhouette flash
  // so the WHOLE figure (lit + unlit) lights up momentarily, then
  // settles back to the current state.
  const radialPulse = useSharedValue(0)
  // 0→1 ramp fired once per upward commit — drives the floating "+1"
  // ghost that rises above the counter and fades. The literal
  // increment, made visible for ~700 ms then gone (a flourish, not
  // chrome). Stays at 0 on undo / first paint.
  const plusOne = useSharedValue(0)

  // Global presence multiplier for the constellation ray. The ray's
  // job is to SUGGEST the constellation path while the figure is
  // still being built; once every star is lit the actual figure
  // is fully visible and the bright ray competes with it instead
  // of helping. We tween this to 0 on isComplete so the ray
  // retires gracefully when the user finishes the 28-day cycle.
  const rayPresence = useSharedValue(isComplete ? 0 : 1)
  useEffect(() => {
    rayPresence.value = withTiming(isComplete ? 0 : 1, { duration: 900 })
  }, [isComplete, rayPresence])

  // Detect upward changes → fire haptic, run centre animations, push
  // new SequenceEls onto the queue. Downward changes (undo) just sync
  // the displayed number without replaying any animation.
  useEffect(() => {
    const prevLit = prevLitRef.current
    const prevCount = prevCountRef.current
    prevLitRef.current = elementsLit
    prevCountRef.current = trainedCount

    if (trainedCount === prevCount) return

    if (trainedCount < prevCount) {
      displayedCount.value = trainedCount
      return
    }

    displayedCount.value = withTiming(trainedCount, {
      duration: NUMBER_COUNTUP_MS,
      easing: Easing.out(Easing.cubic),
    })
    numberPulse.value = 0
    numberPulse.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.back(1.4)) }),
      withTiming(0, { duration: 340, easing: Easing.inOut(Easing.cubic) }),
    )
    // The "+1" ghost — a single 0→1 ramp; the overlay derives both
    // its rise and its fade from this value.
    plusOne.value = 0
    plusOne.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) })
    litPulse.value = 0
    litPulse.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 480, easing: Easing.inOut(Easing.cubic) }),
    )
    radialPulse.value = 0
    radialPulse.value = withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) })
    // Bump the burst seed so this firework varies from the last one.
    setBurstId((n) => n + 1)

    if (elementsLit > prevLit) {
      // Field stars don't run through the ignition flash — they just
      // fade in. Only figure stars/lines get the dramatic ignition.
      const newEls = sequence.slice(prevLit, elementsLit).filter((el) => el.type !== 'field')
      setIgnitionQueue((q) => [...q, ...newEls])
    }
    // The commit haptic is owned by the Hoy screen's action handlers
    // (a designed two-beat phrase) — the constellation no longer
    // fires its own single tick, which would double up.
  }, [
    trainedCount,
    elementsLit,
    sequence,
    displayedCount,
    numberPulse,
    litPulse,
    radialPulse,
    plusOne,
  ])

  // Drain the queue one element at a time. Each fire sets igniteT 0→1
  // over the element-typed duration, holds for 30ms post-completion,
  // then clears `ignitingKey` which retriggers this effect.
  useEffect(() => {
    if (ignitingKey != null || ignitionQueue.length === 0) return
    const [next, ...rest] = ignitionQueue
    if (!next) return
    setIgnitionQueue(rest)

    const key = `${next.type}-${next.idx}`
    const duration = next.type === 'line' ? IGNITE_LINE_MS : IGNITE_STAR_MS
    igniteT.value = 0
    igniteT.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) })
    setIgnitingKey(key)

    const timer = setTimeout(() => setIgnitingKey(null), duration + 30)
    return () => clearTimeout(timer)
  }, [ignitingKey, ignitionQueue, igniteT])

  return (
    <View style={styles.wrap}>
      <View style={styles.svgWrap}>
        <Svg viewBox={`0 0 ${W} ${H}`} style={styles.svg}>
          <SvgGradients />
          <DeepField drift={driftT} />
          <AmbientField t={t} drift={driftT} />
          {/* Random star winks — brief flashes that read as "the
              sky is alive". Rendered with the background field so
              they share the atmospheric layer. */}
          <StarWinks t={t} />
          {/* Three shooting stars staggered in phase and crossing
              the canvas at different heights — the field feels
              alive without any single streak being constant. */}
          <ShootingStar t={t} cycleDiv={1.6} phase={0} startY={40} endY={H * 0.55} />
          <ShootingStar t={t} cycleDiv={1.6} phase={0.42} startY={H * 0.15} endY={H * 0.85} />
          <ShootingStar t={t} cycleDiv={1.6} phase={0.74} startY={H * 0.7} endY={H * 0.3} />
          <AmbientGlow cx={cx} cy={cy} />
          <NebulaPatches ax={alphaPos.x} ay={alphaPos.y} drift={driftT} />
          {/* Cosmic dust — drifting motes catching ambient light.
              Sits between the nebula and the lion engraving so it
              feels like atmosphere passing through the foreground. */}
          <CosmicDust t={t} />
          {/* Atmospheric sign art — sits BEHIND the field stars and
              the animated constellation system. The strong card
              vignette below + the lion's already-faded opacity do
              the blending; a feathered SVG <Mask> wrapping this
              was tried but react-native-svg's Mask doesn't compose
              cleanly over nested SVGs (the lion disappeared). */}
          <ZodiacEngraving
            {...SIGN_ENGRAVINGS[sign]}
            progress={Math.min(1, trainedCount / TARGET_DAYS)}
            breathT={breathT}
          />
          {/* BalanceSwirls removed — the zodiac-art SVGs come with
              their own ornate decorative rings that balance the
              composition. The added Bézier strokes conflicted
              with the assets' hand-drawn ornaments. */}
          {/* Card vignette — frames the composition by darkening
              the corners, ties the atmospheric backdrop (nebula +
              lion) into a single body before the focal layer
              renders on top. */}
          <Rect x={0} y={0} width={W} height={H} fill="url(#cardVignette)" />
          {/* Vertical edge fade — separately dissolves top + bottom
              of the card into the page background so the art
              doesn't start/end on a hard horizontal line. */}
          <Rect x={0} y={0} width={W} height={H} fill="url(#cardEdgeFade)" />
          <FieldStars fieldStars={fieldStars} litKeys={litKeys} t={t} />
          {/* Animated constellation — stars + connecting lines that
              ignite day-by-day with progress. Now scaled 0.7 about
              the asterism's own centre + shifted so the figure
              sits INSIDE the ornate ring of the leo-new-art.svg
              backdrop instead of overflowing it.
              Math: scale-about-origin 0.7 shrinks the [40..260, 35..215]
              native bbox to [28..183, 24..150]; the leading
              translate(69, 57) brings the result back centred on
              the lion's body at canvas (174, 144). */}
          <G transform={SIGN_CONSTELLATION_TRANSFORM[sign]}>
            {litCluster ? (
              <>
                <LitClusterAura
                  cx={litCluster.cx}
                  cy={litCluster.cy}
                  r={litCluster.r}
                  breathT={breathT}
                />
                <LitClusterMotes cx={litCluster.cx} cy={litCluster.cy} r={litCluster.r} t={t} />
              </>
            ) : null}
            <BaseLayer
              zodiac={zodiac}
              stars={stars}
              slowT={slowT}
              radialPulse={radialPulse}
              t={t}
            />
            <LitLines
              zodiac={zodiac}
              stars={stars}
              litKeys={litKeys}
              nextEl={nextEl}
              ignitingKey={ignitingKey}
              litPulse={litPulse}
              breathT={breathT}
              lineDepth={lineDepth}
              t={t}
            />
            <StarsLayer
              stars={stars}
              litKeys={litKeys}
              nextEl={nextEl}
              t={t}
              ignitingKey={ignitingKey}
              intensity={intensity}
              litPulse={litPulse}
              starRecency={starRecency}
              breathT={breathT}
              starDepth={starDepth}
            />
            <IgnitingOverlay
              zodiac={zodiac}
              stars={stars}
              ignitingKey={ignitingKey}
              igniteT={igniteT}
            />
          </G>
          {/* CenterOrb + CenterScrim removed — they were the
              luminous well behind the giant centre number. With
              the count now living as a small chip at the canvas
              floor (numberRow.marginTop 122), the orb was an
              orphan magenta wash competing with the asterism. */}
          <StarBurst
            cx={cx}
            cy={cy}
            pulse={radialPulse}
            burstId={burstId}
            trainedCount={trainedCount}
          />
          {/* Anticipation crown — appears from day 21 onward, a
              tenue cream ring around the canvas centre that grows +
              brightens approaching day 28. Builds psychological
              tension for the final stretch. */}
          {trainedCount >= 21 && !isComplete ? (
            <AnticipationCrown
              cx={cx}
              cy={cy}
              proximity={Math.min(1, (trainedCount - 20) / 8)}
              breathT={breathT}
            />
          ) : null}
          {isComplete ? <CompletionRings cx={cx} cy={cy} t={t} /> : null}
        </Svg>
      </View>

      {/* Chip footer — count + denominator rendered as a proper
          footer row OUTSIDE the SVG, so the chip never overlaps
          the constellation lines. */}
      <CenterNumberOverlay
        displayedCount={displayedCount}
        numberPulse={numberPulse}
        plusOne={plusOne}
        initialCount={trainedCount}
        urgent={trainedCount >= TARGET_DAYS - 3 && !isComplete}
        remaining={Math.max(0, TARGET_DAYS - trainedCount)}
      />

      {isComplete ? (
        <View style={styles.completionCap}>
          <Text style={styles.completionLabel}>COMPLETO</Text>
        </View>
      ) : null}
    </View>
  )
}

/* Deterministic scatter of `count` unconnected "field" stars across
 * the canvas, kept clear of the centre counter and of the figure's
 * own stars. Same positions every render (seeded by index). */
function buildFieldStars(
  figureStars: readonly { x: number; y: number }[],
  count: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  let i = 0
  while (out.length < count && i < count * 60 + 60) {
    const a = Math.sin(i * 73.13 + 2.1)
    const b = Math.sin(i * 31.77 + 5.9)
    i++
    const x = 0.06 + ((Math.abs(a) * 1000) % 1) * 0.88
    const y = 0.06 + ((Math.abs(b) * 1000) % 1) * 0.88
    // Skip the centre — that's where the day counter sits.
    const dcx = x - 0.5
    const dcy = y - 0.5
    if (dcx * dcx + dcy * dcy < 0.21 * 0.21) continue
    // Skip anything sitting on top of a figure star.
    let collides = false
    for (const fs of figureStars) {
      const ex = x - fs.x
      const ey = y - fs.y
      if (ex * ex + ey * ey < 0.065 * 0.065) {
        collides = true
        break
      }
    }
    if (collides) continue
    out.push({ x, y })
  }
  return out
}

function deriveProgress(
  trained: readonly boolean[],
  todayIdx: number,
  zodiac: ZodiacDef,
): {
  trainedCount: number
  elementsLit: number
  sequence: SequenceEl[]
  fieldStars: { x: number; y: number }[]
  isComplete: boolean
  /** Overflow intensifier — now always 0: the figure is padded with
   *  field stars to exactly TARGET_DAYS elements, so there is never
   *  an overflow phase. Kept in the shape for LitStar's signature. */
  intensity: number
} {
  const count = trained.slice(0, todayIdx + 1).filter(Boolean).length
  const nStars = zodiac.stars.length

  // ── Figure sequence — stars + lines, each line preceded by both
  //    its endpoint stars; leftover stars trail at the end. ──
  const figureSeq: SequenceEl[] = []
  const seen = new Set<number>()
  if (nStars > 0) {
    figureSeq.push({ type: 'star', idx: 0 })
    seen.add(0)
  }
  zodiac.lines.forEach((ln, lineIdx) => {
    const [a, b] = ln
    if (!seen.has(a)) {
      figureSeq.push({ type: 'star', idx: a })
      seen.add(a)
    }
    if (!seen.has(b)) {
      figureSeq.push({ type: 'star', idx: b })
      seen.add(b)
    }
    figureSeq.push({ type: 'line', idx: lineIdx })
  })
  for (let i = 0; i < nStars; i++) {
    if (!seen.has(i)) figureSeq.push({ type: 'star', idx: i })
  }

  // ── Pad to TARGET_DAYS with field stars so a small figure (e.g.
  //    the 11-element Aries) still fills across the whole 28-day
  //    cycle instead of completing on day 11. ──
  const figureCount = figureSeq.length
  const fieldStars = buildFieldStars(zodiac.stars, Math.max(0, TARGET_DAYS - figureCount))

  // ── Interleave figure elements and field stars evenly, so the
  //    figure itself keeps growing across the whole cycle rather
  //    than finishing first and the field trailing after. ──
  const total = figureCount + fieldStars.length
  const seq: SequenceEl[] = []
  let fi = 0
  let pi = 0
  for (let k = 0; k < total; k++) {
    const figureTarget = Math.round(((k + 1) * figureCount) / total)
    if (fi < figureTarget && fi < figureCount) {
      seq.push(figureSeq[fi]!)
      fi++
    } else {
      seq.push({ type: 'field', idx: pi })
      pi++
    }
  }

  return {
    trainedCount: count,
    elementsLit: Math.min(count, seq.length),
    sequence: seq,
    fieldStars,
    isComplete: count >= TARGET_DAYS,
    intensity: 0,
  }
}

function SvgGradients() {
  return (
    <Defs>
      <RadialGradient id="starLit" cx="35%" cy="35%">
        <Stop offset="0%" stopColor="#FFF6E5" />
        <Stop offset="55%" stopColor="#F4ECDE" />
        <Stop offset="100%" stopColor="#C9B8A5" />
      </RadialGradient>
      <RadialGradient id="starNext" cx="35%" cy="35%">
        <Stop offset="0%" stopColor="#FFB8D4" />
        <Stop offset="55%" stopColor="#E91E63" />
        <Stop offset="100%" stopColor="#7A1737" />
      </RadialGradient>
      {/* Lit-cluster aura — warm cream-pink wash bathing the lit
          half of the constellation. Bright cream at the centre
          fades to transparent magenta at the rim. Centre + mid
          opacities bumped (0.85→0.95, 0.45→0.6) so the lit area
          glows with enough warmth to compete with the bronze
          lion behind it instead of being absorbed by it. */}
      <RadialGradient id="litClusterAura" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor="#FFE9D6" stopOpacity={0.95} />
        <Stop offset="45%" stopColor="#F4ECDE" stopOpacity={0.6} />
        <Stop offset="100%" stopColor="#D9AE6F" stopOpacity={0} />
      </RadialGradient>
      {/* Card vignette — transparent at the centre, dark at the
          edges. Painted as a full-canvas <Rect fill="url(#cardVignette)" />
          sitting between the atmospheric backdrop (nebula + lion)
          and the focal layer (field stars + constellation). Frames
          the composition without dimming the lit stars. */}
      <RadialGradient id="cardVignette" cx="50%" cy="50%" r="75%">
        <Stop offset="0%" stopColor={colors.bg} stopOpacity={0} />
        <Stop offset="40%" stopColor={colors.bg} stopOpacity={0.14} />
        <Stop offset="70%" stopColor={colors.bg} stopOpacity={0.45} />
        <Stop offset="100%" stopColor={colors.bg} stopOpacity={0.85} />
      </RadialGradient>
      {/* Edge fade — linear vertical gradient that softens
          specifically the top + bottom of the card into the page
          bg. The radial vignette darkens corners; this one
          dissolves the horizontal edges so the lion art bleeds
          into the page above and below instead of starting on a
          hard line. */}
      <LinearGradient id="cardEdgeFade" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor={colors.bg} stopOpacity={1} />
        <Stop offset="6%" stopColor={colors.bg} stopOpacity={0.85} />
        <Stop offset="14%" stopColor={colors.bg} stopOpacity={0.45} />
        <Stop offset="24%" stopColor={colors.bg} stopOpacity={0} />
        <Stop offset="76%" stopColor={colors.bg} stopOpacity={0} />
        <Stop offset="86%" stopColor={colors.bg} stopOpacity={0.45} />
        <Stop offset="94%" stopColor={colors.bg} stopOpacity={0.85} />
        <Stop offset="100%" stopColor={colors.bg} stopOpacity={1} />
      </LinearGradient>
    </Defs>
  )
}

/* Persistent magenta ambient wash that sits behind the constellation
 * at rest — the "this is where your figure lives" mood light.
 *
 * 12 concentric ellipses with uniform low alpha and uniform radial
 * spacing fake a radial gradient without using <RadialGradient> (which
 * has known iOS issues with alpha stops in react-native-svg). With
 * this many layers, no individual edge is perceptible — the eye reads
 * a smooth falloff. Each layer adds the same alpha increment, so the
 * accumulated opacity falls linearly from ~0.26 at the centre to ~0
 * at the outer rim. Horizontal aspect ~1.45 : 1 matches the
 * constellation's typical spread.
 *
 * Static — no animation — so the eye reads it as the scene's lighting,
 * not as an effect. */
const AMBIENT_LAYERS = 12
const AMBIENT_PER_LAYER_ALPHA = 0.022
const AMBIENT_RX_MAX = W * 0.6
const AMBIENT_RX_MIN = W * 0.08
const AMBIENT_ASPECT = 1.45

function AmbientGlow({ cx, cy }: { cx: number; cy: number }) {
  return (
    <G>
      {Array.from({ length: AMBIENT_LAYERS }).map((_, i) => {
        const tt = i / (AMBIENT_LAYERS - 1)
        const rx = AMBIENT_RX_MAX - (AMBIENT_RX_MAX - AMBIENT_RX_MIN) * tt
        const ry = rx / AMBIENT_ASPECT
        return (
          <Ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill={colors.magenta}
            opacity={AMBIENT_PER_LAYER_ALPHA}
          />
        )
      })}
    </G>
  )
}

/* ─ Nebula patches — directional immersive sky ───────────────────
 *
 * Four off-centre ellipse stacks that build a Genshin-style deep
 * cosmic backdrop. Each patch is a stack of layered ellipses that
 * dodges the iOS RadialGradient alpha-stop bug:
 *
 *  • WARM    — magenta-granate, biased to the alpha quadrant.
 *              The gas the brightest star illuminates.
 *  • COOL    — dark ciruela/violet, opposite quadrant.
 *              The cold half of the sky.
 *  • DEEP    — concentrated magenta haze near the centre.
 *              Focal warmth where the constellation lives.
 *  • BRONZE  — warm gold haze offset to the upper-right.
 *              Ties the bronze lion engraving into the atmosphere.
 *
 * Each patch drifts on its own phase so the sky reads as weather,
 * not a synchronised loop.
 */
const NEBULA_LAYERS = 13

function NebulaPatches({
  ax,
  ay,
  drift,
}: {
  ax: number
  ay: number
  /** 60 s loop. Drives the slow translate of all patches so the
   *  sky drifts like clouds in a long exposure. */
  drift: SharedValue<number>
}) {
  const cx = W / 2
  const cy = H / 2
  const wx = cx + (ax - cx) * 0.6
  const wy = cy + (ay - cy) * 0.6
  const ccx = cx - (wx - cx)
  const ccy = cy - (wy - cy)
  // Bronze patch — biased opposite to the cool, in the warm-gold
  // upper-right quadrant where the lion's mane wraps.
  const bx = cx + 60
  const by = cy - 40

  // Four phase-shifted drift vectors. Different amplitudes + phase
  // offsets so no two patches travel in lockstep. Each patch also
  // breathes brightness on its own long cycle so the nebula feels
  // like weather, not a layered loop — clouds catching variable
  // light from off-screen sources.
  const warmDrift = useAnimatedProps(() => {
    'worklet'
    const a = drift.value * 2 * Math.PI
    const breath = 0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.7)
    return {
      transform: [{ translateX: Math.sin(a) * 22 }, { translateY: Math.cos(a) * 14 }],
      opacity: 0.65 + 0.35 * breath,
    }
  })
  const coolDrift = useAnimatedProps(() => {
    'worklet'
    const a = drift.value * 2 * Math.PI + Math.PI * 0.7
    const breath = 0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.45 + Math.PI * 0.4)
    return {
      transform: [{ translateX: Math.sin(a) * 18 }, { translateY: Math.cos(a) * 24 }],
      opacity: 0.55 + 0.45 * breath,
    }
  })
  const deepDrift = useAnimatedProps(() => {
    'worklet'
    const a = drift.value * 2 * Math.PI + Math.PI * 1.3
    const breath = 0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.55 + Math.PI * 1.1)
    return {
      transform: [{ translateX: Math.sin(a) * 10 }, { translateY: Math.cos(a) * 8 }],
      opacity: 0.6 + 0.4 * breath,
    }
  })
  const bronzeDrift = useAnimatedProps(() => {
    'worklet'
    const a = drift.value * 2 * Math.PI + Math.PI * 0.35
    const breath = 0.5 + 0.5 * Math.sin(drift.value * 2 * Math.PI * 0.85 + Math.PI * 0.6)
    return {
      transform: [{ translateX: Math.sin(a) * 16 }, { translateY: Math.cos(a) * 12 }],
      opacity: 0.5 + 0.5 * breath,
    }
  })

  return (
    <G>
      <AnimatedG animatedProps={warmDrift}>
        {Array.from({ length: NEBULA_LAYERS }).map((_, i) => {
          const tt = i / (NEBULA_LAYERS - 1)
          const rx = 195 - 140 * tt
          const ry = rx * 0.78
          const op = 0.018 + tt * 0.04
          return (
            <Ellipse key={`nw-${i}`} cx={wx} cy={wy} rx={rx} ry={ry} fill="#5A1438" opacity={op} />
          )
        })}
      </AnimatedG>
      <AnimatedG animatedProps={coolDrift}>
        {Array.from({ length: NEBULA_LAYERS }).map((_, i) => {
          const tt = i / (NEBULA_LAYERS - 1)
          const rx = 165 - 115 * tt
          const ry = rx * 1.18
          const op = 0.013 + tt * 0.025
          return (
            <Ellipse
              key={`nc-${i}`}
              cx={ccx}
              cy={ccy}
              rx={rx}
              ry={ry}
              fill="#2A1838"
              opacity={op}
            />
          )
        })}
      </AnimatedG>
      <AnimatedG animatedProps={deepDrift}>
        {Array.from({ length: NEBULA_LAYERS }).map((_, i) => {
          const tt = i / (NEBULA_LAYERS - 1)
          const rx = 130 - 95 * tt
          const ry = rx * 0.92
          const op = 0.014 + tt * 0.035
          return (
            <Ellipse key={`nd-${i}`} cx={cx} cy={cy} rx={rx} ry={ry} fill="#A6164A" opacity={op} />
          )
        })}
      </AnimatedG>
      <AnimatedG animatedProps={bronzeDrift}>
        {Array.from({ length: NEBULA_LAYERS }).map((_, i) => {
          const tt = i / (NEBULA_LAYERS - 1)
          const rx = 110 - 75 * tt
          const ry = rx * 1.05
          // Warm bronze tone — ties to the lion engraving's palette.
          const op = 0.009 + tt * 0.018
          return (
            <Ellipse key={`nb-${i}`} cx={bx} cy={by} rx={rx} ry={ry} fill="#7A5A38" opacity={op} />
          )
        })}
      </AnimatedG>
    </G>
  )
}

/* ─ Centre orb — luminous gravitational well behind the day count ──
 *
 * A stack of concentric magenta circles sitting under the centre
 * counter. Replaces the prior "number floats on dark scrim" read
 * with "number lives inside a glowing core" — the heart of the
 * cycle. The CenterScrim still renders on top of this orb (smaller
 * radius) so the digits stay legible against a darker pocket inside
 * a wider magenta glow.
 *
 * Slow 8 s breath (4 % scale swing) keeps the orb subtly alive
 * without competing with the star twinkle. */
const ORB_LAYERS = 10

function CenterOrb({ cx, cy, clock }: { cx: number; cy: number; clock: SharedValue<number> }) {
  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    const scale = 1 + wave * 0.04
    return {
      transform: [
        { translateX: cx },
        { translateY: cy },
        { scale },
        { translateX: -cx },
        { translateY: -cy },
      ],
    }
  })
  return (
    <AnimatedG animatedProps={breath}>
      {Array.from({ length: ORB_LAYERS }).map((_, i) => {
        const tt = i / (ORB_LAYERS - 1)
        // 92 → 28 px. Outer layers are wide and faint; inner layers
        // tight and slightly brighter so the stack reads as a glow
        // with a luminous heart.
        const r = 92 - 64 * tt
        const op = 0.018 + tt * 0.05
        return <Circle key={i} cx={cx} cy={cy} r={r} fill={colors.magenta} opacity={op} />
      })}
      {/* Hot cream-pink core right under the number — adds the
          "white-hot heart" feel without competing with type colour. */}
      <Circle cx={cx} cy={cy} r={20} fill="#FBD7E3" opacity={0.08} />
    </AnimatedG>
  )
}

/* ─ Ambient star field ──────────────────────────────────────────── */

type AmbientStar = { x: number; y: number; r: number; baseOp: number; sparkle: boolean }

// Deterministic field that avoids the centre block where the day
// counter lives. The seed math is intentionally noisy — `Math.sin` of
// large integers gives us a stable pseudo-random sequence without
// pulling in a PRNG. Stars are bucketed by index so the twinkle stays
// cheap (one worklet per bucket, not per star).
function buildAmbientField(): AmbientStar[][] {
  const buckets: AmbientStar[][] = Array.from({ length: AMBIENT_BUCKET_COUNT }, () => [])
  for (let i = 0; i < AMBIENT_STAR_COUNT; i++) {
    const a = Math.sin(i * 47.1 + 3.7)
    const b = Math.sin(i * 91.3 + 1.1)
    const x = ((((a * 9301 + 49297) % 1) + 1) % 1) * W
    const y = ((((b * 8101 + 26183) % 1) + 1) % 1) * H
    const dx = x - W / 2
    const dy = y - H / 2
    if (dx * dx + dy * dy < 3200) continue
    // Varied magnitudes for depth — most stars tiny + dim, but a
    // few are larger + brighter to fake parallax distance. The
    // brightest ~10% earn a 4-point sparkle so they feel like
    // background gems catching light, not just dots.
    const mag = Math.abs(a * b)
    const baseOp = 0.03 + mag * 0.22
    const r = 0.3 + Math.abs(a) * 1.7
    const sparkle = mag > 0.55
    const bucket = i % AMBIENT_BUCKET_COUNT
    buckets[bucket]!.push({ x, y, r, baseOp, sparkle })
  }
  return buckets
}

/* ─ Right-side balance swirls — composition counterweight ─────────
 *
 * Three bronze Bézier hairlines anchored to the right half of the
 * canvas so the lion engraving (left-heavy) doesn't tilt the
 * composition. Each drifts independently on the 60 s clock with a
 * tiny opacity breath, so they read as atmospheric tracery rather
 * than UI lines.
 */
const BALANCE_PATHS: readonly { d: string; phase: number; op: number }[] = [
  { d: 'M 230 80 Q 270 130 240 200', phase: 0.0, op: 0.2 },
  { d: 'M 255 175 Q 280 215 230 250', phase: 0.27, op: 0.17 },
  { d: 'M 200 60 Q 240 95 280 65', phase: 0.52, op: 0.15 },
  // Fourth ascending curve sweeping upward on the right — adds
  // visual weight to balance the lion silhouette on the left.
  { d: 'M 215 240 Q 260 200 270 130', phase: 0.78, op: 0.18 },
]

function BalanceSwirls({ drift }: { drift: SharedValue<number> }) {
  return (
    <G>
      {BALANCE_PATHS.map((p, i) => (
        <BalanceSwirl key={i} d={p.d} phase={p.phase} op={p.op} drift={drift} />
      ))}
    </G>
  )
}

function BalanceSwirl({
  d,
  phase,
  op,
  drift,
}: {
  d: string
  phase: number
  op: number
  drift: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const a = (drift.value + phase) * 2 * Math.PI
    const breath = 0.5 + 0.5 * Math.sin(a)
    return {
      opacity: op * (0.6 + 0.6 * breath),
      transform: [{ translateX: Math.sin(a) * 3 }, { translateY: Math.cos(a) * 2 }],
    }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      <Path d={d} stroke="#C9B8A5" strokeWidth={0.8} strokeLinecap="round" fill="none" />
    </AnimatedG>
  )
}

/* ─ Cosmic dust — slow rising motes ───────────────────────────────
 *
 * A small constellation-adjacent magic: 7 tiny cream particles that
 * slowly rise from the bottom of the canvas to the top, swaying
 * gently as they drift. Each has its own period + phase so the
 * field never reads as a synchronised loop — it reads as ambient
 * weather, like floating pollen catching starlight.
 *
 * Visible duty: fades in at 0..0.12 of cycle, full alpha through
 * the middle, fades out at 0.88..1. Each particle spends most of
 * the cycle off-canvas (well below or above), so at any moment
 * only ~3-4 are actually visible.
 */

type DustParticle = {
  /** X anchor 0..1 (will be multiplied by W). */
  x: number
  /** Sway amplitude in pixels. */
  sway: number
  /** Cycle period — divisor of `t` (which is an 8 s clock).
   *  E.g. period = 1.6 → particle rises every 12.8 s. */
  period: number
  /** Phase offset 0..1 so particles are staggered. */
  phase: number
  /** Particle radius in px. */
  r: number
  /** Peak opacity. */
  opacity: number
}

const DUST: readonly DustParticle[] = [
  { x: 0.18, sway: 8, period: 1.6, phase: 0.0, r: 0.9, opacity: 0.55 },
  { x: 0.32, sway: 5, period: 2.1, phase: 0.27, r: 0.6, opacity: 0.4 },
  { x: 0.48, sway: 10, period: 1.8, phase: 0.55, r: 1.1, opacity: 0.6 },
  { x: 0.62, sway: 6, period: 2.4, phase: 0.13, r: 0.7, opacity: 0.45 },
  { x: 0.74, sway: 9, period: 1.7, phase: 0.71, r: 0.8, opacity: 0.5 },
  { x: 0.86, sway: 4, period: 2.2, phase: 0.41, r: 0.55, opacity: 0.4 },
  { x: 0.08, sway: 7, period: 1.95, phase: 0.84, r: 0.75, opacity: 0.45 },
] as const

function CosmicDust({ t }: { t: SharedValue<number> }) {
  return (
    <G>
      {DUST.map((p, i) => (
        <DustMote key={i} particle={p} t={t} />
      ))}
    </G>
  )
}

function DustMote({ particle, t }: { particle: DustParticle; t: SharedValue<number> }) {
  const baseX = particle.x * W
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = (t.value / particle.period + particle.phase) % 1
    // Travel from H + 20 (below) to -20 (above) as u goes 0→1.
    const y = H + 20 - u * (H + 40)
    // Horizontal sway — full sine over the rise.
    const x = baseX + Math.sin(u * Math.PI * 2) * particle.sway
    // Fade in 0..0.12, hold, fade out 0.88..1.
    let op = particle.opacity
    if (u < 0.12) op *= u / 0.12
    else if (u > 0.88) op *= 1 - (u - 0.88) / 0.12
    return { cx: x, cy: y, opacity: op }
  })
  return (
    <AnimatedCircle
      cx={baseX}
      cy={H + 20}
      r={particle.r}
      fill="#FFF6E5"
      animatedProps={animatedProps}
    />
  )
}

/* ─ Star winks — random brief flashes ──────────────────────────────
 *
 * Five deterministic positions scattered around the canvas (away
 * from the constellation centre and the day-count chip), each
 * winks for ~350 ms on a 5 s cycle, staggered so a wink occurs
 * every ~1 s on average. Sells "the sky is alive" without
 * tipping into noise.
 */

const WINK_POSITIONS = [
  { x: 0.16, y: 0.18, period: 4.4, phase: 0.0, size: 3.6 },
  { x: 0.84, y: 0.24, period: 5.2, phase: 0.27, size: 2.8 },
  { x: 0.78, y: 0.78, period: 4.7, phase: 0.51, size: 3.2 },
  { x: 0.22, y: 0.62, period: 5.6, phase: 0.73, size: 2.6 },
  { x: 0.52, y: 0.08, period: 4.9, phase: 0.39, size: 3.0 },
] as const

function StarWinks({ t }: { t: SharedValue<number> }) {
  return (
    <G>
      {WINK_POSITIONS.map((w, i) => (
        <StarWink key={i} wink={w} t={t} />
      ))}
    </G>
  )
}

function StarWink({ wink, t }: { wink: (typeof WINK_POSITIONS)[number]; t: SharedValue<number> }) {
  const cx = wink.x * W
  const cy = wink.y * H
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = (t.value / wink.period + wink.phase) % 1
    // Active window: first 7 % of cycle ≈ 350 ms at period 5 s.
    if (u > 0.07) return { opacity: 0 }
    const local = u / 0.07 // 0..1 across the wink
    // Triangular envelope: rise 0..0.4 then fall 0.4..1
    const env = local < 0.4 ? local / 0.4 : 1 - (local - 0.4) / 0.6
    return { opacity: env }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      <Path d={fourPointStarPath(cx, cy, wink.size)} fill="#FFFFFF" />
      <Circle cx={cx} cy={cy} r={wink.size * 0.35} fill="#FFFFFF" />
    </AnimatedG>
  )
}

/* ─ Shooting star — ambient magic ──────────────────────────────────
 *
 * A small bright streak that crosses the canvas diagonally every ~10 s.
 * Active for only ~1.5 s per cycle (15% duty); the other 85% the
 * shooting star is fully transparent so the user perceives it as a
 * rare ambient event, not a recurring loop.
 *
 * Implementation: reuses the 8 s `t` clock at a slower modulo so we
 * don't spawn another timer. Position lerps from upper-left to lower-
 * right with a small head trail.
 */
function ShootingStar({
  t,
  cycleDiv = 1.6,
  phase = 0,
  startY = 40,
  endY = H * 0.55,
  active = 0.07,
}: {
  t: SharedValue<number>
  /** Slower divisor = rarer; faster = more frequent. */
  cycleDiv?: number
  /** 0..1 offset within the cycle so multiple shooting stars stagger. */
  phase?: number
  startY?: number
  endY?: number
  /** Fraction of the cycle the streak is visible. */
  active?: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const cycle = (t.value / cycleDiv + phase) % 1
    if (cycle >= active) return { opacity: 0, cx: -10, cy: -10 }
    const local = cycle / active
    const startX = -20
    const endX = W + 20
    const x = startX + (endX - startX) * local
    const y = startY + (endY - startY) * local
    let op = 1
    if (local < 0.15) op = local / 0.15
    else if (local > 0.7) op = 1 - (local - 0.7) / 0.3
    return { opacity: op, cx: x, cy: y }
  })

  const trailProps = useAnimatedProps(() => {
    'worklet'
    const cycle = (t.value / cycleDiv + phase) % 1
    if (cycle >= active) return { opacity: 0, x1: -10, y1: -10, x2: -10, y2: -10 }
    const local = cycle / active
    const startX = -20
    const endX = W + 20
    const x = startX + (endX - startX) * local
    const y = startY + (endY - startY) * local
    const tailLen = 26
    const dx = (endX - startX) / Math.hypot(endX - startX, endY - startY)
    const dy = (endY - startY) / Math.hypot(endX - startX, endY - startY)
    let op = 0.6
    if (local < 0.15) op = (local / 0.15) * 0.6
    else if (local > 0.7) op = (1 - (local - 0.7) / 0.3) * 0.6
    return { opacity: op, x1: x - dx * tailLen, y1: y - dy * tailLen, x2: x, y2: y }
  })

  return (
    <G>
      <AnimatedLine
        x1={0}
        y1={0}
        x2={0}
        y2={0}
        stroke="#FFFFFF"
        strokeWidth={1.4}
        strokeLinecap="round"
        animatedProps={trailProps}
      />
      <AnimatedCircle cx={0} cy={0} r={2.2} fill="#FFFFFF" animatedProps={animatedProps} />
    </G>
  )
}

/* ─ Burst effect — round firework on each commit ───────────────────
 *
 * On every day-mark, a bright magenta core flashes at centre and
 * PARTICLE_COUNT sparks burst out as a round firework: the sparks are
 * spaced at even angles and all travel the same reach, so their heads
 * stay on one expanding circle. Each spark is a streak — the segment
 * between its position now and a beat earlier — radiating cleanly
 * outward, then flickering and fading. No gravity, no per-spark
 * jitter: the ring stays perfectly circular.
 *
 * Driven by the parent's `radialPulse` SharedValue 0→1.
 */
function StarBurst({
  cx,
  cy,
  pulse,
  burstId,
  trainedCount,
}: {
  cx: number
  cy: number
  pulse: SharedValue<number>
  /** Increments once per commit — seeds the per-burst variability so
   *  no two fireworks render the same frame (a fixed burst
   *  habituates fast). */
  burstId: number
  /** Day count — drives the early-window (days 2–12) amplification
   *  that flattens the post-day-1 reward cliff. */
  trainedCount: number
}) {
  return (
    <G>
      <BurstCore cx={cx} cy={cy} pulse={pulse} />
      <ParticleBurst cx={cx} cy={cy} pulse={pulse} burstId={burstId} trainedCount={trainedCount} />
    </G>
  )
}

const PARTICLE_BASE = 28 // spark count varies ±~20% around this
const PARTICLE_REACH = 120 // baseline radial reach (px)

/* Deterministic 0..1 hash — gives per-(burst, spark) variation
 * without a real RNG, so a given burst is reproducible but no two
 * are alike. */
function burstHash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

// Magenta-family hues — the per-spark micro-shift stays inside the
// brand. The burst never changes *kind*, only texture.
const SPARK_HUES = [colors.magenta, colors.magentaHot, '#FF8FC0']

function ParticleBurst({
  cx,
  cy,
  pulse,
  burstId,
  trainedCount,
}: {
  cx: number
  cy: number
  pulse: SharedValue<number>
  burstId: number
  trainedCount: number
}) {
  // Every 5th commit is an amplified "bigger moment" — a cadence the
  // user can't quite predict, which keeps the reward-prediction error
  // (and so the dopamine) alive.
  const big = burstId > 0 && burstId % 5 === 0
  // Early-window boost — days 2–12 get extra sparks, decaying from
  // ~1.4× on day 2 to 1.0× by day 12. Flattens the cliff after the
  // big day-1 celebration: the fragile habit-forming window gets
  // *more* reward, not a sudden drop to baseline.
  const earlyBoost =
    trainedCount >= 2 && trainedCount <= 12 ? 1 + 0.4 * ((12 - trainedCount) / 10) : 1
  const base = big ? 46 : PARTICLE_BASE + Math.floor(burstHash(burstId, 1) * 9) - 4
  const count = Math.min(54, Math.round(base * earlyBoost))
  return (
    <G>
      {Array.from({ length: count }).map((_, i) => (
        <ParticleSpark
          key={i}
          cx={cx}
          cy={cy}
          index={i}
          count={count}
          burstId={burstId}
          big={big}
          pulse={pulse}
        />
      ))}
    </G>
  )
}

/* One firework spark. Shoots straight out along its radial angle
 * (ease-out — explosive launch, then air drag), flickers, fades.
 * Rendered as the streak between the head (position now) and the tail
 * (position a beat earlier). Angle, reach and hue carry a small
 * per-commit jitter so the ring is organic, never a stamped circle. */
function ParticleSpark({
  cx,
  cy,
  index,
  count,
  burstId,
  big,
  pulse,
}: {
  cx: number
  cy: number
  index: number
  count: number
  burstId: number
  big: boolean
  pulse: SharedValue<number>
}) {
  // Even spacing + a small per-spark angular jitter — the ring breathes.
  const jitter = (burstHash(burstId, index) - 0.5) * 0.16
  const angle = (index / count) * Math.PI * 2 + jitter
  // A handful of sparks fly noticeably further — a different
  // silhouette every commit.
  const isLong = burstHash(burstId, index * 3 + 5) > 0.86
  const reachMul =
    (0.85 + burstHash(burstId, index + 40) * 0.3) * (isLong ? 1.5 : 1) * (big ? 1.22 : 1)
  const reach = PARTICLE_REACH * reachMul
  const color =
    SPARK_HUES[Math.floor(burstHash(burstId, index + 7) * SPARK_HUES.length)] ?? colors.magenta
  const width = 2 + Math.abs(Math.sin(index * 17.3)) * 0.8
  const dirX = Math.cos(angle)
  const dirY = Math.sin(angle)
  const flickPhase = (index * 0.37) % 1

  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = pulse.value
    if (u <= 0 || u >= 1) {
      return { x1: -20, y1: -20, x2: -20, y2: -20, opacity: 0 }
    }
    // ease-out radial travel for the head; the tail trails a beat
    // behind.
    const lag = 0.08
    const uTail = u < lag ? 0 : u - lag
    const tHead = 1 - (1 - u) * (1 - u)
    const tTail = 1 - (1 - uTail) * (1 - uTail)
    const xHead = cx + dirX * reach * tHead
    const yHead = cy + dirY * reach * tHead
    const xTail = cx + dirX * reach * tTail
    const yTail = cy + dirY * reach * tTail
    // fast fade-in, long fade-out, plus a fast flicker.
    const fade = u < 0.06 ? u / 0.06 : 1 - (u - 0.06) / 0.94
    const flicker = 0.7 + 0.3 * Math.sin(u * 70 + flickPhase * 6.283)
    return { x1: xTail, y1: yTail, x2: xHead, y2: yHead, opacity: fade * flicker }
  })

  return (
    <AnimatedLine
      x1={cx}
      y1={cy}
      x2={cx}
      y2={cy}
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      animatedProps={animatedProps}
    />
  )
}

/* Bright magenta filled core. Pops in the first 25% of the pulse and
 * is gone by ~50%, so it reads as the ignition point that the three
 * stars expand outward from. Fill + scale, no stroke — this is the
 * "spark", not the "wave". */
function BurstCore({ cx, cy, pulse }: { cx: number; cy: number; pulse: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = pulse.value
    let op = 0
    if (u < 0.2) op = 0.95 * (u / 0.2)
    else if (u < 0.45) op = 0.95 * (1 - (u - 0.2) / 0.25)
    const r = 4 + u * 14
    return { r, opacity: op }
  })
  return (
    <AnimatedCircle cx={cx} cy={cy} r={4} fill={colors.magenta} animatedProps={animatedProps} />
  )
}

// Ultra-far depth layer — 30 micro-stars at very low opacity that
// drift 6× slower than the ambient field. Pure parallax cue: you
// rarely notice them, but their slow shift behind the ambient field
// adds real depth to the cosmos.
type DeepStar = { x: number; y: number; r: number; op: number }

const DEEP_STARS: DeepStar[] = (() => {
  const out: DeepStar[] = []
  for (let i = 0; i < 30; i++) {
    const a = Math.sin(i * 53.3 + 7.1)
    const b = Math.sin(i * 71.9 + 2.7)
    const x = ((((a * 9301 + 49297) % 1) + 1) % 1) * W
    const y = ((((b * 8101 + 26183) % 1) + 1) % 1) * H
    // Keep deep stars out of the immediate center where the chip lives.
    const dx = x - W / 2
    const dy = y - H / 2
    if (dx * dx + dy * dy < 2400) continue
    const r = 0.3 + Math.abs(a) * 0.4
    const op = 0.06 + Math.abs(a * b) * 0.1
    out.push({ x, y, r, op })
  }
  return out
})()

function DeepField({ drift }: { drift: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const a = drift.value * 2 * Math.PI * 0.15
    return {
      transform: [{ translateX: Math.sin(a) * 4 }, { translateY: Math.cos(a) * 3 }],
    }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {DEEP_STARS.map((s, i) => (
        <Circle key={`d-${i}`} cx={s.x} cy={s.y} r={s.r} fill="#F4ECDE" opacity={s.op} />
      ))}
    </AnimatedG>
  )
}

function AmbientField({ t, drift }: { t: SharedValue<number>; drift: SharedValue<number> }) {
  const buckets = useMemo(() => buildAmbientField(), [])
  return (
    <G>
      {buckets.map((stars, bucketIdx) => (
        <AmbientBucket key={bucketIdx} stars={stars} bucketIdx={bucketIdx} t={t} drift={drift} />
      ))}
    </G>
  )
}

// Per-bucket parallax — each bucket drifts with its own direction
// amplitude so the field layers feel depth-staggered. Multiplied by
// the slow `drift` clock (60 s loop) so motion is barely perceptible
// frame-to-frame but clear if you watch for ~15 s.
const BUCKET_DRIFT = [
  { ax: 9, ay: 6, phase: 0.0 },
  { ax: 6, ay: 11, phase: 0.22 },
  { ax: 12, ay: 4, phase: 0.48 },
  { ax: 4, ay: 9, phase: 0.71 },
  { ax: 8, ay: 7, phase: 0.88 },
] as const

function AmbientBucket({
  stars,
  bucketIdx,
  t,
  drift,
}: {
  stars: AmbientStar[]
  bucketIdx: number
  t: SharedValue<number>
  drift: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const phase = bucketIdx / AMBIENT_BUCKET_COUNT
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    const b = BUCKET_DRIFT[bucketIdx % BUCKET_DRIFT.length]!
    const a = (drift.value + b.phase) * 2 * Math.PI
    return {
      opacity: 0.35 + 0.65 * wave,
      transform: [{ translateX: Math.sin(a) * b.ax }, { translateY: Math.cos(a) * b.ay }],
    }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {stars.map((s, i) =>
        s.sparkle ? (
          <Path
            key={i}
            d={fourPointStarPath(s.x, s.y, s.r * 2.4)}
            fill="#F4ECDE"
            opacity={s.baseOp * 4}
          />
        ) : (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F4ECDE" opacity={s.baseOp * 4} />
        ),
      )}
    </AnimatedG>
  )
}

/* ─ Field stars ───────────────────────────────────────────────────
 *
 * The unconnected padding stars (see deriveProgress). They light up
 * interleaved with the figure so the canvas keeps filling across the
 * whole 28-day cycle. A lit field star is a small magenta 4-point
 * star — magenta is the "earned progress" colour, so it reads as
 * yours against the dim cream ambient field without needing a glow
 * disc (a filled halo circle reads as a hard-edged coin in isolation).
 * Unlit ones don't render: the ambient field covers "empty sky". */
function FieldStars({
  fieldStars,
  litKeys,
  t,
}: {
  fieldStars: readonly { x: number; y: number }[]
  litKeys: Set<string>
  t: SharedValue<number>
}) {
  return (
    <>
      {fieldStars.map((fs, n) =>
        litKeys.has(`field-${n}`) ? <FieldStar key={n} fs={fs} n={n} t={t} /> : null,
      )}
    </>
  )
}

/* A lit padding star — tiny magenta dot with a soft halo. Was a big
 * 4-point sparkle, but at that size and brightness the padding field
 * competed with the actual figure stars and made the canvas feel
 * crowded. Now reads as a quiet "your progress also filled this
 * patch of sky" mark — present, magenta, but unambiguously secondary
 * to the architectural figure. */
function FieldStar({
  fs,
  n,
  t,
}: {
  fs: { x: number; y: number }
  n: number
  t: SharedValue<number>
}) {
  const cx = PAD + fs.x * (W - 2 * PAD)
  const cy = PAD + fs.y * (H - 2 * PAD)
  const phase = (n * 0.21) % 1
  const starProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    return { opacity: 0.4 + 0.2 * wave }
  })
  return (
    <AnimatedG animatedProps={starProps}>
      <Circle cx={cx} cy={cy} r={4} fill={colors.magenta} opacity={0.18} />
      <Circle cx={cx} cy={cy} r={1.6} fill={colors.magenta} />
      <Circle cx={cx} cy={cy} r={0.7} fill="#FBD7E3" opacity={0.9} />
    </AnimatedG>
  )
}

/* ─ Constellation ray ─────────────────────────────────────────────
 *
 * A single bright cream particle that travels a continuous Hamilton
 * path through every star in the figure on the system `t` clock —
 * reads as a lightning bolt zigzagging through the constellation.
 *
 * Path derivation: a depth-first walk that visits every star,
 * preferring un-visited neighbours sorted by ascending degree (so
 * leaves are saved for last). For Leo this lands on the natural
 * traversal 5 → 4 → 3 → 2 → 1 → 0 → 6 → 7 → 8 (Sickle hook down,
 * then jump to body triangle).
 *
 * Animation: pathLength=1 normalises the dash pattern. A short
 * bright dash (10 % of the path) slides from start to end via
 * strokeDashoffset = -t·cycle. A magenta halo dash trails ~2 %
 * behind for the comet-wake feel. Cycle = dash + gap, with the
 * gap > 1 so only one bright dash is on the path at any moment
 * and the loop seam falls inside the invisible gap.
 */

function deriveHamiltonPath(
  numStars: number,
  lines: readonly (readonly [number, number])[],
): number[] {
  if (numStars === 0) return []
  const adj = new Map<number, Set<number>>()
  for (let i = 0; i < numStars; i++) adj.set(i, new Set<number>())
  for (const [a, b] of lines) {
    adj.get(a)?.add(b)
    adj.get(b)?.add(a)
  }
  // Pick a starting vertex with low degree (likely a leaf) so the
  // walk has the best chance of reaching every star without
  // backtracking.
  let startIdx = 0
  let minDeg = Infinity
  for (const [i, s] of adj) {
    const d = s.size
    if (d > 0 && d < minDeg) {
      minDeg = d
      startIdx = i
    }
  }
  const visited = new Set<number>()
  const path: number[] = []
  function dfs(node: number): boolean {
    visited.add(node)
    path.push(node)
    if (visited.size === numStars) return true
    const candidates = [...(adj.get(node) ?? [])]
      .filter((n) => !visited.has(n))
      .sort((a, b) => (adj.get(a)?.size ?? 0) - (adj.get(b)?.size ?? 0))
    for (const next of candidates) {
      if (dfs(next)) return true
    }
    visited.delete(node)
    path.pop()
    return false
  }
  dfs(startIdx)
  return path
}

function ConstellationRay({
  stars,
  lines,
  t,
  rayPresence,
}: {
  stars: Resolved[]
  lines: readonly (readonly [number, number])[]
  t: SharedValue<number>
  /** 0..1 global presence multiplier. The ray's job is to SUGGEST
   *  the constellation path while it's still being built; once
   *  the user has lit every star the actual figure is visible and
   *  the ray competes with it. The parent passes 1 while there
   *  are unlit stars and 0 (smoothly tweened by Reanimated) when
   *  the constellation completes. */
  rayPresence: SharedValue<number>
}) {
  const traversal = useMemo(() => deriveHamiltonPath(stars.length, lines), [stars.length, lines])
  const pathD = useMemo(() => {
    if (traversal.length === 0) return ''
    const points = traversal.map((idx) => stars[idx]).filter((s): s is Resolved => !!s)
    if (points.length === 0) return ''
    if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`
    // Catmull-Rom → cubic bezier conversion. Each segment from
    // P[i] to P[i+1] becomes a cubic curve whose control points are
    // derived from the slope at P[i] (using P[i-1] and P[i+1]) and
    // the slope at P[i+1] (using P[i] and P[i+2]). The curve passes
    // through every star.
    //
    // TENSION 0.12 — DELIBERATELY LOW. Higher tensions (0.3+) made
    // the path too smooth, obscuring the direction of travel: the
    // eye couldn't tell which way the comet was moving because the
    // angles between stars dissolved into a single sweeping line.
    // At 0.12 the corners are just enough rounded that they don't
    // read as wireframe polygon edges, but the angle changes
    // BETWEEN segments stay visible, so the comet's traversal
    // direction (start → end) reads on every frame.
    const TENSION = 0.12
    const segs = [`M ${points[0]!.x} ${points[0]!.y}`]
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] ?? points[i]!
      const p1 = points[i]!
      const p2 = points[i + 1]!
      const p3 = points[i + 2] ?? points[i + 1]!
      const cp1x = p1.x + (p2.x - p0.x) * TENSION
      const cp1y = p1.y + (p2.y - p0.y) * TENSION
      const cp2x = p2.x - (p3.x - p1.x) * TENSION
      const cp2y = p2.y - (p3.y - p1.y) * TENSION
      segs.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`)
    }
    return segs.join(' ')
  }, [stars, traversal])

  // Comet-trail composition — four stacked dashes ALL in cream
  // (no magenta) so the ray POPS against the magenta constellation
  // lines instead of blending with them. Each dash is wider +
  // dimmer + slightly behind the previous, faking a tapering
  // tail behind a bright head.
  //
  // DASH LENGTHS are deliberately SHORT (max 0.15 of path = 15 %)
  // so the eye perceives a SINGLE moving particle with a brief
  // wake, not a long stationary streak that lights up half the
  // figure and reads as a frozen drawn shape. Combined the four
  // layers cover ~15-20 % of the path at any moment — small
  // enough to feel like a comet, large enough to have body.
  // Slowed timing — the ray now takes 2× the `t` cycle to traverse
  // the figure (16 s end-to-end instead of 8 s), so the eye can
  // actually follow the head from start to finish. Dash lengths
  // bumped to leave a visible "drawn" trail behind the head: the
  // user sees the path being painted, then quickly fading, then
  // the next cycle restarts from the leaf star.
  const SPEED = 0.5
  const HEAD_DASH = 0.025
  const TRAIL_DASH = 0.1
  const TAIL_DASH = 0.16
  const HALO_DASH = 0.25
  const GAP = 1.4

  // Cycle envelope — the comet visibly enters at t≈0.05, traces
  // start → end through t≈0.05 → 0.85, then fades out by t=1.
  // Reads as a clear beginning/end on each cycle.
  //
  //   t = 0.00 → 0.05  fade IN at the start
  //   t = 0.05 → 0.85  bright traversal start → end
  //   t = 0.85 → 1.00  fade OUT at the end
  function cometEnvelope(u: number) {
    'worklet'
    if (u < 0.05) return u / 0.05
    if (u < 0.85) return 1
    return Math.max(0, 1 - (u - 0.85) / 0.15)
  }
  const headProps = useAnimatedProps(() => {
    'worklet'
    const u = (t.value * SPEED) % 1
    return {
      strokeDashoffset: -u * (HEAD_DASH + GAP),
      opacity: cometEnvelope(u) * rayPresence.value,
    }
  })
  const trailProps = useAnimatedProps(() => {
    'worklet'
    const base = (t.value * SPEED) % 1
    const u = (base - 0.008 + 1) % 1
    return {
      strokeDashoffset: -u * (TRAIL_DASH + GAP),
      opacity: cometEnvelope(base) * rayPresence.value,
    }
  })
  const tailProps = useAnimatedProps(() => {
    'worklet'
    const base = (t.value * SPEED) % 1
    const u = (base - 0.02 + 1) % 1
    return {
      strokeDashoffset: -u * (TAIL_DASH + GAP),
      opacity: cometEnvelope(base) * rayPresence.value,
    }
  })
  const haloProps = useAnimatedProps(() => {
    'worklet'
    const base = (t.value * SPEED) % 1
    const u = (base - 0.04 + 1) % 1
    return {
      strokeDashoffset: -u * (HALO_DASH + GAP),
      opacity: cometEnvelope(base) * rayPresence.value,
    }
  })

  // pathLength=1 isn't in react-native-svg's TS types yet but it's
  // supported at runtime — spread through a Record cast.
  const runtimeProps = { pathLength: 1 } as Record<string, unknown>

  if (!pathD) return null

  return (
    <G>
      {/* Toned-down opacities throughout — the ray should READ as
          a subtle warm glint tracing the figure, not as a dramatic
          comet. Halo/tail/trail/head opacities ~half of the previous
          values, widths slightly trimmed, head no longer pure white. */}
      <AnimatedPath
        d={pathD}
        fill="none"
        stroke="#FFE9B4"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.16}
        strokeDasharray={`${HALO_DASH} ${GAP}`}
        animatedProps={haloProps}
        {...runtimeProps}
      />
      <AnimatedPath
        d={pathD}
        fill="none"
        stroke="#FFE9C2"
        strokeWidth={4.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.34}
        strokeDasharray={`${TAIL_DASH} ${GAP}`}
        animatedProps={tailProps}
        {...runtimeProps}
      />
      <AnimatedPath
        d={pathD}
        fill="none"
        stroke="#FFF6E5"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.58}
        strokeDasharray={`${TRAIL_DASH} ${GAP}`}
        animatedProps={trailProps}
        {...runtimeProps}
      />
      <AnimatedPath
        d={pathD}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.88}
        strokeDasharray={`${HEAD_DASH} ${GAP}`}
        animatedProps={headProps}
        {...runtimeProps}
      />
    </G>
  )
}

/* ─ Base placeholder layer (always visible silhouette) ──────────── */

function BaseLayer({
  zodiac,
  stars,
  slowT,
  radialPulse,
  t,
}: {
  zodiac: ZodiacDef
  stars: Resolved[]
  /** 5 s clock — modulates a sin wave between 0.78× and 1.22× of the
   *  base opacity so the placeholder silhouette gently breathes. Most
   *  visible at count = 0 where nothing else is lit; once stars sit on
   *  top, the breath happens "behind" them and reads as ambient. */
  slowT: SharedValue<number>
  /** 0..1 one-shot wave fired on commit. While > 0 the placeholder
   *  silhouette gets a brightness boost so the WHOLE figure flashes
   *  alongside the magenta radial ring — "the constellation fills up". */
  radialPulse: SharedValue<number>
  /** 8 s clock shared with the lit-star layer so the placeholder
   *  stars breathe + twinkle on the same heartbeat (just dimmer). */
  t: SharedValue<number>
}) {
  // Silhouette opacity wave — a slow breath on the unlit lines so
  // the placeholder figure feels alive, plus a parabolic flash on
  // every commit so the full shape pulses with the ignition.
  const linesProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(slowT.value * 2 * Math.PI)
    const flash = radialPulse.value * (1 - radialPulse.value) * 2
    const op = 0.55 + 0.25 * wave + flash * 0.4
    return { opacity: op > 1 ? 1 : op }
  })
  return (
    <>
      {/* Unlit line silhouettes — solid (no dashes) cream strokes
          so the figure outline reads as a continuous ghost shape
          rather than a dotted preview. Faint enough to recede when
          the lit segments fire on top, present enough for the user
          to feel "the figure is here, waiting to be lit". */}
      <AnimatedG animatedProps={linesProps}>
        {zodiac.lines.map(([a, b], idx) => {
          const A = stars[a]
          const B = stars[b]
          if (!A || !B) return null
          return (
            <Line
              key={`bl-${idx}`}
              x1={A.x}
              y1={A.y}
              x2={B.x}
              y2={B.y}
              stroke="#F4ECDE"
              strokeOpacity={0.28}
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          )
        })}
      </AnimatedG>
      {stars.map((s, i) => (
        <PlaceholderStar key={`bs-${i}`} s={s} i={i} t={t} />
      ))}
    </>
  )
}

/* Animated placeholder star — same breathing + twinkle pattern as
 * `LitStar` but tuned softer (smaller scale swing, slightly dimmer
 * cream fill) so the unlit field reads as "waiting" rather than "lit".
 * Each star has its own phase offset so the field is asynchronous —
 * adjacent stars never breathe or twinkle in sync. */
// Stars at/below this magnitude are the "hero" of their figure — the
// single brightest star (the anchor, mag 1.5). A figure has exactly
// one. Hero stars get HeroGlow so they read as genuinely *brighter*,
// not just bigger — matching how one star dominates in a real sky.
const HERO_MAG = 1.7

// Stars at/below this magnitude get the crossed 8-ray "glint" — the
// brighter half of a figure, drawn as a jewel rather than a flat
// asterisk. Fainter stars keep a simple 4-point spark.
const SPARKLE_MAG = 2.8

/* Soft magenta bloom for hero stars — two stacked low-alpha discs.
 * The hero is each figure's alpha star; the magenta glow makes it
 * "the fuchsia one" — unmistakably the brightest — in both the
 * placeholder and lit states. Drawn behind the star body. */
/* Multi-layer halo stack for alpha stars — matches the visual weight
 * of the orbital hero suns in Día/Semana. Five concentric layers fake
 * a smooth radial falloff without using <RadialGradient> (which has
 * the same iOS alpha-stop bug noted in AmbientGlow). Inner cream-pink
 * ring suggests heat at the core; outer magenta layers bloom into the
 * sky.
 *
 * The wrap AnimatedG breathes the entire halo on a 4 s cycle (per-star
 * phase offset so the three anchors of a figure never pulse in
 * unison). Both the overall opacity AND the scale ride the wave, so
 * the bloom visibly inflates and softens — anchors read as alive,
 * not just bigger circles. */
function HeroGlow({
  cx,
  cy,
  r,
  t,
  phase,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
  phase: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value * 2 + phase) * 2 * Math.PI)
    const scale = 1 + wave * 0.12
    const op = 0.45 + wave * 0.3
    return {
      opacity: op > 1 ? 1 : op,
      transform: [
        { translateX: cx },
        { translateY: cy },
        { scale },
        { translateX: -cx },
        { translateY: -cy },
      ],
    }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {/* Recoloured magenta → cream-gold and shrunk (6.4×r → 3.6×r
          outermost, opacities halved). Magenta is now exclusively
          the next-star action signal; the hero anchor remains the
          brightest body of the figure but stops dominating the
          composition. */}
      <Circle cx={cx} cy={cy} r={r * 3.6} fill="#D9AE6F" opacity={0.04} />
      <Circle cx={cx} cy={cy} r={r * 2.6} fill="#D9AE6F" opacity={0.07} />
      <Circle cx={cx} cy={cy} r={r * 1.8} fill="#F4ECDE" opacity={0.12} />
      <Circle cx={cx} cy={cy} r={r * 1.2} fill="#FFF6E5" opacity={0.22} />
    </AnimatedG>
  )
}

/* The star body. A 4-point spark, plus — for bright stars — a second
 * smaller spark crossed at 45°, so a figure's brightest jewels show
 * the 8-ray glint of the reference art instead of a flat asterisk. */
function StarSparkle({
  cx,
  cy,
  r,
  mag,
  fill,
  lit = false,
}: {
  cx: number
  cy: number
  r: number
  mag: number
  fill: string
  /** When true, render the long diffraction spikes and the white-hot
   *  pinpoint that signal "this star is alight". Placeholders and the
   *  next-affordance get only the body so the lit field stays the
   *  unambiguous bright layer. */
  lit?: boolean
}) {
  const isHero = mag <= HERO_MAG
  // Hierarchy strategy:
  //   • lit hero (alpha)    → full astrophotography treatment:
  //       horizontal+vertical diffraction spikes + 4-point body +
  //       rotated 45° cross sparkle + white-hot pinpoint.
  //   • lit secondary       → simple bright circle + cream-rosa
  //       pinpoint. NO 4-point, NO rotated cross, NO white pinpoint.
  //       Secondaries should read as "figure nodes" guiding the eye
  //       along the silhouette, not as competing hero stars.
  //   • unlit placeholder   → keep the 4-point silhouette so the
  //       resting figure still reads as a constellation-in-waiting
  //       against the ambient field.
  if (lit && !isHero) {
    // A small 4-point spark — the inherent shape of the path reads as
    // "point of light" rather than "sphere". Circles felt like pearls
    // on a string; the spark feels like a glint. No rotated cross or
    // white pinpoint here — those belong to the hero alone.
    return <Path d={fourPointStarPath(cx, cy, r * 0.7)} fill={fill} />
  }
  const spikeLen = r * 7
  return (
    <>
      {/* Diffraction spikes — lit ALPHAS only. Horizontal + vertical
          rays, no diagonals. Drawn before the body so the bright
          core sits on top and crisps the centre. */}
      {lit && isHero ? (
        <>
          <Line
            x1={cx - spikeLen}
            y1={cy}
            x2={cx + spikeLen}
            y2={cy}
            stroke="#FBD7E3"
            strokeOpacity={0.55}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
          <Line
            x1={cx}
            y1={cy - spikeLen}
            x2={cx}
            y2={cy + spikeLen}
            stroke="#FBD7E3"
            strokeOpacity={0.55}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
        </>
      ) : null}
      <Path d={fourPointStarPath(cx, cy, r)} fill={fill} />
      {mag <= SPARKLE_MAG ? (
        <Path
          d={fourPointStarPath(cx, cy, r * 0.6)}
          fill={fill}
          transform={`rotate(45 ${cx} ${cy})`}
        />
      ) : null}
      {/* White-hot pinpoint — lit heroes only. */}
      {lit && isHero ? <Circle cx={cx} cy={cy} r={r * 0.35} fill="#FFFFFF" opacity={0.85} /> : null}
    </>
  )
}

function PlaceholderStar({ s, i, t }: { s: Resolved; i: number; t: SharedValue<number> }) {
  const baseR = starRadius(s.mag) * 0.95
  const isHero = s.mag <= HERO_MAG
  const phase = (i * 0.137) % 1

  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    // Softer breath than lit stars (7 % vs 10 %) — still visible
    // motion, but the lit layer should always read as the brighter
    // half of the hierarchy when both coexist.
    const scale = 1 + wave * 0.07

    // Same scintillation period as lit stars but with a deeper dim
    // (down to 0.42 of base) so the eye registers the twinkle on the
    // dimmer cream fill.
    const twinkleCycle = (t.value * 2.4 + i * 0.31) % 1
    let twinkleOp = 1
    if (twinkleCycle < 0.04) {
      twinkleOp = 1 - (twinkleCycle / 0.04) * 0.58
    } else if (twinkleCycle < 0.08) {
      twinkleOp = 0.42 + ((twinkleCycle - 0.04) / 0.04) * 0.58
    }

    // ~35 % floor with breath — strong enough that the user sees
    // the FULL figure outline (so the constellation reads as a
    // path-in-progress, not a half-erased shape) while still
    // leaving clear contrast against the lit half.
    const ambient = (0.32 + 0.1 * wave) * twinkleOp
    return {
      opacity: ambient,
      transform: [
        { translateX: s.x },
        { translateY: s.y },
        { scale },
        { translateX: -s.x },
        { translateY: -s.y },
      ],
    }
  })

  return (
    <AnimatedG animatedProps={animatedProps}>
      {isHero ? <HeroGlow cx={s.x} cy={s.y} r={baseR} t={t} phase={phase} /> : null}
      <StarSparkle cx={s.x} cy={s.y} r={baseR} mag={s.mag} fill="#F4ECDE" />
    </AnimatedG>
  )
}

/* ─ Lit & next lines ────────────────────────────────────────────── */

function LitLines({
  zodiac,
  stars,
  litKeys,
  nextEl,
  ignitingKey,
  litPulse,
  breathT,
  lineDepth,
  t,
}: {
  zodiac: ZodiacDef
  stars: Resolved[]
  litKeys: Set<string>
  nextEl: SequenceEl | null
  /** While set, the matching line is skipped here so IgnitingOverlay
   *  can draw its stroke-trace flash on top without doubling up. */
  ignitingKey: string | null
  /** 0..1 ripple driven by the parent on each slider commit. Bumps
   *  the lit lines' group opacity from 0.92 → 1 so the whole figure
   *  reads as "just got brighter". */
  litPulse: SharedValue<number>
  /** The 16s clock that drives the cascading-ripple breath. Combined
   *  with per-line depth, each line pulses in sync with the closer
   *  of its two endpoint stars. */
  breathT: SharedValue<number>
  /** Per-line depth (BFS distance from the alpha through the nearer
   *  endpoint). Used to offset each line's breath window so the wave
   *  radiates outward in time. */
  lineDepth: readonly number[]
  /** The 8s system clock — drives the travelling energy beam dash
   *  on each lit filament so a bright cream "particle" slides from
   *  the alpha side toward the far endpoint of every lit edge. */
  t: SharedValue<number>
}) {
  const groupProps = useAnimatedProps(() => {
    'worklet'
    // The base group opacity is no longer where the breath lives —
    // each line carries its own depth-shifted brighten now. We keep
    // the litPulse commit-ripple here so the entire figure still
    // surges as one on each Hoy tap.
    return { opacity: 0.92 + litPulse.value * 0.08 }
  })
  return (
    <AnimatedG animatedProps={groupProps}>
      {zodiac.lines.map(([a, b], idx) => {
        const A = stars[a]
        const B = stars[b]
        if (!A || !B) return null
        const isLit = litKeys.has(`line-${idx}`)
        const isNext = nextEl?.type === 'line' && nextEl.idx === idx
        if (!isLit && !isNext) return null
        if (ignitingKey === `line-${idx}`) return null
        if (isLit) {
          return (
            <LitLineFilament
              key={`l-${idx}`}
              idx={idx}
              ax={A.x}
              ay={A.y}
              bx={B.x}
              by={B.y}
              breathT={breathT}
              depth={lineDepth[idx] ?? 0}
              t={t}
            />
          )
        }
        return (
          <Line
            key={`l-${idx}`}
            x1={A.x}
            y1={A.y}
            x2={B.x}
            y2={B.y}
            stroke="rgba(233,30,99,0.4)"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeDasharray="3 4"
          />
        )
      })}
    </AnimatedG>
  )
}

/* One lit line, rendered as a 3-layer filament with its own depth-
 * shifted breath. Per-line component (rather than a .map() body) so
 * each instance owns a hook call to useAnimatedProps — keeping
 * Reanimated's worklet scheduling clean. */
function LitLineFilament({
  idx,
  ax,
  ay,
  bx,
  by,
  breathT,
  depth,
  t,
}: {
  idx: number
  ax: number
  ay: number
  bx: number
  by: number
  breathT: SharedValue<number>
  depth: number
  /** 8 s system clock — drives the travelling cream "particle" that
   *  slides from the A endpoint toward the B endpoint on every lit
   *  edge, reading as energy flowing outward from the alpha. */
  t: SharedValue<number>
}) {
  const gradId = `litLine-${idx}`
  // Same cascade timing as LitStar: each shell brightens 0.02 of the
  // 16 s cycle (~320 ms) after the previous, modulo-wrapped so deep
  // lines in long figures still fire cleanly on the next pass.
  const breathStart = 0.85 + depth * 0.02
  const filamentProps = useAnimatedProps(() => {
    'worklet'
    const bc = (breathT.value - breathStart + 1) % 1
    let breath = 0
    if (bc < 0.1) {
      const local = bc / 0.1
      breath = Math.sin(local * Math.PI) * 0.18
    }
    return { opacity: 0.88 + breath }
  })

  // Travelling beam — a short bright cream dash slides from (ax, ay)
  // toward (bx, by) on every t cycle. Cycle = lineLen + dashLen + gap,
  // so when one dash exits past B it's already invisible (in the gap)
  // when t wraps back to 0 — no jarring snap. Phase offset per-line
  // index so adjacent edges don't all flash at once.
  const lineLen = Math.hypot(bx - ax, by - ay)
  const DASH_LEN = 10
  const GAP_PAD = 22
  const cycle = lineLen + DASH_LEN + GAP_PAD
  const phase = (idx * 0.143) % 1
  const beamProps = useAnimatedProps(() => {
    'worklet'
    const u = (t.value + phase) % 1
    return { strokeDashoffset: -u * cycle }
  })
  // Second beam — same dash period, offset 0.5 of the cycle so the
  // two particles are antipodal: when one is at the A endpoint the
  // other is exiting past B. Reads as "the line is alive with
  // multiple sparks", the Genshin signature for lit-line energy.
  const beamProps2 = useAnimatedProps(() => {
    'worklet'
    const u = (t.value + phase + 0.5) % 1
    return { strokeDashoffset: -u * cycle }
  })
  return (
    <AnimatedG animatedProps={filamentProps}>
      <Defs>
        {/* Gradient runs along the line in user space so it orients
            to A→B, not to the SVG viewBox. Stops are bright at each
            node and dim at the midpoint — each line reads as "two
            stars connected by their own light" rather than a uniform
            stroke. */}
        <LinearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={ax} y1={ay} x2={bx} y2={by}>
          <Stop offset="0%" stopColor="#FFF6E5" stopOpacity={0.85} />
          <Stop offset="15%" stopColor="#D9AE6F" stopOpacity={0.78} />
          <Stop offset="50%" stopColor="#D9AE6F" stopOpacity={0.4} />
          <Stop offset="85%" stopColor="#D9AE6F" stopOpacity={0.78} />
          <Stop offset="100%" stopColor="#FFF6E5" stopOpacity={0.85} />
        </LinearGradient>
      </Defs>
      {/* Three-layer light filament. Recoloured from magenta to
          warm cream-gold so magenta is reserved exclusively for the
          next-to-light action signal; lit lines + stars share one
          earned-progress palette.
          1. Wide diffuse outer bloom — soft gold haze that makes
             the line feel like radiation in fog, not a CAD edge.
          2. Bright gold gradient body — bright at the nodes, faded
             at the midpoint, so each line reads as "two stars
             connected by their own light" rather than a uniform
             stroke.
          3. Hair-thin cream spine — the filament's crisp inner
             thread. This is what makes the line stop reading as
             "ink" and start reading as "a strand of light". */}
      {/* Mega-bloom — widest softest layer. Makes the line GLOW
          radially in space, the way Genshin's constellation lines
          glow. Without this, lit lines read as solid strokes; with
          it, they read as filaments radiating light. */}
      <Line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="#D9AE6F"
        strokeOpacity={0.14}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <Line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="#D9AE6F"
        strokeOpacity={0.32}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <Line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke={`url(#${gradId})`}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <Line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="#FFF6E5"
        strokeOpacity={0.55}
        strokeWidth={0.8}
        strokeLinecap="round"
      />
      {/* Energy beams — two bright cream particles sliding A→B on
          `t`, offset 0.5 of the cycle so they're antipodal. Each
          dasharray sums to the cycle (DASH_LEN + lineLen + GAP_PAD)
          so the bright segment crosses the line once per cycle and
          the gap covers everything else, hiding the loop seam. */}
      <AnimatedLine
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="#FFF6E5"
        strokeWidth={1.6}
        strokeOpacity={0.85}
        strokeLinecap="round"
        strokeDasharray={`${DASH_LEN} ${lineLen + GAP_PAD}`}
        animatedProps={beamProps}
      />
      <AnimatedLine
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke="#FFF6E5"
        strokeWidth={1.2}
        strokeOpacity={0.6}
        strokeLinecap="round"
        strokeDasharray={`${DASH_LEN * 0.7} ${lineLen + GAP_PAD + DASH_LEN * 0.3}`}
        animatedProps={beamProps2}
      />
    </AnimatedG>
  )
}

/* ─ Centre scrim ──────────────────────────────────────────────────
 *
 * A soft dark vignette behind the centre counter. Every zodiac figure
 * routes some stars/lines through the middle of the canvas, where the
 * big day-count number sits — without this they collide and the
 * number reads as cluttered. The scrim punches a calm "clearing":
 * stacked low-alpha bg ellipses darken the constellation just under
 * the counter, fading out smoothly so there's no hard edge. */
const SCRIM_LAYERS = 7

/*
 * Lit-cluster aura — a warm cream-magenta radial wash centred on
 * the centroid of all currently-lit stars, with radius spanning
 * the cluster + a small padding. Reads as "this side of the figure
 * is burning warm" — the lit half is BATHED in light vs the dim
 * unlit half. Subtle breath on the system breathT keeps it alive.
 *
 * Drawn between FieldStars and BaseLayer in z-order so lit stars +
 * lines + halos all land ON TOP of the aura (the wash sits behind,
 * the bright stars in front). The radial gradient `litClusterAura`
 * is declared in SvgGradients.
 */
function LitClusterAura({
  cx,
  cy,
  r,
  breathT,
}: {
  cx: number
  cy: number
  r: number
  breathT: SharedValue<number>
}) {
  const auraProps = useAnimatedProps(() => {
    'worklet'
    // ±4 % radius + ±0.10 opacity breath on the 16s clock so the
    // wash slowly expands + contracts like the figure is inhaling
    // light.
    const wave = 0.5 + 0.5 * Math.sin(breathT.value * 2 * Math.PI)
    return {
      r: r * (1 + wave * 0.04),
      opacity: 0.18 + wave * 0.1,
    }
  })
  return (
    <AnimatedCircle cx={cx} cy={cy} r={r} fill="url(#litClusterAura)" animatedProps={auraProps} />
  )
}

// Six dust motes scattered in fixed offsets around the lit cluster
// centroid. Each twinkles on its own phase so the field never reads
// as synchronised pulses — looks like dust catching the cluster's
// warm light. Frequency 1.4 × the 8 s clock so the twinkles read
// faster than the breath.
const MOTE_LAYOUT = [
  { dx: 0.42, dy: -0.58, phase: 0.13 },
  { dx: -0.52, dy: -0.32, phase: 0.27 },
  { dx: -0.34, dy: 0.48, phase: 0.41 },
  { dx: 0.58, dy: 0.22, phase: 0.55 },
  { dx: 0.18, dy: 0.72, phase: 0.69 },
  { dx: -0.7, dy: -0.08, phase: 0.83 },
] as const

function LitClusterMotes({
  cx,
  cy,
  r,
  t,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
}) {
  return (
    <G>
      {MOTE_LAYOUT.map((m, i) => (
        <ClusterMote key={`mt-${i}`} cx={cx + m.dx * r} cy={cy + m.dy * r} phase={m.phase} t={t} />
      ))}
    </G>
  )
}

function ClusterMote({
  cx,
  cy,
  phase,
  t,
}: {
  cx: number
  cy: number
  phase: number
  t: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI * 1.4)
    return { opacity: 0.18 + wave * 0.55 }
  })
  return <AnimatedCircle cx={cx} cy={cy} r={0.85} fill="#FFF1F6" animatedProps={animatedProps} />
}

function CenterScrim({ cx, cy }: { cx: number; cy: number }) {
  return (
    <G>
      {Array.from({ length: SCRIM_LAYERS }).map((_, i) => {
        const tt = i / (SCRIM_LAYERS - 1)
        const rx = 72 - 52 * tt
        const ry = 54 - 39 * tt
        return <Ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry} fill={colors.bg} opacity={0.1} />
      })}
    </G>
  )
}

/* ─ Centre counter texts ────────────────────────────────────────── */

/* The big number used to live here as SvgText, but animating its
 * children would force per-frame React re-renders. It moved out to
 * the React Native overlay (<CenterNumberOverlay>) so the count-up
 * and scale pulse can run on the UI thread via the AnimatedTextInput
 * `text` prop trick. The static "DE 28 DÍAS" stays in SVG (cheap);
 * the progress phrase moved BELOW the SVG so it never collides with
 * the centre bloom. */
// CenterText removed — the chip now lives outside the SVG as a
// footer row (CenterNumberOverlay), so the in-SVG halo + label
// the original CenterText painted are no longer needed.

/* React Native overlay positioned over the SVG centre. Uses the
 * AnimatedTextInput `text` prop trick (same pattern as StreakNumber)
 * so the integer climb runs on the UI thread without re-rendering
 * React. `marginTop: -22` biases the baseline upward to match the
 * old SvgText y = cy - 4. */
function CenterNumberOverlay({
  displayedCount,
  numberPulse,
  plusOne,
  initialCount,
  urgent = false,
  remaining = 0,
}: {
  displayedCount: SharedValue<number>
  numberPulse: SharedValue<number>
  plusOne: SharedValue<number>
  initialCount: number
  /** Final-stretch flag — last 3 days before completion. Switches
   *  the chip to a celebratory state (extra microcopy + warmer
   *  tone) so the user sees they're almost there. */
  urgent?: boolean
  /** Days remaining until completion. Used by the urgency
   *  microcopy ("falta 1", "faltan 2", etc.). */
  remaining?: number
}) {
  const rounded = useDerivedValue(() => Math.round(displayedCount.value))
  const textProps = useAnimatedProps(() => {
    const text = String(rounded.value)
    return { text, defaultValue: text } as unknown as Partial<TextInputProps>
  })
  // Opacity ramps from 0.42 at count=0 to 1.0 once the user has marked
  // at least one day — the dim "0" reads as "waiting for you to begin"
  // rather than a bright assertion. The commit scale-pop is bigger now
  // (0.18, was 0.08) so the increment lands as a beat, not a twitch.
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + numberPulse.value * 0.18 }],
    opacity: 0.42 + Math.min(1, displayedCount.value) * 0.58,
  }))
  // The digit flashes pale at the peak of the pop — magenta → near
  // white → magenta — so the eye catches the number *changing*.
  const colorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(numberPulse.value, [0, 1], [colors.magenta, '#FFF3FA']),
  }))
  // The "+1" ghost — rises ~22 px and fades. Appears fast, holds
  // briefly, gone by the end of the ramp.
  const ghostStyle = useAnimatedStyle(() => ({
    opacity: interpolate(plusOne.value, [0, 0.12, 0.6, 1], [0, 1, 1, 0]),
    transform: [{ translateY: -plusOne.value * 22 }],
  }))
  return (
    <View style={styles.numberOverlay} pointerEvents="none">
      <Animated.View style={[styles.numberRow, pulseStyle]}>
        <View style={styles.chipFrameDot} />
        <View style={styles.chipFrameLine} />
        <AnimatedTextInput
          editable={false}
          underlineColorAndroid="transparent"
          animatedProps={textProps}
          defaultValue={String(initialCount)}
          style={[styles.numberOverlayText, colorStyle]}
        />
        <Text style={styles.numberDenominator}>/ {TARGET_DAYS} días</Text>
        <View style={styles.chipFrameLine} />
        <View style={styles.chipFrameDot} />
      </Animated.View>
      {urgent && remaining > 0 ? (
        <Text style={styles.urgencyHint}>
          {remaining === 1 ? 'una más' : `faltan ${remaining}`}
        </Text>
      ) : null}
      <Animated.View style={[styles.plusOne, ghostStyle]} pointerEvents="none">
        <Text style={styles.plusOneText}>+1</Text>
      </Animated.View>
    </View>
  )
}

/* ─ Stars layer (dispatches lit / next variants) ────────────────── */

function StarsLayer({
  stars,
  litKeys,
  nextEl,
  t,
  ignitingKey,
  intensity,
  litPulse,
  starRecency,
  breathT,
  starDepth,
}: {
  stars: Resolved[]
  litKeys: Set<string>
  nextEl: SequenceEl | null
  t: SharedValue<number>
  /** While set, the matching star is skipped here so IgnitingOverlay
   *  can draw its flash on top without doubling up. */
  ignitingKey: string | null
  intensity: number
  litPulse: SharedValue<number>
  /** Star idx → days since marked. Drives the halo decay so recent
   *  stars feel alive and older ones quiet down. */
  starRecency: Map<number, number>
  /** 16s coordinated-breath clock. Threaded through to LitStar so
   *  every lit star can share the same brighten window. */
  breathT: SharedValue<number>
  /** Star idx → BFS distance from the alpha through the figure
   *  graph. Each shell pulses 320 ms after the previous, so the
   *  breath ripples outward from the alpha instead of firing in
   *  unison. */
  starDepth: Map<number, number>
}) {
  return (
    <>
      {stars.map((s, i) => {
        const isLit = litKeys.has(`star-${i}`)
        const isNext = nextEl?.type === 'star' && nextEl.idx === i
        if (ignitingKey === `star-${i}`) return null
        if (isNext) return <NextStar key={`s-${i}`} s={s} t={t} />
        if (isLit) {
          const recency = starRecency.get(i) ?? 0
          const depth = starDepth.get(i) ?? 0
          return (
            <LitStar
              key={`s-${i}`}
              s={s}
              i={i}
              t={t}
              intensity={intensity}
              litPulse={litPulse}
              recency={recency}
              breathT={breathT}
              depth={depth}
            />
          )
        }
        return null
      })}
    </>
  )
}

/* ─ Igniting overlay (one-shot flashes on top) ─────────────────────
 *
 * Renders the single element currently being ignited:
 *   • star → 1 → 2.5× scale flash with overshoot, plus an emanating
 *     ring that fades as it expands.
 *   • line → SVG stroke-trace via animated strokeDashoffset.
 *
 * After the timer expires upstream, `ignitingKey` clears and the
 * regular StarsLayer / LitLines render the element in its settled
 * state, so the visual hand-off is invisible.
 */
function IgnitingOverlay({
  zodiac,
  stars,
  ignitingKey,
  igniteT,
}: {
  zodiac: ZodiacDef
  stars: Resolved[]
  ignitingKey: string | null
  igniteT: SharedValue<number>
}) {
  if (!ignitingKey) return null
  const [kind, idxStr] = ignitingKey.split('-')
  const idx = Number(idxStr)
  if (kind === 'star') {
    const s = stars[idx]
    if (!s) return null
    return <IgnitingStar s={s} igniteT={igniteT} />
  }
  if (kind === 'line') {
    const ln = zodiac.lines[idx]
    if (!ln) return null
    const A = stars[ln[0]]
    const B = stars[ln[1]]
    if (!A || !B) return null
    return <IgnitingLine A={A} B={B} igniteT={igniteT} />
  }
  return null
}

// Burst spark angles — 8 directions, slightly off-cardinal so the
// pattern reads as organic (not a perfect compass rose).
const BURST_ANGLES = [12, 57, 102, 147, 192, 237, 282, 327] as const

function IgnitingStar({ s, igniteT }: { s: Resolved; igniteT: SharedValue<number> }) {
  const baseR = starRadius(s.mag) + 0.5

  // Three-phase scale: grow 1→2.5 (0..0.3), hold (0.3..0.5), settle
  // 2.5→1 (0.5..1). Applied via SVG transform on the wrapping G so
  // we only set a single string per frame, no path recompute.
  const starProps = useAnimatedProps(() => {
    'worklet'
    const u = igniteT.value
    let scale = 1
    if (u < 0.3) {
      scale = 1 + (1.5 * u) / 0.3
    } else if (u < 0.5) {
      scale = 2.5
    } else {
      scale = 1 + 1.5 * (1 - (u - 0.5) / 0.5)
    }
    return {
      transform: [
        { translateX: s.x },
        { translateY: s.y },
        { scale },
        { translateX: -s.x },
        { translateY: -s.y },
      ],
    }
  })

  // Emanating ring: grows faster than the star and fades out by ~0.7
  // of the animation so it doesn't compete with the settled state.
  const ringProps = useAnimatedProps(() => {
    'worklet'
    const u = Math.min(1, igniteT.value * 1.5)
    return {
      r: baseR + u * baseR * 4,
      opacity: 0.6 * (1 - u),
    }
  })

  // White-hot flash — a brief overexposed disc that peaks ~u=0.18
  // and fades by u=0.6. Reads as the camera/eye being momentarily
  // overwhelmed by the ignition. Quadratic envelope so the rise
  // and fall both feel snappy.
  const flashProps = useAnimatedProps(() => {
    'worklet'
    const u = igniteT.value
    const env = Math.max(0, 1 - Math.abs(u - 0.18) / 0.42)
    return {
      r: baseR * (1 + u * 3),
      opacity: env * env * 0.85,
    }
  })

  // Diffraction cross spike — grows from 0 to full during 0..0.35,
  // then fades by 0.8. The big anamorphic moment of the ignition.
  const spikeProps = useAnimatedProps(() => {
    'worklet'
    const u = igniteT.value
    const grow = Math.min(1, u / 0.35)
    const fade = u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.45)
    return {
      opacity: grow * fade * 0.95,
      transform: [
        { translateX: s.x },
        { translateY: s.y },
        { scale: grow * (1 + u * 0.6) },
        { translateX: -s.x },
        { translateY: -s.y },
      ],
    }
  })

  const spikeLen = baseR * 9

  return (
    <G>
      {/* Emanating shockwave ring */}
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={baseR}
        fill="none"
        stroke="rgba(255,246,229,0.85)"
        strokeWidth={0.8}
        animatedProps={ringProps}
      />
      {/* White-hot flash — overexposed disc at the moment of impact. */}
      <AnimatedCircle cx={s.x} cy={s.y} r={baseR} fill="#FFFFFF" animatedProps={flashProps} />
      {/* Diffraction cross — H + V + 2 diagonal rays grow out of the
          centre as the star ignites. The dramatic Genshin "moment of
          ignition" anamorphic flare. */}
      <AnimatedG animatedProps={spikeProps}>
        <Line
          x1={s.x - spikeLen}
          y1={s.y}
          x2={s.x + spikeLen}
          y2={s.y}
          stroke="#FFF1F6"
          strokeWidth={1.1}
          strokeLinecap="round"
        />
        <Line
          x1={s.x}
          y1={s.y - spikeLen * 0.85}
          x2={s.x}
          y2={s.y + spikeLen * 0.85}
          stroke="#FFF1F6"
          strokeWidth={0.9}
          strokeLinecap="round"
          opacity={0.85}
        />
        <Line
          x1={s.x - spikeLen * 0.55}
          y1={s.y - spikeLen * 0.55}
          x2={s.x + spikeLen * 0.55}
          y2={s.y + spikeLen * 0.55}
          stroke="#FFF1F6"
          strokeWidth={0.6}
          strokeLinecap="round"
          opacity={0.55}
        />
        <Line
          x1={s.x - spikeLen * 0.55}
          y1={s.y + spikeLen * 0.55}
          x2={s.x + spikeLen * 0.55}
          y2={s.y - spikeLen * 0.55}
          stroke="#FFF1F6"
          strokeWidth={0.6}
          strokeLinecap="round"
          opacity={0.55}
        />
      </AnimatedG>
      {/* Spark particles — 8 small cream dots that fly outward from
          the centre and fade. Each is independent (own worklet) so
          their motion stays per-particle smooth. */}
      {BURST_ANGLES.map((deg) => (
        <BurstSpark
          key={`bs-${deg}`}
          cx={s.x}
          cy={s.y}
          angle={(deg * Math.PI) / 180}
          distance={baseR * 7}
          igniteT={igniteT}
        />
      ))}
      <AnimatedG animatedProps={starProps}>
        <Path d={fourPointStarPath(s.x, s.y, baseR)} fill="url(#starLit)" />
      </AnimatedG>
    </G>
  )
}

/*
 * A single spark particle for the ignition burst. Flies outward
 * from (cx, cy) along `angle` to `distance`, fading opacity 1 → 0
 * over the igniteT cycle. Cubic ease on position so the spark
 * decelerates as it travels (organic, not constant-velocity).
 */
function BurstSpark({
  cx,
  cy,
  angle,
  distance,
  igniteT,
}: {
  cx: number
  cy: number
  angle: number
  distance: number
  igniteT: SharedValue<number>
}) {
  const cosA = Math.cos(angle)
  const sinA = Math.sin(angle)
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = igniteT.value
    // Cubic ease-out: 1 - (1-u)^3 — fast start, slow at the end.
    const eased = 1 - (1 - u) * (1 - u) * (1 - u)
    const d = eased * distance
    return {
      cx: cx + cosA * d,
      cy: cy + sinA * d,
      opacity: (1 - u) * 0.9,
    }
  })
  return <AnimatedCircle r={1.1} fill="#FFF1F6" animatedProps={animatedProps} />
}

function IgnitingLine({
  A,
  B,
  igniteT,
}: {
  A: Resolved
  B: Resolved
  igniteT: SharedValue<number>
}) {
  const length = useMemo(() => Math.hypot(B.x - A.x, B.y - A.y), [A, B])

  // strokeDasharray = full length; strokeDashoffset drops from L to 0
  // so the visible segment slides into view, drawing the line A→B
  // over the animation. Two layered strokes: a wide warm-gold bloom
  // underneath and a bright white-cream spine on top, so the path
  // reads as a luminous brushstroke being painted across the sky.
  const drawProps = useAnimatedProps(() => {
    'worklet'
    return { strokeDashoffset: length * (1 - igniteT.value) }
  })
  // Bright head — concentrated at the leading edge of the draw so
  // the eye sees a comet-like tip painting the line on.
  const headProps = useAnimatedProps(() => {
    'worklet'
    const u = igniteT.value
    return {
      strokeDashoffset: length * (1 - u),
      opacity: u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15,
    }
  })

  return (
    <G>
      <AnimatedLine
        x1={A.x}
        y1={A.y}
        x2={B.x}
        y2={B.y}
        stroke="#D9AE6F"
        strokeOpacity={0.7}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={`${length} ${length}`}
        animatedProps={drawProps}
      />
      <AnimatedLine
        x1={A.x}
        y1={A.y}
        x2={B.x}
        y2={B.y}
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeDasharray={`6 ${length}`}
        animatedProps={headProps}
      />
    </G>
  )
}

/* "Next" reads as a queued summoning slot — quiet enough that the
 * lit stars stay the focal layer, but visibly turning so the user
 * sees a clock running. The actual sigilo layout (outer ring +
 * ticks rotating CCW, inner dashed ring rotating CW, plus a wish-
 * countdown pulse ring) is described inline below. */
function NextStar({ s, t }: { s: Resolved; t: SharedValue<number> }) {
  const baseR = starRadius(s.mag) + 0.5

  // Soft breath halo telegraphing "this is the next ignition" —
  // replaces the previous rotating-rings + ticks sigil which read
  // as a targeting reticle (HUD, not celestial). The signal is
  // now: a single warm magenta halo whose alpha + radius gently
  // swell once every ~3 s, plus the central StarSparkle tinted
  // magenta so the eye still finds the slot.
  const breathProps = useAnimatedProps(() => {
    'worklet'
    const u = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI * (8 / 3))
    return {
      r: baseR + 4 + u * 6,
      opacity: 0.18 + 0.22 * u,
    }
  })

  return (
    <G>
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={baseR + 4}
        fill={colors.magenta}
        animatedProps={breathProps}
      />
      <StarSparkle cx={s.x} cy={s.y} r={baseR} mag={s.mag} fill="url(#starNext)" />
    </G>
  )
}

function LitStar({
  s,
  i,
  t,
  intensity,
  litPulse,
  recency,
  breathT,
  depth,
}: {
  s: Resolved
  i: number
  t: SharedValue<number>
  /** 0..1 overflow-phase intensifier. Each star grows up to 18% and
   *  its halo brightens accordingly when the user keeps marking past
   *  the day the constellation completed. Subtle on purpose — this is
   *  "you've built it, now you're polishing it", not a second
   *  building phase. */
  intensity: number
  /** 0..1 ripple — fires once per slider commit. Boosts the star's
   *  opacity and amplifies the halo so each "Hoy" tap visibly lifts
   *  the whole constellation, not only the newly-igniting element. */
  litPulse: SharedValue<number>
  /** Days since this star was marked. 0 = today. Drives halo decay
   *  so recent stars feel alive while older ones quiet down — the
   *  body remembers recent rhythm more vividly than old. */
  recency: number
  /** 16s clock that drives the cascading-ripple breath. Combined
   *  with `depth`, each star pulses 320 ms after the previous shell
   *  so the brighten wave radiates outward from the alpha. */
  breathT: SharedValue<number>
  /** BFS distance from the alpha through the figure graph. 0 means
   *  this star is the alpha. Used to offset its breath window. */
  depth: number
}) {
  const baseR = starRadius(s.mag) + 0.5
  const r = baseR * (1 + intensity * 0.18)
  const isHero = s.mag <= HERO_MAG

  // Per-star phase offset so adjacent stars breathe out of sync.
  const phase = (i * 0.137) % 1

  // Halo intensity multiplier from recency. Days 0..7 stay bright
  // (1.0 → 0.55), days 7..21 fade further (0.55 → 0.18), days 21+
  // floor at a quiet baseline so old-lit stars still glow faintly.
  // Computed on JS thread and captured as a worklet closure scalar.
  const haloMult = recencyHaloMultiplier(recency)

  // Magenta glow — this is what separates a LIT star from a
  // placeholder one. Both star bodies are cream (starlight), so
  // without this halo a freshly-marked day is invisible against the
  // placeholder silhouette. The magenta is the achievement colour:
  // a lit star glows with it. Recency still fades older glows.
  // Cascade: alpha (depth 0) starts its breath at bc=0.85; every
  // shell after that fires 0.02 of the 16 s cycle (~320 ms) later.
  // The wave radiates outward from the alpha instead of all stars
  // pulsing in unison. Modular so the cascade wraps cleanly when
  // very deep figures push the last shell past bc=1.0.
  const breathStart = 0.85 + depth * 0.02
  const haloProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    // Halved ambient range vs. before (0.22→0.12 floor, 0.16→0.10
    // wave) so the lit halos read as glints, not glows. The
    // composition was reading "heavy" with full-strength halos
    // stacked on every lit star.
    const ambient = (0.08 + 0.08 * wave) * (1 + intensity * 0.5) * haloMult
    const bc = (breathT.value - breathStart + 1) % 1
    let breath = 0
    if (bc < 0.1) {
      const local = bc / 0.1
      breath = Math.sin(local * Math.PI) * 0.12 * haloMult
    }
    return {
      opacity: ambient + litPulse.value * 0.4 + breath,
      r: r + 7 * haloMult + litPulse.value * 4 + breath * 12,
    }
  })

  // Body animation: slow breathing scale 1.00 → 1.10 driven by the 8 s
  // clock + an asynchronous twinkle flicker (~3.3 s period per star,
  // each with its own phase) that briefly dips opacity to ~0.65 and
  // snaps back. The breathing carries the continuous "alive" feel; the
  // twinkle gives the eye the universal scintillation cue of real
  // stars in a night sky. The transform string lives on AnimatedG
  // (not the Path) so the gradient fill `url(#starLit)` stays stable.
  const starProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    const scale = 1 + wave * 0.1

    // Twinkle: t cycles 0..1 every 8 s; ×2.4 ⇒ ~3.3 s per twinkle.
    // Per-star phase keeps the field asynchronous.
    const twinkleCycle = (t.value * 2.4 + i * 0.31) % 1
    let twinkleOp = 1
    if (twinkleCycle < 0.04) {
      // Fast dim down (0 → 165 ms-ish at 4 % of 3.3 s).
      twinkleOp = 1 - (twinkleCycle / 0.04) * 0.35
    } else if (twinkleCycle < 0.08) {
      // Fast recover back to full brightness.
      twinkleOp = 0.65 + ((twinkleCycle - 0.04) / 0.04) * 0.35
    }

    const ambient = (0.85 + 0.15 * wave) * twinkleOp
    // Cascade breath, depth-shifted (matches haloProps).
    const bc = (breathT.value - breathStart + 1) % 1
    let breath = 0
    if (bc < 0.1) {
      const local = bc / 0.1
      breath = Math.sin(local * Math.PI) * 0.06
    }
    const boosted = ambient + litPulse.value * 0.15 + breath
    return {
      opacity: boosted > 1 ? 1 : boosted,
      transform: [
        { translateX: s.x },
        { translateY: s.y },
        { scale },
        { translateX: -s.x },
        { translateY: -s.y },
      ],
    }
  })

  // Outer diffuse halo — fades the star into the sky so it doesn't
  // sit as a hard punch-out on the magenta wash. Slow, low-amplitude
  // breath; recency-aware like the main halo.
  const outerHaloProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    // Halved + radius trimmed so the outer bloom feels like a
    // breath of warmth, not a solid disc on top of every lit star.
    const ambient = (0.025 + 0.02 * wave) * haloMult
    return {
      opacity: ambient + litPulse.value * 0.06,
      r: r + 9 * haloMult + litPulse.value * 3,
    }
  })

  // Hot core — a small cream-pink disc that sits between the star
  // body and the magenta halo. Adds the white-hot centre look that
  // makes stars read as light, not stickers.
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    return {
      opacity: (0.35 + 0.2 * wave) * haloMult + litPulse.value * 0.2,
      r: r + 2 + wave * 1.2,
    }
  })

  // Flare intensity scales with magnitude — every lit star now
  // earns at least a baby lens-flare, the brightest get full
  // streak + asymmetric cross. Threshold pushed from 3.0 → 4.2 so
  // even the faintest connectors (mag 3.9 Rasalas) get a hint of
  // flare, matching the Genshin reference where EVERY star in
  // the constellation sparks.
  //
  //   mag 1.5 (Regulus) → intensity 0.64
  //   mag 2.0 (Denebola) → 0.52
  //   mag 2.6 (Zosma) → 0.38
  //   mag 3.5 (Eta/Adhafera) → 0.17
  //   mag 3.9 (Rasalas) → 0.07
  //   mag 4.2+ → 0
  const flareIntensity = Math.max(0, (4.2 - s.mag) / 4.2)

  return (
    <G>
      {isHero ? <VolumetricRays cx={s.x} cy={s.y} r={r} t={t} /> : null}
      {isHero ? <HeroGlow cx={s.x} cy={s.y} r={r} t={t} phase={phase} /> : null}
      <AnimatedCircle cx={s.x} cy={s.y} r={r + 12} fill="#D9AE6F" animatedProps={outerHaloProps} />
      <AnimatedCircle cx={s.x} cy={s.y} r={r + 5} fill="#FFF6E5" animatedProps={haloProps} />
      {flareIntensity > 0 ? (
        <LitStarFlare
          cx={s.x}
          cy={s.y}
          r={r}
          intensity={flareIntensity}
          haloMult={haloMult}
          t={t}
          phase={phase}
        />
      ) : null}
      <AnimatedCircle cx={s.x} cy={s.y} r={r + 2} fill="#FFF6E5" animatedProps={coreProps} />
      <AnimatedG animatedProps={starProps}>
        <StarSparkle cx={s.x} cy={s.y} r={r} mag={s.mag} fill="url(#starLit)" lit />
      </AnimatedG>
      {/* White-hot pinpoint */}
      <Circle cx={s.x} cy={s.y} r={Math.max(0.5, r * 0.16)} fill="#FFF1D6" opacity={0.75} />
      {/* Today's star ring — only renders when this is the star
          marked TODAY. Visual tie between the coach copy and the
          figure. */}
      {recency === 0 ? <TodayRing cx={s.x} cy={s.y} r={r} t={t} /> : null}
      {/* Cream sparks drifting up from the star — particles. Hero
          + today's star emit double. */}
      <StarParticles
        cx={s.x}
        cy={s.y}
        r={r}
        t={t}
        seed={i}
        emit={isHero || recency === 0 ? 2 : 1}
      />
    </G>
  )
}

/* Volumetric rays — 8 thin cream strokes radiating from the alpha,
 * rotating slowly. The Genshin signature for "this is a real cosmic
 * body" instead of a coloured dot. */
function VolumetricRays({
  cx,
  cy,
  r,
  t,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
}) {
  const rotateProps = useAnimatedProps(() => {
    'worklet'
    // 40 s per rotation (~5 cycles of t).
    const deg = (t.value * (360 / 5)) % 360
    return {
      transform: [
        { translateX: cx },
        { translateY: cy },
        { rotate: `${deg}deg` },
        { translateX: -cx },
        { translateY: -cy },
      ],
    }
  })
  const RAY_LEN = r * 6
  const RAY_INNER = r * 1.4
  return (
    <AnimatedG animatedProps={rotateProps}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x1 = cx + Math.cos(rad) * RAY_INNER
        const y1 = cy + Math.sin(rad) * RAY_INNER
        const x2 = cx + Math.cos(rad) * RAY_LEN
        const y2 = cy + Math.sin(rad) * RAY_LEN
        // Cardinal rays (0/90/180/270) longer + slightly brighter.
        const isCardinal = deg % 90 === 0
        return (
          <Line
            key={`vr-${deg}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#FFF6E5"
            strokeOpacity={isCardinal ? 0.07 : 0.04}
            strokeWidth={isCardinal ? 0.6 : 0.4}
            strokeLinecap="round"
          />
        )
      })}
    </AnimatedG>
  )
}

/* Energy node — tiny bright disc pulsing under each lit star body,
 * a juncture-pulse that sells "energy flows through this point". */
function EnergyNode({
  cx,
  cy,
  r,
  t,
  phase,
  haloMult,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
  phase: number
  haloMult: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI * 1.6)
    return {
      opacity: (0.35 + 0.45 * wave) * haloMult,
      r: r * 0.55 + wave * 0.8,
    }
  })
  return (
    <AnimatedCircle cx={cx} cy={cy} r={r * 0.55} fill="#FFF6E5" animatedProps={animatedProps} />
  )
}

/* Today's star ring — thin cream orbital ring around the star
 * marked today. Slow rotation + breath so it doesn't compete with
 * the next-star pulse but unmistakably marks "this is THE one". */
function TodayRing({
  cx,
  cy,
  r,
  t,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
}) {
  const RING_R = r + 11
  const rotateProps = useAnimatedProps(() => {
    'worklet'
    const deg = (t.value * (360 / 12)) % 360
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI * 0.6)
    return {
      opacity: 0.18 + 0.18 * wave,
      transform: [
        { translateX: cx },
        { translateY: cy },
        { rotate: `${deg}deg` },
        { translateX: -cx },
        { translateY: -cy },
      ],
    }
  })
  return (
    <AnimatedG animatedProps={rotateProps}>
      <Circle
        cx={cx}
        cy={cy}
        r={RING_R}
        fill="none"
        stroke="#FFF6E5"
        strokeWidth={0.7}
        strokeDasharray="3 5"
      />
    </AnimatedG>
  )
}

/* StarParticles — cream sparks that drift upward from a lit star,
 * fading after ~3 s. Each star emits `emit` particles per cycle,
 * deterministically positioned by `seed` so adjacent stars don't
 * sync. */
const SPARK_BASE = 2
function StarParticles({
  cx,
  cy,
  r,
  t,
  seed,
  emit,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
  seed: number
  emit: number
}) {
  // Generate SPARK_BASE * emit sparks. Each has its own phase + lateral
  // jitter so they don't overlap.
  return (
    <G>
      {Array.from({ length: SPARK_BASE * emit }).map((_, i) => {
        const phase = ((seed * 17 + i * 23) % 100) / 100
        const lateral = (((seed * 31 + i * 13) % 100) / 100 - 0.5) * r * 2.6
        return (
          <StarSpark key={`sp-${i}`} cx={cx} cy={cy} r={r} t={t} phase={phase} lateral={lateral} />
        )
      })}
    </G>
  )
}

function StarSpark({
  cx,
  cy,
  r,
  t,
  phase,
  lateral,
}: {
  cx: number
  cy: number
  r: number
  t: SharedValue<number>
  phase: number
  lateral: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const u = (t.value * 0.35 + phase) % 1
    // Rise from cy to cy - 14 over the cycle.
    const dy = -u * 14
    // Slight lateral sway in addition to base offset.
    const dx = lateral + Math.sin(u * Math.PI * 2) * 1.2
    // Fade in 0..0.15, hold middle, fade out 0.7..1.
    let op = 0.7
    if (u < 0.15) op = (u / 0.15) * 0.7
    else if (u > 0.7) op = (1 - (u - 0.7) / 0.3) * 0.7
    return { cx: cx + dx, cy: cy + dy, opacity: op }
  })
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={Math.max(0.4, r * 0.12)}
      fill="#FFF6E5"
      animatedProps={animatedProps}
    />
  )
}

/*
 * Anamorphic lens flare for the brightest lit stars — a long
 * horizontal cream streak (camera anamorphic look) crossed by a
 * 4-ray diffraction starburst (H/V/two diagonals). Shimmers with a
 * subtle continuous scale wobble on `t` so the rays never freeze.
 *
 * Length + opacity both scale with `intensity` (per-magnitude
 * weight from LitStar) and `haloMult` (recency fade), so an older
 * lit star's flare dims along with its halo.
 */
function LitStarFlare({
  cx,
  cy,
  r,
  intensity,
  haloMult,
  t,
  phase,
}: {
  cx: number
  cy: number
  r: number
  intensity: number
  haloMult: number
  t: SharedValue<number>
  phase: number
}) {
  // Lens-flare geometry — further trimmed to almost-invisible on
  // the alpha. With the ornate ring of the new zodiac-art assets
  // taking the decorative role, the cross's job is just a hint of
  // "this is a bright star", not a feature.
  const rayH = r * (1.0 + intensity * 1.4) // ~1.0r dim → ~2.4r bright
  const rayV = rayH * 0.6
  const rayDiag = rayH * 0.28
  const flareThickness = Math.max(0.35, r * 0.11)
  const op = intensity * 0.22 * haloMult

  // Shimmer: scale-about-(cx, cy) wobble + opacity twinkle so the
  // flare visibly breathes like a real lens catching ambient motion.
  const shimmer = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI * 1.3)
    const scale = 0.92 + wave * 0.16
    return {
      transform: [
        { translateX: cx },
        { translateY: cy },
        { scale },
        { translateX: -cx },
        { translateY: -cy },
      ],
    }
  })

  return (
    <AnimatedG animatedProps={shimmer} opacity={op}>
      {/* Horizontal anamorphic streak — the lens flare signature. */}
      <Ellipse cx={cx} cy={cy} rx={rayH} ry={flareThickness} fill="#FFF6E5" opacity={0.28} />
      {/* Asymmetric cross — H thick + bright, V medium, diagonals thin. */}
      <Line
        x1={cx - rayH}
        y1={cy}
        x2={cx + rayH}
        y2={cy}
        stroke="#FFF6E5"
        strokeWidth={0.9}
        strokeLinecap="round"
        opacity={0.85}
      />
      <Line
        x1={cx}
        y1={cy - rayV}
        x2={cx}
        y2={cy + rayV}
        stroke="#FFF6E5"
        strokeWidth={0.6}
        strokeLinecap="round"
        opacity={0.6}
      />
      <Line
        x1={cx - rayDiag}
        y1={cy - rayDiag}
        x2={cx + rayDiag}
        y2={cy + rayDiag}
        stroke="#FFF6E5"
        strokeWidth={0.4}
        strokeLinecap="round"
        opacity={0.35}
      />
      <Line
        x1={cx - rayDiag}
        y1={cy + rayDiag}
        x2={cx + rayDiag}
        y2={cy - rayDiag}
        stroke="#FFF6E5"
        strokeWidth={0.4}
        strokeLinecap="round"
        opacity={0.35}
      />
    </AnimatedG>
  )
}

/* ─ Completion rings ────────────────────────────────────────────── */

/* ─ Anticipation crown ─────────────────────────────────────────────
 *
 * A faint cream ring around the canvas centre that emerges from day
 * 21 and grows/brightens as the user approaches completion. Builds
 * the "casi llegás" tension visible in the last week without
 * stealing focus from the lit constellation.
 */
function AnticipationCrown({
  cx,
  cy,
  proximity,
  breathT,
}: {
  cx: number
  cy: number
  /** 0..1 — 0 = day 21, 1 = day 28. Drives radius + opacity. */
  proximity: number
  breathT: SharedValue<number>
}) {
  // Smaller radius (75 → 95 px) keeps the crown inside the bright
  // focal area rather than at the canvas edge where the vignette
  // and the lion's ornate ring would absorb it. Opacities ~2× the
  // previous so the buildup actually reads in the last week.
  const baseR = 75 + proximity * 20
  const innerProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(breathT.value * 2 * Math.PI)
    return {
      opacity: (0.18 + 0.18 * wave) * (0.4 + proximity * 0.6),
      r: baseR + wave * 4,
    }
  })
  const outerProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(breathT.value * 2 * Math.PI + Math.PI * 0.4)
    return {
      opacity: (0.12 + 0.12 * wave) * (0.4 + proximity * 0.6),
      r: baseR + 10 + wave * 3,
    }
  })
  return (
    <G>
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={baseR}
        fill="none"
        stroke="#FFF6E5"
        strokeWidth={1.2}
        strokeDasharray="2 6"
        animatedProps={innerProps}
      />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={baseR + 10}
        fill="none"
        stroke="#D9AE6F"
        strokeWidth={0.8}
        strokeDasharray="1 7"
        animatedProps={outerProps}
      />
    </G>
  )
}

function CompletionRings({ cx, cy, t }: { cx: number; cy: number; t: SharedValue<number> }) {
  const innerProps = useAnimatedProps(() => {
    'worklet'
    // 5s loop derived from the 8s base.
    const p = (t.value * (8 / 5)) % 1
    return { r: 110 + p * 20, opacity: 0.35 * (1 - p) }
  })
  const outerProps = useAnimatedProps(() => {
    'worklet'
    const p = (t.value * (8 / 5) + 0.32) % 1
    return { r: 130 + p * 20, opacity: 0.2 * (1 - p) }
  })
  return (
    <G>
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={110}
        fill="none"
        stroke="rgba(233,30,99,0.35)"
        strokeWidth={0.5}
        animatedProps={innerProps}
      />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={130}
        fill="none"
        stroke="rgba(233,30,99,0.20)"
        strokeWidth={0.5}
        animatedProps={outerProps}
      />
    </G>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 4,
  },
  svgWrap: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    // Intentional frame — rounded corners + a thin warm bronze
    // hairline border that ties to the constellation's cream-gold
    // (`#D9AE6F`) palette. Converts the previously visible "card
    // boundary" into a deliberate "celestial portrait frame".
    // overflow: hidden so the rounded corners clip the lion's
    // ornate ring cleanly (the ring is circular so the corners
    // are empty anyway — no meaningful content lost).
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(217, 174, 111, 0.32)',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  // Footer container — sits directly below the SVG canvas so the
  // chip lives in its own row, never overlapping the constellation.
  numberOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  numberOverlayText: {
    // Shrunk from 52 → 24 so the count reads as metadata, not as
    // visual hero. The constellation IS the progress now; the
    // number is a literal-data complement, not a separate focal.
    fontFamily: typography.displaySemi,
    fontSize: 24,
    color: colors.leche,
    letterSpacing: -0.6,
    textAlign: 'center',
    // Soft pink textShadow kept for warmth, halved from before.
    textShadowColor: 'rgba(233,30,99,0.32)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    padding: 0,
    includeFontPadding: false,
    minWidth: 28,
  },
  numberDenominator: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 13,
    color: colors.niebla,
    letterSpacing: 1.0,
    marginLeft: 6,
  },
  // Decorative chip frame — thin niebla hairlines + bullet dots
  // flanking the count, so the chip reads as a designed UI element
  // rather than plain text floating in the constellation.
  chipFrameLine: {
    width: 18,
    height: 1,
    backgroundColor: colors.niebla,
    opacity: 0.6,
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  chipFrameDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.bone,
    opacity: 0.85,
    alignSelf: 'center',
  },
  // Urgency microcopy — appears only in the final 3 days. Tiny
  // italic warm tag below the count chip ("una más" / "faltan 2").
  urgencyHint: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 11,
    color: colors.magenta,
    letterSpacing: 0.6,
    marginTop: 2,
    textTransform: 'lowercase',
  },
  // The "+1" ghost — floats above the counter and rises out on each
  // commit. Absolute so it never shifts the centred number's layout.
  plusOne: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: H / 2 - 62,
    alignItems: 'center',
  },
  plusOneText: {
    fontFamily: typography.serifSemi,
    fontStyle: 'italic',
    fontSize: 22,
    color: colors.magenta,
    textShadowColor: 'rgba(233,30,99,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  // Visible only once the user completes the 28-day cycle — a single
  // small magenta caps stamp announcing the achievement. Replaces the
  // permanent "ACUARIO" label which duplicated the "TU ACUARIO"
  // section header above.
  completionCap: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  completionLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10.5,
    color: colors.magenta,
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
})
