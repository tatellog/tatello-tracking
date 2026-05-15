import * as Haptics from 'expo-haptics'
import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
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
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import { colors, typography } from '@/theme'

import { ZODIAC } from '../zodiac/data'
import type { ZodiacDef, ZodiacSign } from '../zodiac/types'

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
  // Steeper + larger range than the astronomy helper. Anchor stars
  // (mag 1.5) hit ~8.2 px and faint connectors (mag 4.5) sit around
  // 4.6 px — the gap reads as a real hierarchy at hero size.
  const r = 10 - 1.2 * mag
  if (r < 2.5) return 2.5
  if (r > 9) return 9
  return r
}

// Days-since-marked → halo intensity multiplier for lit stars. Stars
// marked in the last week shine the brightest halo; halos fade across
// days 7..21 toward a floor that keeps old-lit stars visible without
// competing with recent ones. Two-segment piecewise linear keeps the
// shape readable and easy to tune.
function recencyHaloMultiplier(days: number): number {
  if (days <= 0) return 1
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
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

const W = 290
const H = 290
const PAD = 30
const TARGET_DAYS = 28
const AMBIENT_STAR_COUNT = 64
const AMBIENT_BUCKET_COUNT = 8

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

  const litKeys = useMemo(() => {
    const set = new Set<string>()
    for (let i = 0; i < Math.min(elementsLit, sequence.length); i++) {
      const el = sequence[i]
      if (el) set.add(`${el.type}-${el.idx}`)
    }
    return set
  }, [elementsLit, sequence])

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
  //   t       — 8 s loop. Star breathing, ambient bucket twinkle,
  //             centre bloom ambient pulse, completion rings.
  //   slowT   — 5 s loop. The base silhouette breath so the
  //             placeholder lines+stars feel like a constellation
  //             waiting (not a static stamp), especially at count=0.
  // Single-thread clocks avoid spawning a timer per element.
  const t = useSharedValue(0)
  const slowT = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    slowT.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(slowT)
    }
  }, [t, slowT])

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
    litPulse.value = 0
    litPulse.value = withSequence(
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 480, easing: Easing.inOut(Easing.cubic) }),
    )
    radialPulse.value = 0
    radialPulse.value = withTiming(1, { duration: 2200, easing: Easing.out(Easing.cubic) })

    if (elementsLit > prevLit) {
      // Field stars don't run through the ignition flash — they just
      // fade in. Only figure stars/lines get the dramatic ignition.
      const newEls = sequence.slice(prevLit, elementsLit).filter((el) => el.type !== 'field')
      const hasLine = newEls.some((el) => el.type === 'line')
      Haptics.impactAsync(
        hasLine ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
      ).catch(() => {})
      setIgnitionQueue((q) => [...q, ...newEls])
    } else {
      // Tap landed but `round(pct * total)` didn't bump any element
      // this time. Still give a soft tactile confirmation so the user
      // doesn't think their tap got eaten.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
  }, [trainedCount, elementsLit, sequence, displayedCount, numberPulse, litPulse, radialPulse])

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
          <AmbientField t={t} />
          <ShootingStar t={t} />
          <AmbientGlow cx={cx} cy={cy} />
          <FieldStars fieldStars={fieldStars} litKeys={litKeys} t={t} />
          <BaseLayer zodiac={zodiac} stars={stars} slowT={slowT} radialPulse={radialPulse} t={t} />
          <LitLines
            zodiac={zodiac}
            stars={stars}
            litKeys={litKeys}
            nextEl={nextEl}
            ignitingKey={ignitingKey}
            litPulse={litPulse}
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
          />
          <IgnitingOverlay
            zodiac={zodiac}
            stars={stars}
            ignitingKey={ignitingKey}
            igniteT={igniteT}
          />
          <CenterScrim cx={cx} cy={cy} />
          <StarBurst cx={cx} cy={cy} pulse={radialPulse} />
          <CenterText cx={cx} cy={cy} />
          {isComplete ? <CompletionRings cx={cx} cy={cy} t={t} /> : null}
        </Svg>

        <CenterNumberOverlay
          displayedCount={displayedCount}
          numberPulse={numberPulse}
          initialCount={trainedCount}
        />
      </View>

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

