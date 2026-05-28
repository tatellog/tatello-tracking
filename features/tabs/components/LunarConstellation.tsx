import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View, type TextInputProps } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
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
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { ZODIAC } from '../zodiac/data'
import type { ZodiacDef } from '../zodiac/types'

import { ZodiacEngraving } from './ZodiacEngraving'
import {
  AnimatedBlurView,
  AnimatedCircle,
  AnimatedG,
  AnimatedLine,
  AnimatedTextInput,
} from './constellation/animation/animated-components'
import {
  AmbientField,
  CosmicDust,
  DeepField,
  NebulaPatches,
  ShootingStar,
  StarWinks,
} from './constellation/rendering/ambient'
import { FieldStars } from './constellation/rendering/field'
import { BaseLayer, HeroGlow } from './constellation/rendering/figure-base'
import { LitClusterAura, LitClusterMotes } from './constellation/rendering/lit-cluster'
import { LitLines } from './constellation/rendering/lit-lines'
import { StarsLayer } from './constellation/rendering/lit-stars'
import { CanvasSkeleton } from './constellation/rendering/skeleton'
import { AmbientGlow, StarSparkle, SvgGradients } from './constellation/rendering/static'
import {
  H,
  HERO_MAG,
  IGNITE_LINE_MS,
  IGNITE_STAR_MS,
  NUMBER_COUNTUP_MS,
  PAD,
  PARTICLE_BASE,
  PARTICLE_REACH,
  SPARK_BASE,
  TARGET_DAYS,
  W,
} from './constellation/constants'
import { SIGN_CONSTELLATION_TRANSFORM, SIGN_ENGRAVINGS } from './constellation/data/sign-maps'
import { deriveProgress } from './constellation/data/derive-progress'
import { BURST_ANGLES, SPARK_HUES } from './constellation/data/scatter'
import {
  burstHash,
  fourPointStarPath,
  recencyHaloMultiplier,
  starRadius,
} from './constellation/geometry'
import type { Props, Resolved, SequenceEl } from './constellation/types'

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
  // The zodiac-art SVG (a react-native-svg-transformer component
  // nested inside our parent <Svg>) mis-sizes on the very first
  // paint — it briefly renders at its file's intrinsic 1254 × 1254
  // before honouring the width/height props, leaving the art
  // clipped to the canvas's top-left for one frame. Hold the canvas
  // behind the skeleton for 1000 ms so (a) the nested Svg has
  // settled, and (b) the skeleton's drawing animation completes
  // one full pass before we fade the real composition in — the
  // user reads "the cosmos was plotted", then the real sign appears.
  const [canvasReady, setCanvasReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setCanvasReady(true), 1500)
    return () => clearTimeout(timer)
  }, [])
  // Rack-focus blur on the real Svg. The Svg is born matching the
  // skeleton's blur intensity (18) so the cross-fade reads "same
  // image, just dissolving"; then over 700 ms after canvasReady
  // the blur drains to 0 so the constellation + art comes into
  // sharp focus. Without this the cross-fade jumps from BLURRED
  // (skeleton) to SHARP (Svg) and the eye reads two visual
  // registers instead of one continuous transition.
  const revealBlur = useSharedValue(18)
  useEffect(() => {
    if (!canvasReady) return
    revealBlur.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) })
  }, [canvasReady, revealBlur])
  const revealBlurProps = useAnimatedProps(() => ({
    intensity: revealBlur.value,
  }))

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
        {/* Skeleton wrapped in Animated.View with `exiting` so it
            stays alive (fading out over 320 ms) while the real Svg
            below fades in (260 ms). Their opacities overlap — the
            user reads "skeleton dissolving into the real
            constellation" with no blank-canvas frame in between. */}
        {canvasReady ? null : (
          <Animated.View
            style={StyleSheet.absoluteFill}
            exiting={FadeOut.duration(320)}
            pointerEvents="none"
          >
            <CanvasSkeleton
              stars={stars}
              lines={zodiac.lines}
              transform={SIGN_CONSTELLATION_TRANSFORM[sign]}
            />
          </Animated.View>
        )}
        {canvasReady ? (
          <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(260)}>
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
            {/* Rack-focus blur. Born at 18 (matching the skeleton's
                BlurView) so the cross-fade reads as a single image
                dissolving; ramps to 0 over 700 ms so the
                constellation + art comes into sharp focus. */}
            <AnimatedBlurView
              animatedProps={revealBlurProps}
              tint="dark"
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
          </Animated.View>
        ) : null}
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
    fontSize: typography.sizes.displaySm,
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
    fontSize: typography.sizes.body,
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
    fontSize: typography.sizes.micro,
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
    fontSize: typography.sizes.segmentTitle,
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
