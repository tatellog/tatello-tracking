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

type SequenceEl = { type: 'star' | 'line'; idx: number }

type Props = {
  /** 28-day boolean array; index i is the i-th cell. */
  trained: readonly boolean[]
  todayIdx: number
  sign?: ZodiacSign
}

export function LunarConstellation({ trained, todayIdx, sign = 'acuario' }: Props) {
  const zodiac = ZODIAC[sign]
  const cx = W / 2
  const cy = H / 2

  const { trainedCount, elementsLit, sequence, isComplete, label, intensity } = useMemo(
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
  const nextEl: SequenceEl | null = sequence[elementsLit] ?? null

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
    radialPulse.value = withTiming(1, { duration: 950, easing: Easing.out(Easing.cubic) })

    if (elementsLit > prevLit) {
      const newEls = sequence.slice(prevLit, elementsLit)
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
          <BaseLayer zodiac={zodiac} stars={stars} slowT={slowT} radialPulse={radialPulse} />
          <LitLines
            zodiac={zodiac}
            stars={stars}
            litKeys={litKeys}
            nextEl={nextEl}
            ignitingKey={ignitingKey}
            litPulse={litPulse}
          />
          <LineCurrents zodiac={zodiac} stars={stars} litKeys={litKeys} t={t} />
          <StarsLayer
            stars={stars}
            litKeys={litKeys}
            nextEl={nextEl}
            t={t}
            ignitingKey={ignitingKey}
            intensity={intensity}
            litPulse={litPulse}
          />
          <IgnitingOverlay
            zodiac={zodiac}
            stars={stars}
            ignitingKey={ignitingKey}
            igniteT={igniteT}
          />
          <RadialPulse cx={cx} cy={cy} pulse={radialPulse} />
          <CenterText cx={cx} cy={cy} />
          {isComplete ? <CompletionRings cx={cx} cy={cy} t={t} /> : null}
        </Svg>

        <CenterNumberOverlay
          displayedCount={displayedCount}
          numberPulse={numberPulse}
          initialCount={trainedCount}
        />
      </View>

      <Text style={styles.progressLabel}>{label}</Text>

      <View style={styles.zodiacCap}>
        <Text style={styles.zodiacGlyph}>{zodiac.glyph}</Text>
        <Text style={styles.zodiacLabel}>{zodiac.label}</Text>
        {isComplete ? <Text style={styles.zodiacOverflow}> · COMPLETO</Text> : null}
      </View>
    </View>
  )
}

function deriveProgress(
  trained: readonly boolean[],
  todayIdx: number,
  zodiac: ZodiacDef,
): {
  trainedCount: number
  elementsLit: number
  sequence: SequenceEl[]
  isComplete: boolean
  label: string
  /** 0..1 — populated only when totalElements < TARGET_DAYS. Each
   *  overflow day past full constellation adds intensity, which lit
   *  stars and the centre bloom read to grow subtly. */
  intensity: number
} {
  const count = trained.slice(0, todayIdx + 1).filter(Boolean).length
  const nStars = zodiac.stars.length
  const nLines = zodiac.lines.length
  const totalElements = nStars + nLines
  // 1:1 mapping — every tap moves an element until the constellation
  // is fully lit. Previously `round(pct * totalElements)` produced
  // invisible taps on the days where rounding didn't bump (e.g. day 5
  // for a 25-element constellation), which broke the reward loop.
  const lit = Math.min(count, totalElements)
  const complete = count >= TARGET_DAYS
  const pct = Math.min(1, count / TARGET_DAYS)
  const pctRound = Math.round(pct * 100)
  const overflowMax = Math.max(0, TARGET_DAYS - totalElements)
  const overflowDays = Math.max(0, count - totalElements)
  const intensity = overflowMax === 0 ? 0 : Math.min(1, overflowDays / overflowMax)

  // Interleave stars + lines so each line is preceded by both its
  // endpoint stars. Leftover stars trail at the end.
  const seq: SequenceEl[] = []
  const seen = new Set<number>()
  if (nStars > 0) {
    seq.push({ type: 'star', idx: 0 })
    seen.add(0)
  }
  zodiac.lines.forEach((ln, lineIdx) => {
    const [a, b] = ln
    if (!seen.has(a)) {
      seq.push({ type: 'star', idx: a })
      seen.add(a)
    }
    if (!seen.has(b)) {
      seq.push({ type: 'star', idx: b })
      seen.add(b)
    }
    seq.push({ type: 'line', idx: lineIdx })
  })
  for (let i = 0; i < nStars; i++) {
    if (!seen.has(i)) seq.push({ type: 'star', idx: i })
  }

  const lowerLabel = zodiac.label.toLowerCase()
  const titleLabel = zodiac.label.charAt(0) + zodiac.label.slice(1).toLowerCase()
  const label = complete
    ? `${titleLabel} completo`
    : count === 0
      ? `tu ${lowerLabel} te espera`
      : pct < 0.5
        ? `${pctRound}% iluminado`
        : pct < 1
          ? `${pctRound}% · casi`
          : 'completo'

  return {
    trainedCount: count,
    elementsLit: lit,
    sequence: seq,
    isComplete: complete,
    label,
    intensity,
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

/* ─ Radial pulse — magenta wave on each commit ────────────────────
 *
 * Two concentric expanding rings + a soft inner glow. Fired once per
 * day-mark (driven by the parent's `radialPulse` SharedValue 0→1 over
 * ~950 ms). Reads as "energy travelling outward from the centre"
 * which complements the silhouette flash in BaseLayer.
 */
function RadialPulse({ cx, cy, pulse }: { cx: number; cy: number; pulse: SharedValue<number> }) {
  const innerProps = useAnimatedProps(() => {
    'worklet'
    const r = 4 + pulse.value * (W * 0.42)
    return { r, opacity: (1 - pulse.value) * 0.95 }
  })
  const outerProps = useAnimatedProps(() => {
    'worklet'
    const r = 4 + pulse.value * (W * 0.68)
    return { r, opacity: (1 - pulse.value) * 0.6 }
  })
  const glowProps = useAnimatedProps(() => {
    'worklet'
    const r = 8 + pulse.value * 60
    return { r, opacity: (1 - pulse.value) * 0.4 }
  })
  return (
    <G>
      <AnimatedCircle cx={cx} cy={cy} r={0} fill={colors.magenta} animatedProps={glowProps} />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={0}
        fill="none"
        stroke={colors.magenta}
        strokeWidth={3}
        animatedProps={innerProps}
      />
      <AnimatedCircle
        cx={cx}
        cy={cy}
        r={0}
        fill="none"
        stroke="rgba(233,30,99,0.7)"
        strokeWidth={1.8}
        animatedProps={outerProps}
      />
    </G>
  )
}

/* ─ Line currents — bright dots flowing along each lit line ────────
 *
 * One small cream-coloured dot per lit line, travelling A→B over a
 * 3 s cycle derived from the shared 8 s clock. Indexed phase keeps
 * adjacent lines out of sync. Reads as energy / life flowing through
 * the silhouette — "tu cuerpo lo está registrando" made visible.
 */
function LineCurrents({
  zodiac,
  stars,
  litKeys,
  t,
}: {
  zodiac: ZodiacDef
  stars: Resolved[]
  litKeys: Set<string>
  t: SharedValue<number>
}) {
  return (
    <>
      {zodiac.lines.map(([a, b], idx) => {
        if (!litKeys.has(`line-${idx}`)) return null
        const A = stars[a]
        const B = stars[b]
        if (!A || !B) return null
        return <LineCurrent key={`lc-${idx}`} A={A} B={B} t={t} index={idx} />
      })}
    </>
  )
}

function LineCurrent({
  A,
  B,
  t,
  index,
}: {
  A: Resolved
  B: Resolved
  t: SharedValue<number>
  index: number
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet'
    // 3 s cycle (8 / (8/3)) with a per-line phase offset.
    const cycle = (t.value * (8 / 3) + index * 0.21) % 1
    const cx = A.x + (B.x - A.x) * cycle
    const cy = A.y + (B.y - A.y) * cycle
    // Fade in 0..0.12, fade out 0.88..1 — the dot appears near A,
    // bright through the middle, fades out near B.
    let op = 0.85
    if (cycle < 0.12) op = (cycle / 0.12) * 0.85
    else if (cycle > 0.88) op = (1 - (cycle - 0.88) / 0.12) * 0.85
    return { cx, cy, opacity: op }
  })
  return <AnimatedCircle cx={A.x} cy={A.y} r={1.8} fill="#F4ECDE" animatedProps={animatedProps} />
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

/* ─ Base placeholder layer (always visible silhouette) ──────────── */

function BaseLayer({
  zodiac,
  stars,
  slowT,
  radialPulse,
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
}) {
  const groupProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(slowT.value * 2 * Math.PI)
    // Parabolic flash: peaks at radialPulse=0.5, zero at 0 and 1, so
    // the silhouette swells with the wave instead of slamming on/off.
    const flash = radialPulse.value * (1 - radialPulse.value) * 2
    const op = 0.78 + 0.44 * wave + flash * 0.5
    return { opacity: op > 1 ? 1 : op }
  })
  return (
    <AnimatedG animatedProps={groupProps}>
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
      {stars.map((s, i) => (
        <Path
          key={`bs-${i}`}
          d={fourPointStarPath(s.x, s.y, starRadius(s.mag) * 0.7)}
          fill="rgba(244,236,222,0.6)"
        />
      ))}
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
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + numberPulse.value * 0.08 }],
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
}) {
  return (
    <>
      {stars.map((s, i) => {
        const isLit = litKeys.has(`star-${i}`)
        const isNext = nextEl?.type === 'star' && nextEl.idx === i
        if (ignitingKey === `star-${i}`) return null
        if (isNext) return <NextStar key={`s-${i}`} s={s} t={t} />
        if (isLit)
          return (
            <LitStar key={`s-${i}`} s={s} i={i} t={t} intensity={intensity} litPulse={litPulse} />
          )
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

  // Ring pulse 0.45 → 0.85 opacity. Faster than the 8 s ambient (so
  // it draws the eye) but well slower than haptic-grade pulses.
  // Period ≈ 2.6 s.
  const ringProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI * (8 / 2.6))
    return { opacity: 0.45 + 0.4 * wave }
  })

  return (
    <G>
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={baseR + 5.5}
        fill="none"
        stroke={colors.magenta}
        strokeWidth={1.2}
        strokeDasharray="3 4"
        strokeLinecap="round"
        animatedProps={ringProps}
      />
      <Path d={fourPointStarPath(s.x, s.y, baseR)} fill="url(#starNext)" opacity={0.65} />
    </G>
  )
}

function LitStar({
  s,
  i,
  t,
  intensity,
  litPulse,
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
}) {
  const baseR = starRadius(s.mag) + 0.5
  const r = baseR * (1 + intensity * 0.18)

  // Per-star phase offset so adjacent stars breathe out of sync.
  const phase = (i * 0.137) % 1

  const haloProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    const ambient = (0.05 + 0.2 * wave) * (1 + intensity * 0.8)
    return { opacity: ambient + litPulse.value * 0.45, r: r + 5 + litPulse.value * 4 }
  })

  const starProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    const ambient = 0.85 + 0.15 * wave
    // Cap at 1; SVG opacity doesn't accept >1.
    const boosted = ambient + litPulse.value * 0.15
    return { opacity: boosted > 1 ? 1 : boosted }
  })

  return (
    <G>
      <AnimatedCircle
        cx={s.x}
        cy={s.y}
        r={r + 5}
        fill="rgba(244,236,222,0.05)"
        animatedProps={haloProps}
      />
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
    fontFamily: typography.displayHeavy,
    fontSize: 64,
    color: colors.magenta,
    letterSpacing: -3.5,
    textAlign: 'center',
    // Native magenta glow — replaces the SVG RadialGradient bloom that
    // was rendering as a solid disk on iOS. RN's textShadow works
    // cleanly on both platforms.
    textShadowColor: 'rgba(233,30,99,0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    // The SVG drew the number at y = cy - 4 (above geometric centre).
    // RN centres via flex so we bias upward to match the original
    // composition. includeFontPadding off kills Android's extra space.
    marginTop: -22,
    padding: 0,
    includeFontPadding: false,
    minWidth: 90,
  },
  progressLabel: {
    marginTop: 6,
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: 14,
    color: colors.bone,
    textAlign: 'center',
  },
  zodiacCap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 14,
  },
  zodiacGlyph: {
    fontFamily: typography.uiBold,
    fontSize: 16,
    color: colors.magenta,
  },
  zodiacLabel: {
    fontFamily: typography.uiBold,
    fontSize: 10.5,
    color: colors.leche,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  zodiacOverflow: {
    fontFamily: typography.displayHeavy,
    fontSize: 13,
    color: colors.magenta,
    letterSpacing: -0.5,
  },
})