/* ─ Ambient star field ──────────────────────────────────────────── */

type AmbientStar = { x: number; y: number; r: number; baseOp: number }

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
    const baseOp = 0.04 + Math.abs(a * b) * 0.1
    const r = 0.4 + Math.abs(a) * 0.7
    const bucket = i % AMBIENT_BUCKET_COUNT
    buckets[bucket]!.push({ x, y, r, baseOp })
  }
  return buckets
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
function ShootingStar({ t }: { t: SharedValue<number> }) {
  // Cycle in 0..1 across 24 s (3× the base clock). Active window: 0..0.06.
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const cycle = (t.value / 3) % 1
    const active = cycle < 0.06
    if (!active) return { opacity: 0, cx: -10, cy: -10 }
    const local = cycle / 0.06 // 0..1 within the active window
    const startX = -20
    const endX = W + 20
    const startY = 40
    const endY = H * 0.55
    const x = startX + (endX - startX) * local
    const y = startY + (endY - startY) * local
    // Fade in 0..0.15, hold 0.15..0.7, fade out 0.7..1
    let op = 1
    if (local < 0.15) op = local / 0.15
    else if (local > 0.7) op = 1 - (local - 0.7) / 0.3
    return { opacity: op, cx: x, cy: y }
  })

  const trailProps = useAnimatedProps(() => {
    'worklet'
    const cycle = (t.value / 3) % 1
    if (cycle >= 0.06) return { opacity: 0, x1: -10, y1: -10, x2: -10, y2: -10 }
    const local = cycle / 0.06
    const startX = -20
    const endX = W + 20
    const startY = 40
    const endY = H * 0.55
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

/* ─ Burst effect — fireworks on each commit ────────────────────────
 *
 * On every day-mark, a bright magenta core flashes at centre and
 * PARTICLE_COUNT sparks burst out like a firework: each shoots at its
 * own angle and reach, decelerates (air drag), arcs downward under
 * gravity, flickers and fades. Each spark is a streak — the segment
 * between its position now and a beat earlier — so it's a long trail
 * while fast and shrinks to a point as it slows. The asymmetry +
 * gravity arc is what reads as a firework rather than an expanding
 * ring.
 *
 * Driven by the parent's `radialPulse` SharedValue 0→1.
 */
function StarBurst({ cx, cy, pulse }: { cx: number; cy: number; pulse: SharedValue<number> }) {
  return (
    <G>
      <BurstCore cx={cx} cy={cy} pulse={pulse} />
      <ParticleBurst cx={cx} cy={cy} pulse={pulse} />
    </G>
  )
}

const PARTICLE_COUNT = 28
const PARTICLE_REACH = 118 // base radial reach (px), jittered per spark
const PARTICLE_GRAVITY = 95 // downward pull accumulated by the burst's end

function ParticleBurst({ cx, cy, pulse }: { cx: number; cy: number; pulse: SharedValue<number> }) {
  return (
    <G>
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
        <ParticleSpark key={i} cx={cx} cy={cy} index={i} pulse={pulse} />
      ))}
    </G>
  )
}

/* One firework spark. Shoots out (ease-out — explosive launch, then
 * air drag), arcs downward under gravity, flickers, fades. Rendered
 * as the streak between the head (position now) and the tail
 * (position a beat earlier): long while the spark is fast, collapsing
 * to a point as it slows. */
