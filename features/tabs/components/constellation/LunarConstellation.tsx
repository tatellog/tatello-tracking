import { useIsFocused } from '@react-navigation/native'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated'
import Svg, { G, Rect } from 'react-native-svg'

import { useTransformProgress } from '@/features/emblem'
import { colors, typography } from '@/theme'

import { ZODIAC } from '../../zodiac/data'
import type { ZodiacSign } from '../../zodiac/types'

import { AnimatedBlurView } from './animation/animated-components'
import { useCanvasReveal } from './animation/use-canvas-reveal'
import { useConstellationClocks } from './animation/use-clocks'
import { useIgnitionEngine } from './animation/use-ignition-engine'
import { H, PAD, TARGET_DAYS, W } from './constants'
import { deriveProgress } from './data/derive-progress'
import { SIGN_CONSTELLATION_TRANSFORM_PARAMS } from './data/sign-maps'
import { useFigureGeometry } from './data/use-figure-geometry'
import { useLitMaps } from './data/use-lit-maps'
import {
  AmbientField,
  CosmicDust,
  DeepField,
  NebulaPatches,
  ShootingStar,
} from './rendering/ambient'
import { StarBurst } from './rendering/burst'
import { FieldStars } from './rendering/field'
import { BaseLayer } from './rendering/figure-base'
import { IgnitingOverlay, LottieIgnitionBurst } from './rendering/ignition'
import { LitClusterAura, LitClusterMotes } from './rendering/lit-cluster'
import { LitLines } from './rendering/lit-lines'
import { SkiaLitFlareLayer, StarsLayer, type SkiaLit } from './rendering/lit-stars'
import { SkiaFigure } from './rendering/skia-figure/skia-figure'
import { AnticipationCrown, CenterNumberOverlay, CompletionRings } from './rendering/overlay'
import { CanvasSkeleton } from './rendering/skeleton'
import { AmbientGlow, SvgGradients } from './rendering/static'
import { RevealedEmblem } from './RevealedEmblem'
import type { Props, Resolved, SequenceEl } from './types'

// FASE 3 (en progreso): render de la FIGURA en Skia en vez de react-native-svg.
// Flag de migración — APAGADO mientras se portan las rebanadas (líneas + cuerpos
// → halos → flares → ignición). Con `false` la figura SVG actual se usa tal cual
// (cero cambio). Prender solo para validar la versión Skia en Expo Go.
const USE_SKIA_FIGURE = true

// Emblema Celeste (transformación personal, sistema independiente de la
// constelación natal). El progreso REAL viene de useTransformProgress
// (RPC retroactiva sobre daily_signals); el chip DEV de la esquina
// permite forzar estos pasos para validar el reveal (real → 0 → 25 →
// 50 → 75 → 100 → real). El número jamás se muestra al usuario.
const TRANSFORM_STEPS = [0, 25, 50, 75, 100] as const

// Factor de tamaño de la constelación (< 1 = más pequeña) respecto a su
// transform por signo. Se aplica sobre el centroide para no descentrar.
const CONSTELLATION_SCALE = 0.9
// Espejo horizontal (eje Y) de la constelación para que mire al mismo
// lado que el animal del emblema. Activo por default…
const CONSTELLATION_FLIP_X = true
// …salvo estos signos, que NO se espejan en horizontal. Escorpio se mapea
// directo a la anatomía (sin espejo), por eso va aquí.
const NO_FLIP_SIGNS = new Set<ZodiacSign>([
  'tauro',
  'cancer',
  'escorpio',
  'virgo',
  'capricornio',
  'sagitario',
])
// Signos que TAMBIÉN se espejan en vertical (flip eje X).
const FLIP_Y_SIGNS = new Set<ZodiacSign>([])
// Rotación por signo en grados (sobre el centroide). Para alinear el
// asterismo con su animal cuando hace falta inclinarlo. Default 0.
const CONSTELLATION_ROTATION: Partial<Record<ZodiacSign, number>> = {
  tauro: -15,
  piscis: -24,
}
// Nudge vertical por signo en unidades de viewBox (negativo = arriba).
const CONSTELLATION_NUDGE_Y: Partial<Record<ZodiacSign, number>> = {
  tauro: -16,
  cancer: -16,
  escorpio: -10,
  virgo: -16,
  libra: -12,
  capricornio: -12,
  sagitario: -10,
  piscis: 12,
}
// Nudge horizontal por signo (negativo = izquierda). Translate puro, no lo
// afecta el espejo.
const CONSTELLATION_NUDGE_X: Partial<Record<ZodiacSign, number>> = {
  libra: 30,
  sagitario: 20,
  piscis: 12,
}

