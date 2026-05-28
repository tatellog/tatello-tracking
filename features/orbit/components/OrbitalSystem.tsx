import * as Haptics from 'expo-haptics'
// Aliased — react-native-svg also exports a LinearGradient.
import { LinearGradient as FadeGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
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
  Image as SvgImage,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import { colors, typography } from '@/theme'

import { DIM_LABEL } from '../constants/dimensionColors'

import {
  CONSTELLATION_COLORS,
  getConstellationProfile,
  type ConstellationIntensity,
  type ConstellationProfile,
} from '../constants/constellationTheme'
import { EN_LUZ_THRESHOLD, type Dimension, type DimensionKey } from '../logic'

import { GLYPHS } from './dimensionGlyphs'

const DAY_ORB_PNG = require('@/assets/orbits-art/day-orb.png')

// Glyphs are authored in a 24×24 viewport. Bumped 1.5× → 2.6×
// after the raster rose-gold icons started reading as small
// blobs inside the bigger coloured halo — at this scale the
// illustrated detail of each icon is legible and the icon
// becomes the unambiguous emblem of the zoomed dimension.
const GLYPH_SCALE = 2.6
const GLYPH_HALF = 12

/*
 * The orbital diagram — the hero of the Día segment. Inspired by
 * long-exposure photographs of star paths near a central body: the
 * ORBITS are the visual subject — thin glowing magenta ellipses,
 * each with its own inclination and rotation, intersecting near the
 * core like real orbital traces. The dimensions are small luminous
 * stars (not big shaded spheres) sitting at the tip of their orbit's
 * major axis. Brightness drives orbit opacity, line weight, star
 * size and bloom — so a bright dimension burns clearly, a quiet one
 * recedes into the deep field.
 * See docs/tu-orbita-design.md.
 */

const W = 372
const CX = W / 2
const CY = W / 2
const HIT = 66 // tap-target box, in px

// The visible window. It starts above y=0 so the topmost dimension
// (MENTE sits near the canvas top) keeps its full bloom — plus its
// breath and tap-pop headroom — inside the frame instead of clipping
// against the edge. The height extends to match so nothing squishes.
const VB_TOP = -28
const VB_H = 382
// Zoom factor for the selected-dimension cinematic. Currently
// 2.6 — a Genshin Constellation-style focus event where the
// selected star + its glyph dominate the frame and the rest of
// the figure goes intentionally off-screen. With the bigger base
// ART_S (0.4) + DIM_SCALE 1.35 the off-screen part is the bulk of
// the galaxy + the 5 other stars; that's the point — the
// selection is meant to feel like the camera flew in on one
// luminous body.
const ZOOM_SCALE = 2.6

// ConstellationDrawing is authored in a 1024 × 1024 SVG space
// (daily_constellation.svg); we project it into our viewBox via a
// single transform. ORNAMENT_S scales source-space units into
// viewBox units; ORNAMENT_TX/TY shift the source centre (512, 512)
// onto the canvas centre (216, 163 — same place the old 1200-space
// figure landed). The same transform is used both on the <G> that
// renders the drawing AND on the star positions below — keeping
// the live stars perfectly aligned with the drawn orbits.
//
// ORNAMENT_S 0.31 → 0.363 keeps the figure at the same on-screen
// size after the source dropped 1200 → 1024 (1024 × 0.363 ≈ 372,
// matching the viewBox width). Cardinal ornaments at source
// r ≈ 475 from centre extend slightly past the viewBox right edge
// at this scale; that's intentional — they're decorative diamond
// tips and the small clipping reads as them fading off the figure.
const ORNAMENT_S = 0.363
// ORNAMENT_TX shifted 30 → 0 to recentre the figure horizontally
// inside the now full-width orbital container. With 0 the figure
// centre lands exactly on the viewBox midpoint (186): 0 + 1024 ·
// 0.363 / 2 ≈ 186. Galaxy, six stars, labels all translate left
// in sync because STAR_POS/ART_CENTER_X derive from ORNAMENT_TX.
const ORNAMENT_TX = 0
const ORNAMENT_TY = -23

// The Day-segment art PNG (`day-orb.png`) is authored in a
// 1254 × 1254 source space and already carries the photographic
// galaxy + the 6 dimension star halos + the orbital ring baked in.
// We project it to the same 372 px on-screen extent + (216, 163)
// figure centre the original AnimatedConstellation used so the
// programmatic StarNode positions (STAR_POS) land on top of the
// painted halos. Programmatic orbital scaffolding (the 7 dashed
// rings + per-star Saturn rings + galaxy-bulge gradient) was
// removed because it would duplicate what the PNG already paints.
const ART_SRC = 1254
// Bumped 0.297 → 0.4 so the galaxy reads big enough to dominate
// the (narrow) orbital container next to the right-side
// DimensionNodeList. The painted halos in day-orb.png sit at
// source radius ≈ 370 (measured by scanning bright-pixel
// clusters); at S = 0.4 they land at viewBox radius ≈ 148. We
// rescale STAR_POS by the matching DIM_SCALE = 1.35 below so the
// programmatic StarNodes still drop directly onto the painted
// halos. PNG corners now extend a bit past the viewBox edges,
// but that area is transparent in the asset so the clipping is
// invisible.
const ART_S = 0.4
const ART_CENTER_X = ORNAMENT_TX + (1024 * ORNAMENT_S) / 2
const ART_CENTER_Y = ORNAMENT_TY + (1024 * ORNAMENT_S) / 2
const ART_TX = ART_CENTER_X - (ART_SRC * ART_S) / 2
const ART_TY = ART_CENTER_Y - (ART_SRC * ART_S) / 2
const DIM_SCALE = 1.35

// The Y coordinate that the focus zoom should land the selected
// star on. Shifted ~35 px above the figure centre because the
// heroFade gradient + readoutOverlay take up the bottom portion
// of the visible orbital area during focus.
const FOCUS_CENTER_Y = ART_CENTER_Y - 35

/** Project a source-space (1024-space) point into the SVG viewBox,
 *  then push it outward by DIM_SCALE so the dimension hexagon
 *  matches the painted hexagon in day-orb.png at ART_S = 0.4. */
function ornamentPos(sx: number, sy: number): { x: number; y: number } {
  const x0 = ORNAMENT_TX + sx * ORNAMENT_S
  const y0 = ORNAMENT_TY + sy * ORNAMENT_S
  return {
    x: ART_CENTER_X + (x0 - ART_CENTER_X) * DIM_SCALE,
    y: ART_CENTER_Y + (y0 - ART_CENTER_Y) * DIM_SCALE,
  }
}

// Six dimension stars at the six cardinal nodes of the orbital
// drawing. Source coords read directly from the constellation
// polygon in daily_constellation.svg — top, upper-right, lower-
// right, bottom, lower-left, upper-left.
const STAR_POS: Record<DimensionKey, { x: number; y: number }> = {
  // Top node.
  mente: ornamentPos(512, 210),
  // Upper-right + lower-right nodes.
  sueno: ornamentPos(773.5, 361),
  alimento: ornamentPos(773.5, 663),
  // Bottom node.
  ciclo: ornamentPos(512, 814),
  // Lower-left + upper-left nodes.
  energia: ornamentPos(250.5, 663),
  cuerpo: ornamentPos(250.5, 361),
}

// The drawing's central "tú" node. A single DecorativeStar paints
// it so the centre shares the lens-flare + slow-glow language of
// the dimension stars rather than the SVG's authored static
// ornament.
const DECORATIVE_STAR_POS: { x: number; y: number }[] = [
  ornamentPos(512, 512), // centre of the orbital system
]

// Ambient dust scattered in the annulus between the galaxy bulge
// (≈ r 50) and the dimension hexagon (≈ r 148). Bumped 28 → 70
// motes for a richer field. Each mote carries its OWN angular
// speed factor (inversely proportional to its radius — Keplerian-
// style "inner faster than outer"): the field rotates as a whole
// but inner particles outpace outer ones, so the deterministic
// initial positions deform into visible spiral arms over time
// even though every particle stays in its own circular orbit.
const DUST_MOTE_COUNT = 120
const DUST_MOTES: {
  initialAngle: number
  radius: number
  speed: number
  r: number
  op: number
  phase: number
}[] = Array.from({ length: DUST_MOTE_COUNT }, (_, i) => {
  const angBase = (i * 360) / DUST_MOTE_COUNT
  const angJitter = (((i * 73) % 31) - 15) * 0.6
  // Wider radial spread (40 .. 180): some motes hug the bulge,
  // some drift past the dimension hexagon → reads as depth, not
  // a single thin ring.
  const radius = 40 + ((i * 19) % 140)
  // Pseudo-random depth 0..1 per mote → drives size + opacity so
  // the field has near (big + bright) and far (small + dim)
  // particles co-existing.
  const depth = ((i * 53) % 100) / 100
  return {
    initialAngle: angBase + angJitter,
    radius,
    // Keplerian speed — inner faster than outer. Negative so the
    // whole field spirals counter-clockwise (visually "to the
    // left") on screen.
    speed: -120 / radius,
    r: 0.4 + depth * 1.6, // 0.4 .. 2.0 — varied sizes for depth
    op: 0.12 + depth * 0.55, // 0.12 .. 0.67 — varied brightness
    phase: (i % 11) / 11,
  }
})

// Per-star label offset (in viewBox units). Homogenised: every
// label sits directly ABOVE its star (upper half) or directly
// BELOW (lower half) at the SAME vertical distance, with dx = 0
// so labels never push past the viewBox edges. Earlier mixed
// outward-radial offsets clipped SUEÑO + ALIMENTO against the
// right edge of the viewBox (372 px) once the star hexagon was
// scaled to radius 148.
const LABEL_DY = 18
const STAR_LABEL_OFFSETS: Record<DimensionKey, { dx: number; dy: number }> = {
  mente: { dx: 0, dy: -LABEL_DY },
  sueno: { dx: 0, dy: -LABEL_DY },
  cuerpo: { dx: 0, dy: -LABEL_DY },
  alimento: { dx: 0, dy: LABEL_DY },
  ciclo: { dx: 0, dy: LABEL_DY },
  energia: { dx: 0, dy: LABEL_DY },
}

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

function DustMote({
  mote,
  slowClock,
  dustOrbit,
}: {
  mote: (typeof DUST_MOTES)[number]
  slowClock: SharedValue<number>
  dustOrbit: SharedValue<number>
}) {
  const animated = useAnimatedProps(() => {
    'worklet'
    // Per-particle position: initial angle + shared rotation
    // scaled by this mote's speed factor. Inner particles
    // (high speed) advance faster than outer (low speed),
    // deforming the initial ring into spiral arms over time.
    const angle = ((mote.initialAngle + dustOrbit.value * mote.speed) * Math.PI) / 180
    const cx = ART_CENTER_X + Math.cos(angle) * mote.radius
    const cy = ART_CENTER_Y + Math.sin(angle) * mote.radius
    const wave = 0.5 + 0.5 * Math.sin((slowClock.value + mote.phase) * 2 * Math.PI)
    return { cx, cy, opacity: mote.op * (0.55 + 0.45 * wave) }
  })
  return <AnimatedCircle r={mote.r} animatedProps={animated} />
}

/** Canvas position of a dimension's star — hand-placed so the three
 *  orbital tips and the three peripheral stars compose like the
 *  triple-star reference photo. */
function place(d: Dimension): { x: number; y: number } {
  return STAR_POS[d.key]
}

export function OrbitalSystem({
  dimensions,
  selectedKey,
  onSelect,
  intensity = 'medium',
}: {
  dimensions: Dimension[]
  selectedKey: DimensionKey | null
  onSelect: (key: DimensionKey) => void
  intensity?: ConstellationIntensity
}) {
  const reducedMotion = useReducedMotion()
  const profile = getConstellationProfile(intensity, reducedMotion ?? false)

  // Clocks for ambient motion. `t` (8 s) drives the existing star
  // breath + twinkle. `slowClock` drives the slow respirating glow
  // behind active stars; its period comes from the profile so 'low'
  // breathes ~10 s, 'high' ~5.5 s. The nebula `drift` clock moved
  // to ScreenCosmos, which now owns the full-screen cosmic backdrop.
  const t = useSharedValue(0)
  const slowClock = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    slowClock.value = withRepeat(
      withTiming(1, { duration: profile.glowDurationMs, easing: Easing.linear }),
      -1,
      false,
    )
    return () => {
      cancelAnimation(t)
      cancelAnimation(slowClock)
    }
  }, [t, slowClock, profile.glowDurationMs])

  // Tap feedback: popT amplifies the selected star; rippleT drives
  // a shockwave ring out of it.
  const popT = useSharedValue(0)
  const rippleT = useSharedValue(0)
  useEffect(() => {
    if (selectedKey == null) return
    popT.value = 0
    popT.value = withSequence(
      withTiming(1, { duration: 240, easing: Easing.out(Easing.back(2.6)) }),
      withTiming(0, { duration: 520, easing: Easing.inOut(Easing.cubic) }),
    )
    rippleT.value = 0
    rippleT.value = withTiming(1, { duration: 640, easing: Easing.out(Easing.cubic) })
  }, [selectedKey, popT, rippleT])

  // Zoom-to-star: when a dimension is selected, the whole canvas
  // zooms in on its position; tapping anywhere (or the same dim
  // again, or the right-side list) zooms back out. The transform is
  // an interpolation between identity and `translate(CX - Z*sx, CY -
  // Z*sy) * scale(Z)`, which maps the target (sx, sy) onto the
  // viewBox centre at full zoom. `targetX/Y` are themselves animated
  // so SWITCHING between zoomed stars pans smoothly instead of
  // snapping.
  //
  // The zoom runs a two-stage `withSequence`: 480 ms ease-out cubic
  // to a slight overshoot (1.08), then 240 ms ease-in-out cubic back
  // to 1.0. That recoil gives the arrival the punctuated, cinematic
  // beat the user asked for — the camera goes a touch too far and
  // pulls itself back, instead of decelerating into the target.
  const zoomT = useSharedValue(0)
  const targetXVal = useSharedValue(CX)
  const targetYVal = useSharedValue(CY)
  useEffect(() => {
    if (selectedKey) {
      const pos = STAR_POS[selectedKey]
      targetXVal.value = withTiming(pos.x, {
        duration: 520,
        easing: Easing.inOut(Easing.cubic),
      })
      targetYVal.value = withTiming(pos.y, {
        duration: 520,
        easing: Easing.inOut(Easing.cubic),
      })
      zoomT.value = withSequence(
        withTiming(1.08, { duration: 480, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 240, easing: Easing.inOut(Easing.cubic) }),
      )
    } else {
      zoomT.value = withTiming(0, { duration: 380, easing: Easing.inOut(Easing.cubic) })
    }
  }, [selectedKey, zoomT, targetXVal, targetYVal])

  // Focus label key + opacity — lingers ~420 ms after deselect so
  // the bottom-of-wrap RN Text overlay fades out alongside the
  // zoom-out instead of unmounting the instant selectedKey flips.
  const [focusLabelKey, setFocusLabelKey] = useState<DimensionKey | null>(selectedKey)
  useEffect(() => {
    if (selectedKey) {
      setFocusLabelKey(selectedKey)
      return
    }
    const id = setTimeout(() => setFocusLabelKey(null), 420)
    return () => clearTimeout(id)
  }, [selectedKey])
  const focusLabelStyle = useAnimatedStyle(() => {
    'worklet'
    const z = Math.min(1, zoomT.value * 1.2)
    return { opacity: z * z * 0.95 }
  })

  // Echo of the galaxy painted OUTSIDE the zoom transform so it
  // stays put while the main figure scales out during focus.
  // Fades in 0 → 0.22 as zoomT climbs, so:
  //   • at rest: invisible (only the main galaxy renders)
  //   • during zoom: a ghost of the system stays visible behind
  //     the focused star, preserving the context the cinematic
  //     would otherwise erase
  const echoProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: zoomT.value * 0.22 }
  })
  // Dust drift — the ambient dust motes scattered between bulge
  // and dimension hexagon orbit slowly around the galaxy centre,
  // like a slow gravitational current. The galaxy itself, the
  // dimension stars, the labels, and the painted halos all stay
  // fixed. 180 s/cycle (2°/s) — visible but not distracting.
  const dustOrbit = useSharedValue(0)
  useEffect(() => {
    dustOrbit.value = withRepeat(
      withTiming(360, { duration: 180000, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(dustOrbit)
  }, [dustOrbit])
  // Rest-state mini labels — visible at zoomT = 0 (no selection)
  // so a new user can read "mente / sueño / alimento / …" right
  // next to each star without needing a side panel. Fade aggressively
  // (opacity drops to 0 by zoomT ≈ 0.4) so they never overlap the
  // big focused glyph + halo + "tu cuerpo" label during the
  // cinematic.
  const restLabelsProps = useAnimatedProps(() => {
    'worklet'
    return { opacity: Math.max(0, 1 - zoomT.value * 2.5) }
  })

  const zoomTransform = useAnimatedProps(() => {
    'worklet'
    const tz = zoomT.value
    const s = 1 + tz * (ZOOM_SCALE - 1)
    // PAN + SCALE: linearly interpolate the translate so the
    // selected star ends up centred in the VISIBLE half of the
    // orbital container. We target (ART_CENTER_X, FOCUS_CENTER_Y)
    // where FOCUS_CENTER_Y is shifted ~35 viewBox units ABOVE
    // the figure centre to compensate for the heroFade gradient
    // + readoutOverlay that occupy the bottom of the container
    // during focus — otherwise the focused glyph sat visually
    // below centre and the composition read as bottom-heavy.
    const tx = tz * (ART_CENTER_X - ZOOM_SCALE * targetXVal.value)
    const ty = tz * (FOCUS_CENTER_Y - ZOOM_SCALE * targetYVal.value)
    return { transform: [{ translateX: tx }, { translateY: ty }, { scale: s }] }
  })

  // Fades the DecorativeStar(s) at the system centre during zoom.
  // At rest the centre "tú" star reads full brightness; at full
  // zoom into a dimension it gets pushed off the centre by the
  // in-place transform and stays bright unless we dim it. Without
  // this, the visible scene has TWO luminous bodies — the selected
  // star AND the centre wandering to a corner — which reads as
  // "stars are out of orbit" (user's words). At zoomT = 1 the
  // centre drops to ~10 % opacity, basically out of the way.
  const decorativeFade = useAnimatedProps(() => {
    'worklet'
    return { opacity: 1 - zoomT.value * 0.9 }
  })

  const placed = dimensions.map((d) => ({ d, pos: place(d) }))

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 ${VB_TOP} ${W} ${VB_H}`} style={styles.svg}>
        <Defs>
          {/* A dimension star — warm white core fading to magenta. */}
          <RadialGradient id="orb-star" cx="50%" cy="50%" r="55%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="35%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor={colors.magenta} />
          </RadialGradient>
          {/* Soft radial fill for the lens-flare streak ellipses —
              white-hot core fading evenly to transparent at the
              ellipse boundary. Mapped onto each streak's bounding
              box, so a horizontally-stretched ellipse renders as a
              long feathered horizontal smear (the natural anamorphic
              shape of a real camera flare) and a tall narrow ellipse
              renders as a vertical smear. Single gradient handles
              every streak orientation. */}
          <RadialGradient id="flare-soft" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="28%" stopColor="#FFFFFF" stopOpacity={0.72} />
            <Stop offset="62%" stopColor="#FFFFFF" stopOpacity={0.22} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          {/* Focus well — bg-coloured radial gradient that fades
              from fully opaque at the centre (masking the PNG's
              painted halo behind the focused star) to transparent
              at the edge. Replaces the hard-edged solid disc that
              made the focus look like two stacked circles. */}
          <RadialGradient id="focus-well" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.bg} stopOpacity={0.96} />
            <Stop offset="55%" stopColor={colors.bg} stopOpacity={0.88} />
            <Stop offset="85%" stopColor={colors.bg} stopOpacity={0.4} />
            <Stop offset="100%" stopColor={colors.bg} stopOpacity={0} />
          </RadialGradient>
          {/* Focus spark — soft warm-cream glow painted BEHIND the
              icon. Gives the centre of the focus state a subtle
              luminous spark without re-introducing the bright
              white-hot core that washed the rose-gold icon out. */}
          <RadialGradient id="focus-spark" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFE9D6" stopOpacity={0.6} />
            <Stop offset="40%" stopColor="#FFE9D6" stopOpacity={0.25} />
            <Stop offset="100%" stopColor="#FFE9D6" stopOpacity={0} />
          </RadialGradient>
          {/* Per-dimension focus halo gradients — one TRUE radial
              gradient per dim. Replaces the fake "stack of nested
              circles" cascade which still showed visible step
              banding. With real gradients the bloom is fully
              continuous from centre opacity 0.5 to edge 0. */}
          <RadialGradient id="halo-cuerpo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.dimension.cuerpo} stopOpacity={0.5} />
            <Stop offset="40%" stopColor={colors.dimension.cuerpo} stopOpacity={0.32} />
            <Stop offset="75%" stopColor={colors.dimension.cuerpo} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={colors.dimension.cuerpo} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="halo-mente" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.dimension.mente} stopOpacity={0.5} />
            <Stop offset="40%" stopColor={colors.dimension.mente} stopOpacity={0.32} />
            <Stop offset="75%" stopColor={colors.dimension.mente} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={colors.dimension.mente} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="halo-sueno" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.dimension.sueno} stopOpacity={0.5} />
            <Stop offset="40%" stopColor={colors.dimension.sueno} stopOpacity={0.32} />
            <Stop offset="75%" stopColor={colors.dimension.sueno} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={colors.dimension.sueno} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="halo-alimento" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.dimension.alimento} stopOpacity={0.5} />
            <Stop offset="40%" stopColor={colors.dimension.alimento} stopOpacity={0.32} />
            <Stop offset="75%" stopColor={colors.dimension.alimento} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={colors.dimension.alimento} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="halo-ciclo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.dimension.ciclo} stopOpacity={0.5} />
            <Stop offset="40%" stopColor={colors.dimension.ciclo} stopOpacity={0.32} />
            <Stop offset="75%" stopColor={colors.dimension.ciclo} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={colors.dimension.ciclo} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="halo-energia" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.dimension.energia} stopOpacity={0.5} />
            <Stop offset="40%" stopColor={colors.dimension.energia} stopOpacity={0.32} />
            <Stop offset="75%" stopColor={colors.dimension.energia} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={colors.dimension.energia} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Galaxy echo — sits OUTSIDE the zoom transform so it
            never moves when the cinematic pushes the main galaxy
            off-screen. Driven by echoProps: invisible at rest,
            fades to ~22 % during focus. Stays static; orbit motion
            is on the stars layer above, not the galaxy itself. */}
        <AnimatedG animatedProps={echoProps}>
          <G transform={`translate(${ART_TX} ${ART_TY}) scale(${ART_S})`}>
            <SvgImage
              href={DAY_ORB_PNG}
              x={0}
              y={0}
              width={ART_SRC}
              height={ART_SRC}
              preserveAspectRatio="xMidYMid meet"
            />
          </G>
        </AnimatedG>

        {/* Ambient dust — 120 cream specks orbiting the bulge in
            shifting spiral arms. SITS OUTSIDE the zoom transform
            so the motion stays visible throughout the focus
            cinematic (inside the zoom group the dust scaled 2.6×
            and most particles flew off-screen, making the motion
            read as "frozen"). Each mote computes its own (cx, cy)
            from dustOrbit + an inverse-radius speed factor. */}
        <G fill="#FBD7E3">
          {DUST_MOTES.map((m, i) => (
            <DustMote key={`dust-${i}`} mote={m} slowClock={slowClock} dustOrbit={dustOrbit} />
          ))}
        </G>

        {/* Everything below sits inside the zoom transform — when a
            dimension is selected, this whole group translates+scales
            so the target star sits at the viewBox centre. The cosmos,
            the orbits, the centre star, the other dimension stars all
            zoom together; the selected star ends up dominating the
            frame. */}
        <AnimatedG animatedProps={zoomTransform}>
          {/* The deep field (nebula + starfield) was moved to
              ScreenCosmos at the page level so it spans BEYOND the
              diagram's bounds — no visible "diagram rectangle" any
              more. OrbitalSystem only renders the constellation +
              live stars now. */}

          {/* The ornamental backdrop — the photographic Day art
              PNG. Static. The orbital motion lives on the stars
              layer below, not on the galaxy itself. */}
          <G transform={`translate(${ART_TX} ${ART_TY}) scale(${ART_S})`}>
            <SvgImage
              href={DAY_ORB_PNG}
              x={0}
              y={0}
              width={ART_SRC}
              height={ART_SRC}
              preserveAspectRatio="xMidYMid meet"
            />
          </G>
          {/* Centre "tú" DecorativeStar removed — the painted
              galactic bulge in day-orb.png is now the only luminous
              centre. A programmatic white core on top of it would
              either over-saturate (if perfectly aligned) or read as
              a second misaligned star (if slightly off). */}

          {/* Dust moved OUTSIDE the zoom group (see above) so its
              spiral motion stays visible throughout focus. */}

          {/* Dimension stars — small luminous points on each orbit. */}
          {placed.map(({ d, pos }) => (
            <StarNode
              key={d.key}
              dim={d}
              pos={pos}
              t={t}
              popT={popT}
              rippleT={rippleT}
              zoomT={zoomT}
              slowClock={slowClock}
              profile={profile}
              selected={d.key === selectedKey}
              faded={selectedKey != null && d.key !== selectedKey}
            />
          ))}

          {/* At-rest mini labels — anchored at fixed STAR_POS so
              each label stays adjacent to its dim. Fade during
              focus zoom (restLabelsProps). */}
          <AnimatedG animatedProps={restLabelsProps}>
            {placed.map(({ d, pos }) => {
              const offset = STAR_LABEL_OFFSETS[d.key]
              return (
                <SvgText
                  key={`rest-label-${d.key}`}
                  x={pos.x + offset.dx}
                  y={pos.y + offset.dy}
                  fill="#FFE9D6"
                  fontSize={9}
                  fontFamily="HankenGrotesk_700Bold"
                  letterSpacing={1}
                  textAnchor="middle"
                  opacity={0.78}
                >
                  {d.label.toUpperCase()}
                </SvgText>
              )
            })}
          </AnimatedG>
        </AnimatedG>
      </Svg>

      {/* Focus label — "tu cuerpo / tu sueño / …" rendered as an
          RN Text overlay anchored to the bottom-centre of the
          wrap. Always visible inside the orbital container
          regardless of which star is focused, so it can't be
          clipped by the right-side DimensionNodeList. Fades in
          with selection (zoomT) and lingers ~420 ms after
          deselection so the text fades out alongside the
          zoom-out. */}
      {focusLabelKey != null ? (
        <Animated.View style={[styles.focusLabel, focusLabelStyle]} pointerEvents="none">
          <Text style={styles.focusLabelText}>{DIM_LABEL[focusLabelKey]}</Text>
        </Animated.View>
      ) : null}

      {selectedKey == null ? (
        // Not zoomed — the six per-star hit targets. RN Pressables
        // centred on each star, generous hit box.
        placed.map(({ d, pos }) => (
          <Pressable
            key={`hit-${d.key}`}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              onSelect(d.key)
            }}
            style={[
              styles.hit,
              {
                left: `${(pos.x / W) * 100}%`,
                top: `${((pos.y - VB_TOP) / VB_H) * 100}%`,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: d.key === selectedKey }}
            accessibilityLabel={d.label}
          />
        ))
      ) : (
        // Zoomed in — the per-star hits no longer align (everything
        // has moved under the zoom transform), so a single full-area
        // pressable catches a tap-to-exit. The right-side node list
        // remains live for SWITCHING between zoomed stars.
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {})
            onSelect(selectedKey)
          }}
          style={styles.tapToExit}
          accessibilityRole="button"
          accessibilityLabel="Cerrar zoom"
        />
      )}

      {/* Soft horizontal edge fades — very low opacity dim tint
          (≈ 35 % at the edge, 0 % toward centre) over the outer
          130 px of each side. Wide + barely-there so it does NOT
          form a visible "frame" the way the previous 60 %-opacity
          version did. Its only job is to take the hard transition
          between the bright orbital lines on the diagram and the
          sparser list / page area, and smooth it out into a
          gentle gradient. */}
      <FadeGradient
        colors={['rgba(20, 8, 16, 0.35)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.leftSoftFade}
        pointerEvents="none"
      />
      <FadeGradient
        colors={['transparent', 'rgba(20, 8, 16, 0.4)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.rightSoftFade}
        pointerEvents="none"
      />
    </View>
  )
}

// Cardinal + diagonal directions for the arrival burst. Eight
// fixed angles, hard-coded so React can render BurstParticle in a
// .map() without violating rules-of-hooks (the array is static).
const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const

/* A single arrival-burst particle — a tiny white dot that spawns
 * at (x, y) on selection (popT = 0), flies outward by `distance`
 * along `angle`, then fades. Opacity peaks at popT = 0.5 so the
 * particle is brightest mid-flight, fading both in and out around
 * that peak. Driven by popT, the same shared value powering the
 * impact flash + selection scale-pop. */
function BurstParticle({
  x,
  y,
  angle,
  popT,
  distance,
}: {
  x: number
  y: number
  angle: number
  popT: SharedValue<number>
  distance: number
}) {
  const cosA = Math.cos(angle)
  const sinA = Math.sin(angle)
  const props = useAnimatedProps(() => {
    'worklet'
    const u = popT.value
    return {
      cx: x + cosA * u * distance,
      cy: y + sinA * u * distance,
      // u * (1 - u) * 4 peaks at u = 0.5 with value 1, then drops
      // back to 0 — a sharp twinkle, not a fade.
      opacity: u * (1 - u) * 4,
      r: 1.4 - u * 0.7,
    }
  })
  return <AnimatedCircle fill="#FFFFFF" animatedProps={props} />
}

/* A luminous decorative star — no Pressable, no state, but shares
 * the slow-glow language of StarNode so every line endpoint feels
 * alive. Used for the two SVG burst endpoints not bound to a
 * dimension (right-mid + central diamond). */
function DecorativeStar({
  x,
  y,
  slowClock,
  phase,
  profile,
}: {
  x: number
  y: number
  slowClock: SharedValue<number>
  phase: number
  profile: ConstellationProfile
}) {
  const R = 3.6
  const baseGlowR = R * 5.5
  const slowGlow = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((slowClock.value + phase) * 2 * Math.PI)
    const scale = profile.glowMinScale + wave * (profile.glowMaxScale - profile.glowMinScale)
    const op = profile.glowMinOpacity + wave * (profile.glowMaxOpacity - profile.glowMinOpacity)
    return { r: baseGlowR * scale, opacity: op * 0.55 }
  })
  return (
    <G>
      <AnimatedCircle cx={x} cy={y} fill={CONSTELLATION_COLORS.starHalo} animatedProps={slowGlow} />
      <Circle cx={x} cy={y} r={R * 2.8} fill="#FBD7E3" opacity={0.16} />
      <Circle cx={x} cy={y} r={R * 1.5} fill="#FBD7E3" opacity={0.32} />
      <DiffractionSpikes
        x={x}
        y={y}
        length={R * 6.5}
        opacity={0.5}
        diagOpacity={0.18}
        strokeWidth={0.5}
      />
      <Circle cx={x} cy={y} r={R} fill="url(#orb-star)" />
      <Circle cx={x} cy={y} r={R * 0.6} fill="#FFFFFF" />
    </G>
  )
}

/* Lens-flare bloom — the organic starburst a real camera lens
 * produces around a bright point. Built from soft-edged ellipses
 * + a handful of sparkle dots instead of line strokes, so the
 * result reads as ATMOSPHERIC LIGHT (feathered, photographic)
 * rather than a geometric "+" cross.
 *
 * Anatomy:
 *  • Horizontal streak — long, wider — the dominant anamorphic flare.
 *  • Vertical streak   — shorter, narrower — the secondary axis.
 *  • Two diagonal streaks — even narrower, rotated 45°/-45°.
 *  • A scatter of tiny sparkle dots — the photographic "twinkle"
 *    that real cameras pick up around a bright point.
 *
 * Each streak is an <Ellipse> with `fill="url(#flare-soft)"` — a
 * radial-gradient that goes from full-white at the centre to
 * transparent at the ellipse edge. Stretching the ellipse on one
 * axis stretches that gradient into a feathered streak that tapers
 * to nothing at its tips. No lines means no geometric edges.
 *
 * Requires the parent SVG's <Defs> to define `flare-soft`.
 */
function DiffractionSpikes({
  x,
  y,
  length,
  opacity,
  diagOpacity,
  strokeWidth,
}: {
  x: number
  y: number
  length: number
  opacity: number
  diagOpacity?: number
  strokeWidth: number
}) {
  // Anamorphic asymmetry kept (real camera flares are never a
  // perfect square cross) but tamed: previously hLen 1.18 made the
  // horizontal streak feel like a hard geometric ruling. New
  // ratios push the spikes closer together (h ≈ 0.85, v ≈ 0.6,
  // diagonals 0.45) so the flare reads as a soft 4-pointed bloom
  // rather than a "+" sign with a long flag. Spikes are also
  // shorter overall — feels more like a luminous bloom than a
  // lens optical artefact.
  const hLen = length * 0.85
  const vLen = length * 0.6
  const dLen = length * 0.45
  const dOp = diagOpacity ?? opacity * 0.4
  // Ellipse semi-minor axes — these set the streak THICKNESS. They
  // scale with `length` so a small star produces a thin streak and a
  // big star produces a fatter one. `strokeWidth` continues to
  // influence base thickness for backwards-compatible call sites.
  const hRy = Math.max(1.4, length * 0.055 + strokeWidth * 0.4)
  const vRx = Math.max(1.1, length * 0.045 + strokeWidth * 0.3)
  const dRy = Math.max(0.9, length * 0.038 + strokeWidth * 0.25)
  // Sparkle dots — hand-picked offsets so they fall OFF the cardinal
  // axes (not on the cross itself). Tiny radii, descending opacity,
  // they add the "twinkle" that breaks the symmetric starburst.
  const sparkles = [
    { dx: length * 0.42, dy: -length * 0.22, r: length * 0.025, op: opacity * 0.55 },
    { dx: -length * 0.28, dy: length * 0.38, r: length * 0.022, op: opacity * 0.5 },
    { dx: length * 0.16, dy: length * 0.52, r: length * 0.018, op: opacity * 0.45 },
    { dx: -length * 0.45, dy: -length * 0.12, r: length * 0.02, op: opacity * 0.45 },
  ]
  return (
    <G>
      {/* Horizontal streak — wide ellipse, radial-gradient fill
          gives a feathered tapered shape no line can match. */}
      <Ellipse cx={x} cy={y} rx={hLen} ry={hRy} fill="url(#flare-soft)" opacity={opacity * 0.92} />
      {/* Vertical streak — narrower + shorter. */}
      <Ellipse cx={x} cy={y} rx={vRx} ry={vLen} fill="url(#flare-soft)" opacity={opacity * 0.74} />
      {/* Diagonal + asymmetric streaks — six total rays at varied
          angles so the starburst feels organic, not a perfect 4- or
          8-pointed shape. The four classic diagonals at ±45° anchor
          the cross; the two extra rays at 22° and −68° break the
          symmetry so the eye never lands on a regular pattern. Each
          rotation wraps an Ellipse since SVG Ellipse has no native
          rotation attribute. */}
      {dOp > 0 ? (
        <>
          <G transform={`rotate(45 ${x} ${y})`}>
            <Ellipse cx={x} cy={y} rx={dLen} ry={dRy} fill="url(#flare-soft)" opacity={dOp} />
          </G>
          <G transform={`rotate(-45 ${x} ${y})`}>
            <Ellipse cx={x} cy={y} rx={dLen} ry={dRy} fill="url(#flare-soft)" opacity={dOp} />
          </G>
          {/* Asymmetric extra rays — slightly shorter + dimmer. */}
          <G transform={`rotate(22 ${x} ${y})`}>
            <Ellipse
              cx={x}
              cy={y}
              rx={dLen * 0.78}
              ry={dRy * 0.85}
              fill="url(#flare-soft)"
              opacity={dOp * 0.7}
            />
          </G>
          <G transform={`rotate(-68 ${x} ${y})`}>
            <Ellipse
              cx={x}
              cy={y}
              rx={dLen * 0.65}
              ry={dRy * 0.8}
              fill="url(#flare-soft)"
              opacity={dOp * 0.62}
            />
          </G>
        </>
      ) : null}
      {/* Sparkles — a handful of tiny offset twinkles. They sit at
          asymmetric positions (no two on the same axis or angle) so
          the bloom never reads as geometric. */}
      {sparkles.map((s, i) => (
        <Circle key={`sp-${i}`} cx={x + s.dx} cy={y + s.dy} r={s.r} fill="#FFFFFF" opacity={s.op} />
      ))}
    </G>
  )
}

/* One dimension — a small luminous star. A radial gradient gives it
 * the white-hot core; a soft bloom around it scales with brightness.
 * The label sits radially outward, away from the centre. */
function StarNode({
  dim,
  pos,
  t,
  popT,
  rippleT,
  zoomT,
  slowClock,
  profile,
  selected,
  faded,
}: {
  dim: Dimension
  pos: { x: number; y: number }
  t: SharedValue<number>
  popT: SharedValue<number>
  rippleT: SharedValue<number>
  zoomT: SharedValue<number>
  slowClock: SharedValue<number>
  profile: ConstellationProfile
  selected: boolean
  faded: boolean
}) {
  const { x, y } = pos
  const b = dim.brightness
  const enLuz = b >= EN_LUZ_THRESHOLD
  // The day-orb.png backdrop already paints each dimension as a
  // bright magenta halo with a thin Saturn ring. The programmatic
  // StarNode now only adds: (1) a tiny white-hot core + (2) the
  // diffraction-spike cross + (3) the per-star breath/selection
  // pulse animation. Halo radii are minimal so the painted star
  // stays the visual subject and the programmatic layer just
  // contributes life.
  const R = enLuz ? 2.5 + b * 1.5 : 2
  const outerR = enLuz ? R * 1.8 : R * 1.4
  const midR = enLuz ? R * 1.4 : R * 1.2
  const auraR = enLuz ? R * 1.1 : R * 1.05

  // Each star breathes on its own phase so the constellation feels
  // alive but not synchronised. The 8 s `t` clock drives scale +
  // opacity together — both ride a sine wave but the opacity range
  // is shallower so the star never "blinks", it dips softly.
  //
  // When the star is the focus of the zoom-in, two extra inputs
  // amplify the breath:
  //   • popT contributes a brief impact scale-up at selection.
  //   • zoomT contributes a SUSTAINED 30 % grow as the camera
  //     locks on, AND cancels the breath opacity dip — the
  //     focused star stays bright + bigger throughout zoom.
  // Together they give the focused star the "alive, focused"
  // amplitude the user asked for, beyond the global 2.4 × zoom.
  const phase = (dim.angleDeg / 360) % 1
  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    let scale = 1 + wave * (enLuz ? profile.pulseScale + 0.04 : 0.05)
    if (selected) scale *= 1 + popT.value * 0.6 + zoomT.value * 0.3
    // The dim half of the breath fades less and less as zoom rises:
    // at zoomT=1 the dip is completely suppressed so the focused
    // star sits at 100 % brightness even on the trough of its
    // breath sine.
    const dipSuppression = 1 - zoomT.value
    const opacity = enLuz ? 1 - profile.pulseOpacity * (1 - wave) * dipSuppression : 1
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { scale },
        { translateX: -x },
        { translateY: -y },
      ],
      opacity,
    }
  })

  // Slow respirating glow behind active stars. Runs on `slowClock`
  // (~7.5 s at medium intensity) and uses the profile's glowMin/Max
  // ranges so 'low' barely moves and 'high' really breathes. A
  // SEPARATE animated layer from `breath` so the bright core itself
  // never blinks — only the surrounding halo expands and contracts.
  const slowGlow = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((slowClock.value + phase) * 2 * Math.PI)
    const scale = profile.glowMinScale + wave * (profile.glowMaxScale - profile.glowMinScale)
    const op = profile.glowMinOpacity + wave * (profile.glowMaxOpacity - profile.glowMinOpacity)
    return { r: outerR * scale, opacity: enLuz ? op : 0 }
  })

  // Tap ripple — a ring radiating out of the star.
  const ripple = useAnimatedProps(() => {
    'worklet'
    const u = rippleT.value
    return { r: R + u * R * 6, opacity: (1 - u) * 0.55 }
  })

  // Glyph (heart, bolt, moon, …) reveal on the selected star —
  // fades in with the zoom progression. The opacity is gated on
  // zoomT (1.4× multiplier puts the icon at full op by zoomT ≈ 0.7,
  // arriving in step with the camera). Position re-anchored every
  // frame so the icon stays centred on (x, y) even with breath
  // scaling. `showGlyph` lingers ~420 ms after deselection so the
  // icon fades out alongside the zoom-out rather than vanishing
  // the instant React's `selected` prop flips.
  const glyphAnim = useAnimatedProps(() => {
    'worklet'
    const z = Math.min(1, zoomT.value * 1.4)
    const op = z * z * 0.95
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    const s = GLYPH_SCALE * (1 + wave * 0.05)
    return {
      opacity: op,
      transform: [
        { translateX: x - GLYPH_HALF * s },
        { translateY: y - GLYPH_HALF * s },
        { scale: s },
      ],
    }
  })
  // Focus halo — soft coloured glow around the glyph. Caps at
  // ~0.7 opacity (with breath wave) so the coloured bloom feels
  // atmospheric, not opaque.
  const haloAnim = useAnimatedProps(() => {
    'worklet'
    const z = Math.min(1, zoomT.value * 1.6)
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    return { opacity: z * z * (0.55 + 0.18 * wave) }
  })
  // Dark well — separate animation that ramps to full 1.0 opacity.
  // The well NEEDS to be near-opaque so it fully masks the PNG
  // painted halo at the focused dimension's position (otherwise
  // the bright pink halo bleeds through and erases the rose-gold
  // icon's contrast). Lives outside haloAnim because that group's
  // ~0.73 cap would multiply against the well's own opacity and
  // let the PNG show through.
  const wellAnim = useAnimatedProps(() => {
    'worklet'
    const z = Math.min(1, zoomT.value * 1.6)
    return { opacity: z * z }
  })
  const [showGlyph, setShowGlyph] = useState(selected)
  useEffect(() => {
    if (selected) {
      setShowGlyph(true)
      return
    }
    const id = setTimeout(() => setShowGlyph(false), 420)
    return () => clearTimeout(id)
  }, [selected])

  // Impact flash — a brief bright white circle that bursts out of
  // the star core right as the camera arrives. Driven by popT
  // (which the parent already drives 0 → 1 over 240 ms → 0 over
  // 520 ms on selection). Squared opacity so the in + out feel
  // sharper than a linear ramp.
  const flashAnim = useAnimatedProps(() => {
    'worklet'
    const p = popT.value
    return {
      r: R * (1 + p * 2.4),
      opacity: p * p * 0.55,
    }
  })

  // Non-selected fade — when a selection is active, every OTHER en-
  // luz star fades aggressively as the camera zooms in. At zoomT=0
  // (the instant a selection starts) the non-selected drops to 0.6;
  // by zoomT=1 it's ~0.10 — basically invisible. This kills the
  // "ghost selection" effect where CUERPO's long anamorphic flare
  // (R·11) stretched into the viewport from off-screen at full
  // zoom and read like a second highlighted star. Only the
  // selected node stays at full opacity in the frame.
  const fadedAnim = useAnimatedProps(() => {
    'worklet'
    if (!faded) return { opacity: 1 }
    return { opacity: Math.max(0.08, 0.6 - zoomT.value * 0.5) }
  })

  // Core fade — drops the warm-white gradient core + the white-hot
  // disc stack to ZERO on a selected star as the camera zooms.
  // Without this the bright center washes out the rose-gold raster
  // glyph above. Non-selected stars: no fade (the bright core IS
  // their identity at rest).
  const coreFade = useAnimatedProps(() => {
    'worklet'
    if (!selected) return { opacity: 1 }
    return { opacity: Math.max(0, 1 - zoomT.value * 1.6) }
  })

  // Lens-flare shimmer — continuous tiny scale wobble on the
  // always-on starburst so the rays feel alive instead of frozen.
  // Different phase per star (re-uses dim.angleDeg's phase) and a
  // 1.3× frequency on top of slowClock so the shimmer is faster
  // than the breath/glow cycles, evoking the high-frequency
  // twinkle of real camera-lens diffraction.
  const shimmerAnim = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((slowClock.value + phase) * 2 * Math.PI * 1.3)
    const scale = 0.92 + wave * 0.16
    // During the focus cinematic the diffraction cross competes
    // with the glyph + halo and reads as a hard geometric line at
    // 2.6× scale. Faded to ZERO by zoomT ≈ 0.45 so the focus state
    // is carried by the soft coloured halo + the glyph alone —
    // organic bloom, no compass cross persisting through the
    // animation. Non-selected en-luz stars keep their full sparkle.
    const focusDim = selected ? Math.max(0, 1 - zoomT.value * 2.2) : 1
    return {
      opacity: focusDim,
      transform: [
        { translateX: x },
        { translateY: y },
        { scale },
        { translateX: -x },
        { translateY: -y },
      ],
    }
  })

  return (
    <AnimatedG animatedProps={fadedAnim}>
      {selected ? (
        <AnimatedCircle
          cx={x}
          cy={y}
          r={R}
          fill="none"
          stroke="#F4ECDE"
          strokeWidth={1.4}
          animatedProps={ripple}
        />
      ) : null}
      <AnimatedG animatedProps={breath}>
        {/* Slow respirating glow — only en luz stars get one. Sits
            BEHIND every other layer so it reads as ambient breathing
            light, not a competing bloom. Its `r` and opacity vary on
            slowClock; the breath group above only contributes scale
            + the soft opacity dip. */}
        {enLuz ? (
          <AnimatedCircle
            cx={x}
            cy={y}
            fill={CONSTELLATION_COLORS.starHalo}
            animatedProps={slowGlow}
          />
        ) : null}
        {/* Three-layer bloom: wide outer magenta → mid pink → tight
            warm aura. Opacities bumped from the previous version so
            the dramatic Genshin-style "luminous body" reads at the
            same scale as the bigger R. */}
        <Circle
          cx={x}
          cy={y}
          r={outerR}
          fill={colors.magenta}
          opacity={enLuz ? 0.14 + b * 0.12 : 0.05}
        />
        <Circle cx={x} cy={y} r={midR} fill="#FBD7E3" opacity={enLuz ? 0.2 + b * 0.14 : 0.06} />
        <Circle cx={x} cy={y} r={auraR} fill="#FBD7E3" opacity={enLuz ? 0.38 + b * 0.22 : 0.1} />
        {/* Diffraction-spike starburst — ON for EVERY en luz star.
            Length cut R*11 → R*6 + opacity 0.55+b*0.35 → 0.4+b*0.2
            so the cross reads as a soft luminous pin-prick over the
            painted halos, not a giant compass-rose that overpowers
            the photographic galaxy. */}
        {enLuz ? (
          <AnimatedG animatedProps={shimmerAnim}>
            <DiffractionSpikes
              x={x}
              y={y}
              length={R * 6}
              opacity={0.4 + b * 0.2}
              diagOpacity={0.16 + b * 0.08}
              strokeWidth={0.55}
            />
          </AnimatedG>
        ) : null}
        {/* Impact flash — a brief expanding white burst that fires
            on selection, driven by popT. */}
        {selected ? (
          <AnimatedCircle cx={x} cy={y} fill="#FFFFFF" animatedProps={flashAnim} />
        ) : null}
        {/* Arrival burst — eight tiny white particles that spawn at
            the star centre when popT fires, fly outward in a ring,
            and fade. Adds the cinematic "impact pop" sparks Genshin
            uses at the moment the camera arrives. */}
        {selected
          ? BURST_ANGLES.map((deg) => (
              <BurstParticle
                key={`burst-${deg}`}
                x={x}
                y={y}
                angle={(deg * Math.PI) / 180}
                popT={popT}
                distance={R * 5}
              />
            ))
          : null}
        {/* Big "selection flare" removed — it was the geometric
            horizontal streak that persisted across the focus
            cinematic. The arrival burst (BurstParticle ring) +
            impact flash already give the moment of selection its
            punch; the halo + glyph carry the focus state itself,
            without a directional cross. Result: organic bloom, not
            compass rose. */}
        {/* The luminous point — gradient disc + multi-layer
            white-hot core. The outermost halo is a wider soft
            white wash to mimic the overexposed Genshin core glow;
            below that, two opaque white discs at R*0.7 and R*0.4
            give the centre its blown-out brightness peak.

            The three WHITE discs are wrapped in an AnimatedG that
            fades them during zoom on the SELECTED star — so the
            dimension glyph rendered below has a magenta-bloom
            canvas to land on instead of being washed out by the
            opaque white core. */}
        <AnimatedG animatedProps={coreFade}>
          <Circle cx={x} cy={y} r={R} fill="url(#orb-star)" />
          {enLuz ? (
            <>
              <Circle cx={x} cy={y} r={R * 1.1} fill="#FFFFFF" opacity={0.32} />
              <Circle cx={x} cy={y} r={R * 0.7} fill="#FFFFFF" opacity={1} />
              <Circle cx={x} cy={y} r={R * 0.4} fill="#FFFFFF" />
            </>
          ) : null}
        </AnimatedG>
      </AnimatedG>
      {/* Focus halo — TWO independent layers, both edge-feathered:
            • haloAnim group: 4 nested coloured rings with
              descending opacity simulate a radial gradient bloom
              (no per-dim RadialGradient needed since fill colour
              varies per dimension).
            • wellAnim group: bg-coloured RADIAL GRADIENT that
              fades opaque-at-centre → transparent-at-edge, so
              the well DIFFUSES into the colored halo around it
              instead of showing a hard "two stacked circles"
              edge. The well also has slack radius (r=42) that
              extends INTO the inner ring of the halo — the
              transition zone blends. */}
      {showGlyph ? (
        <>
          {/* Halo bloom — TRUE radial gradient per dimension.
              Continuous from centre (opacity 0.5) to edge 0, no
              step banding. The gradient id resolves to
              `halo-${dim.key}` defined in <Defs>. */}
          <AnimatedG animatedProps={haloAnim}>
            <Circle cx={x} cy={y} r={68} fill={`url(#halo-${dim.key})`} />
          </AnimatedG>
          <AnimatedG animatedProps={wellAnim}>
            <Circle cx={x} cy={y} r={42} fill="url(#focus-well)" />
          </AnimatedG>
          {/* Centre spark — soft warm-cream glow painted between
              the well and the icon. Gives the focus state a
              subtle luminous centre without re-introducing the
              washing-out white-hot core. */}
          <AnimatedG animatedProps={wellAnim}>
            <Circle cx={x} cy={y} r={28} fill="url(#focus-spark)" />
          </AnimatedG>
        </>
      ) : null}
      {/* Dimension glyph — materialises at the star centre as the
          zoom cinematic progresses. Cream tint so the icon reads
          as the bright spark inside the coloured halo. */}
      {showGlyph ? (
        <AnimatedG animatedProps={glyphAnim}>
          <G color="#FFE9D6">{GLYPHS[dim.key]}</G>
        </AnimatedG>
      ) : null}
      {/* Focus label moved out of the SVG to a sibling RN Text
          overlay (see OrbitalSystem return below). With the
          in-place zoom + the right-side DimensionNodeList the
          label rendered inside the SVG (anchored to the star)
          ended up behind the list panel for stars on the right
          half of the hexagon. The RN overlay always centres on
          the wrap so it can't clip. */}
      {/* Labels intentionally removed — the right-side DimensionNodeList
          is the single source of identification. Two labels for the
          same dimension was visual noise and they kept colliding with
          the ornament's flourishes. */}
    </AnimatedG>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    // Matches the viewBox aspect exactly so the SVG fills the box
    // with no letterbox and no squish.
    aspectRatio: W / VB_H,
  },
  svg: {
    width: '100%',
    height: '100%',
  },
  hit: {
    position: 'absolute',
    width: HIT,
    height: HIT,
    marginLeft: -HIT / 2,
    marginTop: -HIT / 2,
  },
  // Full-area tap-to-exit when zoomed in. Covers the diagram so any
  // tap on it deselects (smooth zoom-out); the right-side node list
  // sits outside this overlay and stays interactive.
  tapToExit: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Focus label overlay — RN Text anchored to bottom-centre of the
  // wrap so it always renders inside the orbital container, never
  // clipped by the right-side DimensionNodeList. pointerEvents off
  // so the tap-to-exit Pressable still catches taps in this area.
  focusLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: 'center',
  },
  focusLabelText: {
    fontFamily: typography.serif,
    fontSize: 14,
    color: '#FFE9D6',
    letterSpacing: 1.6,
  },
  // Soft edge fades — very subtle dim tint that takes the edge off
  // the diagram's hard boundary against the surrounding cosmos / list
  // without forming a visible band. Wide (130 px each side) so the
  // gradient is barely perceptible; low end opacity (0.35–0.4) so
  // it doesn't read as a coloured frame.
  leftSoftFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 130,
  },
  rightSoftFade: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 130,
  },
})