function ParticleSpark({
  cx,
  cy,
  index,
  pulse,
}: {
  cx: number
  cy: number
  index: number
  pulse: SharedValue<number>
}) {
  // Even angular spread + deterministic jitter so the burst is
  // organic, not a perfect ring.
  const angle = (index / PARTICLE_COUNT) * Math.PI * 2 + Math.sin(index * 12.9898) * 0.2
  // Per-spark reach + thickness — sparks fly different distances.
  const reach = PARTICLE_REACH * (0.55 + Math.abs(Math.sin(index * 31.7)) * 0.78)
  const width = 1.4 + Math.abs(Math.sin(index * 17.3)) * 1.6
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
    // behind. Gravity (u²) curves both downward — the streak arcs.
    const lag = 0.07
    const uTail = u < lag ? 0 : u - lag
    const tHead = 1 - (1 - u) * (1 - u)
    const tTail = 1 - (1 - uTail) * (1 - uTail)
    const xHead = cx + dirX * reach * tHead
    const yHead = cy + dirY * reach * tHead + PARTICLE_GRAVITY * u * u
    const xTail = cx + dirX * reach * tTail
    const yTail = cy + dirY * reach * tTail + PARTICLE_GRAVITY * uTail * uTail
    // fast fade-in, long fade-out, plus a fast flicker.
    const fade = u < 0.06 ? u / 0.06 : 1 - (u - 0.06) / 0.94
    const flicker = 0.65 + 0.35 * Math.sin(u * 70 + flickPhase * 6.283)
    return { x1: xTail, y1: yTail, x2: xHead, y2: yHead, opacity: fade * flicker }
  })

  return (
    <AnimatedLine
      x1={cx}
      y1={cy}
      x2={cx}
      y2={cy}
      stroke={colors.magenta}
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

function AmbientField({ t }: { t: SharedValue<number> }) {
  const buckets = useMemo(() => buildAmbientField(), [])
  return (
    <G>
      {buckets.map((stars, bucketIdx) => (
        <AmbientBucket key={bucketIdx} stars={stars} bucketIdx={bucketIdx} t={t} />
      ))}
    </G>
  )
}

function AmbientBucket({
  stars,
  bucketIdx,
  t,
}: {
  stars: AmbientStar[]
  bucketIdx: number
  t: SharedValue<number>
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    const phase = bucketIdx / AMBIENT_BUCKET_COUNT
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    return { opacity: 0.35 + 0.65 * wave }
  })
  return (
    <AnimatedG animatedProps={animatedProps}>
      {stars.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F4ECDE" opacity={s.baseOp * 4} />
      ))}
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
    return { opacity: 0.62 + 0.32 * wave }
  })
  return (
    <AnimatedG animatedProps={starProps}>
      <Path d={fourPointStarPath(cx, cy, 4.5)} fill={colors.magenta} />
    </AnimatedG>
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
  const linesProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(slowT.value * 2 * Math.PI)
    // Parabolic flash: peaks at radialPulse=0.5, zero at 0 and 1, so
    // the silhouette swells with the wave instead of slamming on/off.
    const flash = radialPulse.value * (1 - radialPulse.value) * 2
    const op = 0.78 + 0.44 * wave + flash * 0.5
    return { opacity: op > 1 ? 1 : op }
  })
  return (
    <>
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
              stroke="rgba(244,236,222,0.3)"
              strokeWidth={1.4}
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

/* Soft magenta bloom for hero stars — two stacked low-alpha discs.
 * The hero is each figure's alpha star; the magenta glow makes it
 * "the fuchsia one" — unmistakably the brightest — in both the
 * placeholder and lit states. Drawn behind the star body. */
function HeroGlow({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <Circle cx={cx} cy={cy} r={r * 3.0} fill={colors.magenta} opacity={0.07} />
      <Circle cx={cx} cy={cy} r={r * 1.9} fill={colors.magenta} opacity={0.13} />
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

    const ambient = (0.68 + 0.1 * wave) * twinkleOp
    return {
      opacity: ambient,
      transform: `translate(${s.x} ${s.y}) scale(${scale.toFixed(3)}) translate(${-s.x} ${-s.y})`,
    }
  })

  return (
    <AnimatedG animatedProps={animatedProps}>
      {isHero ? <HeroGlow cx={s.x} cy={s.y} r={baseR} /> : null}
      <Path d={fourPointStarPath(s.x, s.y, baseR)} fill="#F4ECDE" />
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
}) {
  const groupProps = useAnimatedProps(() => {
    'worklet'
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
        return (
          <Line
            key={`l-${idx}`}
            x1={A.x}
            y1={A.y}
            x2={B.x}
            y2={B.y}
            stroke={isLit ? colors.magenta : 'rgba(233,30,99,0.4)'}
            strokeWidth={isLit ? 2.5 : 1.4}
            strokeLinecap="round"
            strokeDasharray={isLit ? undefined : '3 4'}
          />
        )
      })}
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
function CenterText({ cx, cy }: { cx: number; cy: number }) {
  return (
    <SvgText
      x={cx}
      y={cy + 22}
      textAnchor="middle"
      fontFamily={typography.uiBold}
      fontSize={10}
      fill={colors.niebla}
      letterSpacing={2.4}
    >
      DE 28 DÍAS
    </SvgText>
  )
}

