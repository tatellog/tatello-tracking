import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import Svg, { G, Rect } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { ZODIAC } from '../../zodiac/data'

import { ZodiacEngraving } from '../ZodiacEngraving'

import { AnimatedBlurView } from './animation/animated-components'
import { useCanvasReveal } from './animation/use-canvas-reveal'
import { useConstellationClocks } from './animation/use-clocks'
import { useIgnitionEngine } from './animation/use-ignition-engine'
import { H, PAD, TARGET_DAYS, W } from './constants'
import { deriveProgress } from './data/derive-progress'
import { SIGN_CONSTELLATION_TRANSFORM, SIGN_ENGRAVINGS } from './data/sign-maps'
import { useFigureGeometry } from './data/use-figure-geometry'
import { useLitMaps } from './data/use-lit-maps'
import {
  AmbientField,
  CosmicDust,
  DeepField,
  NebulaPatches,
  ShootingStar,
  StarWinks,
} from './rendering/ambient'
import { StarBurst } from './rendering/burst'
import { FieldStars } from './rendering/field'
import { BaseLayer } from './rendering/figure-base'
import { IgnitingOverlay } from './rendering/ignition'
import { LitClusterAura, LitClusterMotes } from './rendering/lit-cluster'
import { LitLines } from './rendering/lit-lines'
import { StarsLayer } from './rendering/lit-stars'
import { AnticipationCrown, CenterNumberOverlay, CompletionRings } from './rendering/overlay'
import { CanvasSkeleton } from './rendering/skeleton'
import { AmbientGlow, SvgGradients } from './rendering/static'
import type { Props, Resolved, SequenceEl } from './types'

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

  const { alphaPos, starDepth, lineDepth } = useFigureGeometry(zodiac, stars)
  const { litKeys, litCluster, starRecency } = useLitMaps({
    elementsLit,
    sequence,
    trained,
    todayIdx,
    stars,
  })

  // When the user has marked today, suppress the "next" affordance so
  // neither the dashed ring around the upcoming star nor the dashed
  // line preview render. Tomorrow's render will set committed=false
  // again and the next affordance reappears.
  const nextEl: SequenceEl | null = committed ? null : (sequence[elementsLit] ?? null)

  const { t, breathT, driftT } = useConstellationClocks()
  const { canvasReady, blurMounted, blurStyle } = useCanvasReveal()
  const { ignitingKey, igniteT, numberPulse, displayedCount, litPulse, radialPulse, plusOne } =
    useIgnitionEngine({ trainedCount, elementsLit, sequence })

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
              <SvgGradients zodiac={zodiac} stars={stars} />
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
                  radialPulse={radialPulse}
                  t={t}
                  litKeys={litKeys}
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
              <StarBurst cx={cx} cy={cy} pulse={radialPulse} trainedCount={trainedCount} />
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
            {/* Rack-focus blur. Born at intensity 18 (matching the
                skeleton's BlurView) so the cross-fade reads as a single
                image dissolving; wrapper opacity fades to 0 over 700 ms
                so the constellation comes into sharp focus, then the
                whole BlurView unmounts to free the GPU layer. */}
            {blurMounted ? (
              <Animated.View style={[StyleSheet.absoluteFill, blurStyle]} pointerEvents="none">
                <AnimatedBlurView
                  intensity={18}
                  tint="dark"
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
              </Animated.View>
            ) : null}
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