export function LunarConstellation({
  trained,
  todayIdx,
  target = TARGET_DAYS,
  sign = 'acuario',
  committed = false,
  showCount = true,
  suppressBurst = false,
  pausedSV,
  transformProgressOverride,
  showStarLabels = false,
}: Props) {
  const zodiac = ZODIAC[sign]
  const cx = W / 2
  const cy = H / 2

  // iOS "Reducir movimiento". Read ONCE here (same source as the reveal
  // at app/onboarding/appointment.tsx) and threaded down: the three
  // master clocks park at static rest values (so the figure stays lit +
  // legible, just still), the per-loop affordances that can't derive a
  // static rest from a frozen clock (NextStar halo, TodayRing) branch
  // their own worklets via this flag, and pure ambient (shooting stars,
  // dust, winks, skeleton ping-pong) is suppressed. With reduce OFF
  // nothing below changes — every clock + worklet runs exactly as today.
  const reduceMotion = useReducedMotion()

  const {
    trainedCount,
    elementsLit,
    sequence,
    fieldStars,
    figureCount,
    figureComplete,
    extraLit,
    intensity,
  } = useMemo(
    () => deriveProgress(trained, todayIdx, zodiac, target),
    [trained, todayIdx, zodiac, target],
  )

  const stars: Resolved[] = useMemo(() => {
    const base = zodiac.stars.map((s) => ({
      x: PAD + s.x * (W - 2 * PAD),
      y: PAD + s.y * (H - 2 * PAD),
      mag: s.mag,
    }))
    // Rotación por signo (sobre el centroide → no descentra). Alimenta a
    // todas las capas (SVG + Skia) porque todas leen `stars`.
    const deg = CONSTELLATION_ROTATION[sign] ?? 0
    if (!deg) return base
    const cx = base.reduce((a, s) => a + s.x, 0) / base.length
    const cy = base.reduce((a, s) => a + s.y, 0) / base.length
    const rad = (deg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    return base.map((s) => ({
      x: cx + (s.x - cx) * cos - (s.y - cy) * sin,
      y: cy + (s.x - cx) * sin + (s.y - cy) * cos,
      mag: s.mag,
    }))
  }, [zodiac, sign])

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

  // Off-tab gate (React): the UI-thread withRepeat clocks don't stop on their
  // own → they'd tax the whole app forever after a single visit, so we cancel
  // them when the tab loses focus. The scroll/reward pause is handled SEPARATELY
  // by `pausedSV` (a SharedValue) so it never re-renders this component — see
  // useConstellationClocks. INVISIBLE on-tab: while focused nothing changes.
  const focused = useIsFocused()
  const { t, breathT, driftT } = useConstellationClocks(reduceMotion, focused, pausedSV)
  const { canvasReady, blurMounted, blurStyle } = useCanvasReveal()
  const { ignitingKey, igniteT, numberPulse, displayedCount, litPulse, radialPulse, plusOne } =
    useIgnitionEngine({ trainedCount, elementsLit, sequence, trained, todayIdx })

  // Measured canvas size — drives the Skia flare layer + Lottie ignition
  // burst position math. 0 until first layout (both overlays withhold).
  // `k` = pixels per viewBox unit (svg is square, W = H = 290).
  const [canvasPx, setCanvasPx] = useState(0)
  const onCanvasLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w !== canvasPx) setCanvasPx(w)
  }
  const k = canvasPx / W

  // Emblema Celeste: progreso real (hábitos acumulados, retroactivo) +
  // override DEV opcional. null = real; un índice = paso mockeado.
  // Los 12 signos tienen emblema (RevealedEmblem); REEMPLAZA al engraving
  // PNG viejo (dos artes encimadas se leían como doble exposición).
  const hasEmblem = true
  const emblem = useTransformProgress()
  const [mockStep, setMockStep] = useState<number | null>(null)
  // Prioridad: override DEV (catálogo de estados) > chip DEV > dato real.
  const transformProgress =
    transformProgressOverride != null
      ? transformProgressOverride
      : mockStep == null
        ? emblem.progress
        : (TRANSFORM_STEPS[mockStep] ?? 0)

  // La constelación es el DATO y debe ganar — apenas cede al emblema. Se
  // atenúa un pelín mientras el emblema se revela (bajo %) pero nunca baja
  // de 0.82, así nunca queda tapada por el marco dorado.
  const emblemDim = hasEmblem ? 0.82 + 0.18 * Math.min(1, transformProgress / 55) : 1

  // Apply SIGN_CONSTELLATION_TRANSFORM in JS so the Skia overlay (which
  // can't read the SVG <G transform="...">) can position each star at
  // the same pixel as the SVG-rendered body.
  // Constelación un poco MÁS PEQUEÑA respecto al emblema: se encoge sobre
  // su propio centroide (uniforme para los 12) sin descentrarse. El
  // emblema (RevealedEmblem) es un poco más grande; juntos respiran mejor.
  const rawTransform = SIGN_CONSTELLATION_TRANSFORM_PARAMS[sign]
  const bcx = stars.length ? stars.reduce((a, s) => a + s.x, 0) / stars.length : 0
  const bcy = stars.length ? stars.reduce((a, s) => a + s.y, 0) / stars.length : 0
  // Encoge sobre el centroide…
  const sx0 = rawTransform.sx * CONSTELLATION_SCALE
  const sy0 = rawTransform.sy * CONSTELLATION_SCALE
  const tx0 =
    rawTransform.tx +
    rawTransform.sx * bcx * (1 - CONSTELLATION_SCALE) +
    (CONSTELLATION_NUDGE_X[sign] ?? 0)
  const ty0 =
    rawTransform.ty +
    rawTransform.sy * bcy * (1 - CONSTELLATION_SCALE) +
    (CONSTELLATION_NUDGE_Y[sign] ?? 0)
  // …y ESPEJOS sobre el centroide (scale negativo + re-translate), por eje
  // independiente. Horizontal (eje Y) = mira al mismo lado que el emblema;
  // vertical (eje X) = signos que lo necesitan (p. ej. escorpio).
  const flipX = CONSTELLATION_FLIP_X && !NO_FLIP_SIGNS.has(sign)
  const flipY = FLIP_Y_SIGNS.has(sign)
  const transform = {
    sx: flipX ? -sx0 : sx0,
    sy: flipY ? -sy0 : sy0,
    tx: flipX ? tx0 + 2 * sx0 * bcx : tx0,
    ty: flipY ? ty0 + 2 * sy0 * bcy : ty0,
  }
  const toScreen = (xVb: number, yVb: number) => ({
    x: (transform.tx + transform.sx * xVb) * k,
    y: (transform.ty + transform.sy * yVb) * k,
  })
  // Pixel scale para radios / grosores en la figura Skia. ABS porque sx
  // puede ser negativo (espejo) y un radio negativo rompería el render.
  const sScale = Math.abs(transform.sx) * k

  // Array-form transform for the SVG <G>. We can't use the string
  // form `"translate(tx ty) scale(sx sy)"` because on Fabric Android
  // the RNSVGGroup ViewManager expects a ReadableArray, not a String,
  // and crashes with ClassCastException at mount. The array form is
  // accepted on both arch types in react-native-svg 15+.
  const signTransform = [
    { translateX: transform.tx },
    { translateY: transform.ty },
    { scaleX: transform.sx },
    { scaleY: transform.sy },
  ]

  // Lit stars in pixel-space → fed to the Skia flare layer. Stripped
  // down to {x, y, mag} so the worklet only re-renders on actual layout
  // changes, not on the broader stars/litKeys identity churn.
  const skiaLit: SkiaLit[] = useMemo(() => {
    if (k <= 0) return []
    return stars.flatMap((s, i) => {
      if (!litKeys.has(`star-${i}`)) return []
      const p = toScreen(s.x, s.y)
      return [{ x: p.x, y: p.y, mag: s.mag }]
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stars, litKeys, k, transform.tx, transform.ty, transform.sx, transform.sy])

  // Pixel position of the currently igniting star (if any). Used to
  // place the scoped Lottie burst. Lines don't get a Lottie — the SVG
  // stroke-trace already reads as a meteor draw, no fireworks needed.
  const ignitionPos = useMemo(() => {
    if (!ignitingKey || k <= 0) return null
    const [kind, idxStr] = ignitingKey.split('-')
    if (kind !== 'star') return null
    const idx = Number(idxStr)
    const s = stars[idx]
    if (!s) return null
    return toScreen(s.x, s.y)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ignitingKey, stars, k, transform.tx, transform.ty, transform.sx, transform.sy])

  return (
    <View style={styles.wrap}>
      <View style={styles.svgWrap} onLayout={onCanvasLayout}>
        {/* (Removido) El PNG de fondo por signo (ZodiacEngraving fuera del
            <Svg>) era el backdrop SOLO para signos sin emblema. Hoy los 12
            signos tienen Emblema Celeste (hasEmblem === true), así que esa
            rama era código muerto: nunca se montaba pero su useAnimatedStyle
            (artStyle) se registraba en cada render. Si algún signo vuelve a
            no tener emblema, el backdrop vive en git. */}
        {/* Emblema Celeste: capa de TRANSFORMACIÓN, el ÚNICO arte de
            fondo en Leo. Sistema independiente: la constelación de arriba
            sigue respondiendo SOLO a "Entrené"; el emblema, a los hábitos
            acumulados. Arte RASTER (arch.png + <sign>-c.png) revelado por
            luminancia: se "va formando" con el progreso. Z-order: bajo el
            <Svg> de la figura — la viñeta + edge-fade lo oscurecen igual
            que al PNG. */}
        {/* SOLO se monta el Canvas Skia del emblema cuando Hoy está
            enfocado. Dos RevealedEmblem (este + el del hero de Órbita Mes)
            montados a la vez en pantallas distintas se borran mutuamente
            (cada TextureView Skia pelea por el contexto). Al desmontar el
            de la pantalla sin foco, nunca coexisten dos → ninguno se borra.
            useImage cachea las texturas: el remount al volver es inmediato. */}
        {hasEmblem && focused ? (
          <RevealedEmblem sign={sign} transformProgress={transformProgress} size={canvasPx} />
        ) : null}
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
              transform={signTransform}
              reduce={reduceMotion}
            />
          </Animated.View>
        )}
        {canvasReady ? (
          <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(260)}>
            <Svg viewBox={`0 0 ${W} ${H}`} style={styles.svg}>
              <SvgGradients zodiac={zodiac} stars={stars} />
              <DeepField drift={driftT} />
              <AmbientField t={t} drift={driftT} />
              {/* StarWinks (random 4-point flashes) retiradas: su destello
              blanco de 4 puntas se leía como una estrella de la figura
              suelta. El "cielo vivo" lo dan ahora el campo de puntos, el
              polvo y las shooting stars. */}
              {/* Three shooting stars staggered in phase and crossing
              the canvas at different heights — the field feels
              alive without any single streak being constant. Pure
              ambient → suppressed under reduce-motion (a static t
              would freeze a streak mid-canvas). */}
              {reduceMotion ? null : (
                <>
                  <ShootingStar t={t} cycleDiv={1.6} phase={0} startY={40} endY={H * 0.55} />
                  <ShootingStar
                    t={t}
                    cycleDiv={1.6}
                    phase={0.42}
                    startY={H * 0.15}
                    endY={H * 0.85}
                  />
                  <ShootingStar t={t} cycleDiv={1.6} phase={0.74} startY={H * 0.7} endY={H * 0.3} />
                </>
              )}
              <AmbientGlow cx={cx} cy={cy} />
              <NebulaPatches ax={alphaPos.x} ay={alphaPos.y} drift={driftT} />
              {/* Cosmic dust — drifting motes catching ambient light.
              Sits between the nebula and the lion engraving so it
              feels like atmosphere passing through the foreground.
              Ambient → suppressed under reduce-motion (motes parked
              at a static t would freeze mid-rise). */}
              {reduceMotion ? null : <CosmicDust t={t} />}
              {/* Sign art moved OUT of the <Svg> to a sibling RN Image (see the
              top of svgWrap) — on Android the in-SVG PNG re-rasterised and
              jumped left on every scroll frame. The vignette + edgeFade Rects
              below still darken it through the transparent SVG, so the blend is
              identical. ZodiacEngraving stays for the Órbita/reveal callers. */}
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
              {USE_SKIA_FIGURE ? null : (
                <G transform={signTransform} opacity={emblemDim}>
                  {litCluster ? (
                    <>
                      <LitClusterAura
                        cx={litCluster.cx}
                        cy={litCluster.cy}
                        r={litCluster.r}
                        breathT={breathT}
                      />
                      <LitClusterMotes
                        cx={litCluster.cx}
                        cy={litCluster.cy}
                        r={litCluster.r}
                        t={t}
                      />
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
                    reduce={reduceMotion}
                  />
                  <IgnitingOverlay
                    zodiac={zodiac}
                    stars={stars}
                    ignitingKey={ignitingKey}
                    igniteT={igniteT}
                  />
                </G>
              )}
              {/* CenterOrb + CenterScrim removed — they were the
              luminous well behind the giant centre number. With
              the count now living as a small chip at the canvas
              floor (numberRow.marginTop 122), the orb was an
              orphan magenta wash competing with the asterism. */}
              {/* The commit firework — a magenta StarBurst that blooms
                  from the canvas centre (cx,cy) and grows outward on
                  radialPulse (Órbita, dev, refactor-test). The Home
                  suppresses it (suppressBurst) and uses a native Lottie
                  firework overlay instead — its in-SVG burst would
                  otherwise double up with the Lottie. */}
              {suppressBurst ? null : (
                <StarBurst cx={cx} cy={cy} pulse={radialPulse} trainedCount={trainedCount} />
              )}
              {/* Anticipation crown — appears in the last few elements
              before the FIGURE completes, a tenue cream ring around the
              canvas centre that grows + brightens approaching the
              asterism's last star. Builds psychological tension for the
              final stretch toward "tu figura brilla entera". */}
              {figureCount > 6 && trainedCount >= figureCount - 4 && !figureComplete ? (
                <AnticipationCrown
                  cx={cx}
                  cy={cy}
                  proximity={Math.min(1, (trainedCount - (figureCount - 5)) / 4)}
                  breathT={breathT}
                />
              ) : null}
              {figureComplete ? <CompletionRings cx={cx} cy={cy} t={t} /> : null}
            </Svg>
            {/* FASE 3: figura en Skia (líneas + cuerpos). Reemplaza el <G>
                figura del SVG de arriba cuando el flag está prendido. */}
            {USE_SKIA_FIGURE && canvasPx > 0 ? (
              <SkiaFigure
                stars={stars}
                lines={zodiac.lines}
                litKeys={litKeys}
                nextEl={nextEl}
                starRecency={starRecency}
                starDepth={starDepth}
                toScreen={toScreen}
                sScale={sScale}
                t={t}
                breathT={breathT}
                reduce={reduceMotion}
              />
            ) : null}
            {/* Skia volumetric flare crown — sits on top of the SVG so
                each lit star gets a real Gaussian-blurred magenta+cream
                bloom + additive diffraction cross. The SVG body below
                stays the crisp anchor; this layer just adds the lens
                halo SVG can't fake (BlurMask, blendMode=screen/plus). */}
            {canvasPx > 0 ? (
              <SkiaLitFlareLayer
                lit={skiaLit}
                breathT={breathT}
                reduce={reduceMotion}
                opacity={emblemDim}
              />
            ) : null}
            {/* DEV — etiquetas de estrellas para identificarlas al afinar.
                Fuera del <G> espejado: usan toScreen (ya considera el
                espejo) y se dibujan derechas, no al revés. */}
            {showStarLabels && canvasPx > 0
              ? stars.map((s, i) => {
                  const p = toScreen(s.x, s.y)
                  return (
                    <Text
                      key={`lbl-${i}`}
                      style={[styles.starLabel, { left: p.x + 5, top: p.y - 7 }]}
                    >
                      {zodiac.stars[i]?.name ?? String(i)}
                    </Text>
                  )
                })
              : null}
            {/* Lottie one-shot — the same gold-fireworks the Home commit
                reward uses, but SCOPED to the igniting star instead of
                covering the whole canvas. Backs the SVG ignition burst
                with gold particle warmth. Suppressed under reduce-motion
                (Lottie can't park at a static frame from a frozen clock). */}
            {!reduceMotion && ignitionPos && ignitingKey ? (
              <LottieIgnitionBurst
                pos={ignitionPos}
                size={canvasPx * 0.32}
                igniteKey={ignitingKey}
              />
            ) : null}
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
        {/* Portrait frame — a sibling overlay, NOT a wrapper clip. Draws the
            rounded bronze hairline on top of the SVG + Skia layers without
            forcing a rounded `overflow:hidden` clip over the separate Skia
            surfaces (the Android scroll-swim cause). Non-interactive. */}
        <View style={styles.frameOverlay} pointerEvents="none" />
        {/* Chip DEV del emblema: muestra el progreso vigente y cada tap
            cicla real → 0 → 25 → 50 → 75 → 100 → real. Solo __DEV__:
            el porcentaje es debug, nunca producto. */}
        {__DEV__ && hasEmblem ? (
          <Pressable
            style={styles.devTransformChip}
            hitSlop={8}
            onPress={() =>
              setMockStep((s) => {
                const next = s == null ? 0 : s + 1
                return next >= TRANSFORM_STEPS.length ? null : next
              })
            }
          >
            <Text style={styles.devTransformText}>
              emblema {transformProgress}% · {mockStep == null ? 'real' : 'mock'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Chip footer — count + denominator rendered as a proper
          footer row OUTSIDE the SVG, so the chip never overlaps
          the constellation lines. Gated by `showCount` (default true):
          Día 1 hides it so a big "1/28" doesn't read as debt. */}
      {showCount ? (
        <CenterNumberOverlay
          displayedCount={displayedCount}
          numberPulse={numberPulse}
          plusOne={plusOne}
          initialCount={trainedCount}
          urgent={trainedCount >= figureCount - 3 && !figureComplete}
          remaining={Math.max(0, figureCount - trainedCount)}
          target={figureCount}
        />
      ) : null}

      {/* The reward — once the asterism is fully lit. Manifesto-safe:
          completing the FIGURE (achievable, rest-friendly), not the
          whole month. Days beyond read as "luz extra", never debt. */}
      {figureComplete ? (
        <View style={styles.completionCap}>
          <Text style={styles.completionLabel}>TU FIGURA BRILLA ENTERA</Text>
          <Text style={styles.completionPoem}>
            {extraLit > 0
              ? `Lo que sigue es luz extra · +${extraLit}`
              : 'Lo que sigue es luz extra.'}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  // DEV — etiqueta de estrella (nombre o índice) para identificar al afinar.
  starLabel: {
    position: 'absolute',
    fontSize: 8,
    fontWeight: '600',
    color: '#7BE0FF',
    textShadowColor: '#000',
    textShadowRadius: 2,
  },
  wrap: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 4,
  },
  svgWrap: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    // The rounded border + `overflow:'hidden'` used to live HERE — but on
    // Android a rounded overflow-clip over the nested Skia <Canvas> surfaces
    // (each its own TextureView) desynced from the RN view tree on EVERY
    // scroll frame → the figure "swam"/jumped relative to the SVG backdrop
    // ("el emblema se mueve al scrollear"). Órbita's Skia wrap is unclipped
    // and never jumped — that was the decisive difference. The frame is now a
    // sibling overlay (`frameOverlay`) that does NOT clip the surfaces.
    borderRadius: 22,
  },
  // The portrait frame drawn as a non-clipping overlay ON TOP of the SVG +
  // Skia layers: the rounded bronze hairline reads exactly as before, but with
  // no children and no `overflow:'hidden'` it imposes no clip mask on the Skia
  // surfaces below — so they translate in lockstep with the scroll.
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: 'rgba(217, 174, 111, 0.32)',
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  // PRUEBA — chip DEV del emblema: esquina superior derecha, sobre el frame.
  devTransformChip: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderWidth: 1,
    borderColor: colors.oroHairline,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: 'rgba(10, 6, 8, 0.6)',
  },
  devTransformText: {
    fontFamily: typography.uiMedium,
    fontSize: 10,
    color: colors.oro,
    letterSpacing: 0.4,
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
  // Coach voice — Cormorant italic, the poetic register reserved for
  // emotional lines. "Luz extra" reframes the post-figure days as bonus.
  completionPoem: {
    fontFamily: typography.serif,
    fontStyle: 'italic',
    fontSize: typography.sizes.body,
    color: colors.bone,
    marginTop: 4,
    textAlign: 'center',
  },
})