/* React Native overlay positioned over the SVG centre. Uses the
 * AnimatedTextInput `text` prop trick (same pattern as StreakNumber)
 * so the integer climb runs on the UI thread without re-rendering
 * React. `marginTop: -22` biases the baseline upward to match the
 * old SvgText y = cy - 4. */
function CenterNumberOverlay({
  displayedCount,
  numberPulse,
  initialCount,
}: {
  displayedCount: SharedValue<number>
  numberPulse: SharedValue<number>
  initialCount: number
}) {
  const rounded = useDerivedValue(() => Math.round(displayedCount.value))
  const textProps = useAnimatedProps(() => {
    const text = String(rounded.value)
    return { text, defaultValue: text } as unknown as Partial<TextInputProps>
  })
  // Opacity ramps from 0.42 at count=0 to 1.0 once the user has marked
  // at least one day — the dim "0" reads as "waiting for you to begin"
  // rather than a bright assertion. Beyond count=1 the number stays at
  // full brightness; scale pulse on commit is layered on top.
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + numberPulse.value * 0.08 }],
    opacity: 0.42 + Math.min(1, displayedCount.value) * 0.58,
  }))
  return (
    <View style={styles.numberOverlay} pointerEvents="none">
      <Animated.View style={pulseStyle}>
        <AnimatedTextInput
          editable={false}
          underlineColorAndroid="transparent"
          animatedProps={textProps}
          defaultValue={String(initialCount)}
          style={styles.numberOverlayText}
        />
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
          return (
            <LitStar
              key={`s-${i}`}
              s={s}
              i={i}
              t={t}
              intensity={intensity}
              litPulse={litPulse}
              recency={recency}
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
      transform: `translate(${s.x} ${s.y}) scale(${scale.toFixed(3)}) translate(${-s.x} ${-s.y})`,
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

  return (
    <G>
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={baseR}
        fill="none"
        stroke="rgba(255,246,229,0.85)"
        strokeWidth={0.8}
        animatedProps={ringProps}
      />
      <AnimatedG animatedProps={starProps}>
        <Path d={fourPointStarPath(s.x, s.y, baseR)} fill="url(#starLit)" />
      </AnimatedG>
    </G>
  )
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
  // so the visible segment slides into view, drawing the line from A
  // to B over the animation.
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    return { strokeDashoffset: length * (1 - igniteT.value) }
  })

  return (
    <AnimatedLine
      x1={A.x}
      y1={A.y}
      x2={B.x}
      y2={B.y}
      stroke={colors.magenta}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeDasharray={`${length} ${length}`}
      animatedProps={animatedProps}
    />
  )
}

/* "Next" was previously inflated (+1.5 radius) with a magenta gradient
 * fill, a big halo and a mid breath — visually it competed with lit
 * stars and made the moment of ignition feel like a downgrade. The
 * redesign keeps it deliberately quiet: same radius as a lit star, a
 * dim magenta fill (0.55 opacity), and a single thin dashed ring that
 * pulses slowly. Reads as "queued, waiting for you" — so when the
 * user marks the day, the flash-to-lit transition feels like a
 * promise fulfilled, not a swap to a lesser state. */
function NextStar({ s, t }: { s: Resolved; t: SharedValue<number> }) {
  const baseR = starRadius(s.mag) + 0.5

  // Ring pulse 0.65 → 1.0 opacity. Brighter range than before so the
  // affordance reads on first glance — this is the spot to fill next.
  // Period ≈ 2.6 s. Faster than the 8 s ambient (it should draw the
  // eye) but well slower than haptic-grade pulses.
  const ringProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI * (8 / 2.6))
    return { opacity: 0.65 + 0.35 * wave }
  })

  // Outer halo ring (larger, faded) gives the next affordance a soft
  // glow that radiates out, so the eye locks on it even at small
  // sizes. Pulses with the same wave but at a lower opacity range.
  const haloProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI * (8 / 2.6))
    return { opacity: 0.18 + 0.22 * wave }
  })

  return (
    <G>
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={baseR + 11}
        fill="none"
        stroke={colors.magenta}
        strokeWidth={1}
        animatedProps={haloProps}
      />
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={baseR + 7}
        fill="none"
        stroke={colors.magenta}
        strokeWidth={2}
        strokeDasharray="3 4"
        strokeLinecap="round"
        animatedProps={ringProps}
      />
      <Path d={fourPointStarPath(s.x, s.y, baseR)} fill="url(#starNext)" opacity={0.85} />
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
  const haloProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    const ambient = (0.22 + 0.16 * wave) * (1 + intensity * 0.5) * haloMult
    return {
      opacity: ambient + litPulse.value * 0.4,
      r: r + 7 * haloMult + litPulse.value * 4,
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
    const boosted = ambient + litPulse.value * 0.15
    return {
      opacity: boosted > 1 ? 1 : boosted,
      transform: `translate(${s.x} ${s.y}) scale(${scale.toFixed(3)}) translate(${-s.x} ${-s.y})`,
    }
  })

  return (
    <G>
      {isHero ? <HeroGlow cx={s.x} cy={s.y} r={r} /> : null}
      <AnimatedCircle cx={s.x} cy={s.y} r={r + 7} fill={colors.magenta} animatedProps={haloProps} />
      <AnimatedG animatedProps={starProps}>
        <Path d={fourPointStarPath(s.x, s.y, r)} fill="url(#starLit)" />
      </AnimatedG>
    </G>
  )
}

/* ─ Completion rings ────────────────────────────────────────────── */

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
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  numberOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberOverlayText: {
    // displaySemi (600) instead of displayHeavy (900) — at 64 px the
    // heavy weight competed with the constellation as visual focus;
    // the constellation is the hero, the count is metadata-on-top.
    // Semibold + smaller size lets the figure breathe while still
    // reading as a hero number.
    fontFamily: typography.displaySemi,
    fontSize: 52,
    color: colors.magenta,
    letterSpacing: -2.6,
    textAlign: 'center',
    // Native magenta glow — replaces the SVG RadialGradient bloom that
    // was rendering as a solid disk on iOS. RN's textShadow works
    // cleanly on both platforms.
    textShadowColor: 'rgba(233,30,99,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    // The SVG drew the number at y = cy - 4 (above geometric centre).
    // RN centres via flex so we bias upward to match the original
    // composition. includeFontPadding off kills Android's extra space.
    marginTop: -18,
    padding: 0,
    includeFontPadding: false,
    minWidth: 80,
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
