import * as Haptics from 'expo-haptics'
// Aliased — react-native-svg also exports a LinearGradient.
import { LinearGradient as FadeGradient } from 'expo-linear-gradient'
import { memo, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
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
  FeColorMatrix,
  FeGaussianBlur,
  Filter,
  G,
  Image as SvgImage,
  Mask,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg'
// Skia owns the volumetric flare layer (real Gaussian blur + additive
// blend) the SVG primitives above can only fake. Aliased where the
// name collides with react-native-svg (Circle / RadialGradient / Rect).
import {
  BlurMask,
  Canvas,
  Circle as SkiaCircle,
  Group as SkiaGroup,
  LinearGradient as SkiaLinearGradient,
  RadialGradient as SkiaRadialGradient,
  Rect as SkiaRect,
  vec,
} from '@shopify/react-native-skia'

import { colors, typography } from '@/theme'

import { DIM_LABEL } from '../constants/dimensionColors'

import {
  CONSTELLATION_COLORS,
  getConstellationProfile,
  type ConstellationIntensity,
  type ConstellationProfile,
} from '../constants/constellationTheme'
import { EN_LUZ_THRESHOLD, TONE_BRILLANTE, type Dimension, type DimensionKey } from '../logic'
import { useScreenActive } from '../useScreenActive'

import { GLYPHS } from './dimensionGlyphs'

// The Día centerpiece — the m-day raster, the new central anchor for
// the Día segment. Same wiring as before (rendered into the scaled
// <G> at ART_S so it sits centred + scales with the constellation).
const DAY_ORB_PNG = require('@/assets/orbits-art/m-day.png')

/** Star + halo palette for the Día orbital diagram. Same intent as
 *  `SKY` in MonthSky.tsx — art colours that don't belong in the
 *  global theme (they're scene-specific) but should live in one
 *  named block so tweaking the mood is a single-block edit. */
const SKY = {
  // Bright pin-point + ripple stroke.
  starCore: '#FFFFFF',
  // Soft pink aura around a star.
  starGlow: '#FBD7E3',
  // Warm cream halo + focus label colour.
  haloCream: '#FFE9D6',
  // Chromatic-aberration tails — the violet/cyan ghosts a real lens
  // throws to either side of a blown-out point. Used ONLY on a
  // RADIANTE star (b ≥ TONE_BRILLANTE) to sell the supernova /
  // lens-flare read; never on en-formación or silencio.
  chromaViolet: '#C18FFF',
  chromaCyan: '#9FE8FF',
} as const

// Glyphs are authored in a 24×24 viewport. Bumped 1.5× → 2.6×
// after the raster rose-gold icons started reading as small
// blobs inside the bigger coloured halo — at this scale the
// illustrated detail of each icon is legible and the icon
// becomes the unambiguous emblem of the zoomed dimension.
const GLYPH_SCALE = 2.6
const GLYPH_HALF = 12

// The six dimension keys, in a fixed order — used to emit one glyph-glow
// SVG filter per dimension (each recolours the rose constellation to its
// own hue, then blurs it into a bloom).
const DIM_KEYS: DimensionKey[] = ['cuerpo', 'mente', 'energia', 'alimento', 'sueno', 'ciclo']

/** FeColorMatrix `values` that flattens any input to a SOLID hue (keeping
 *  the source alpha) — so the rose glyph becomes a single-colour
 *  silhouette in the dimension's hue, ready to blur into a shaped glow. */
function glowMatrix(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  return `0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 1 0`
}

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

// When true, the soft glow + diffraction rays + chromatic edges of each
// EN-LUZ star are drawn by the Skia <Canvas> overlay (real blur) instead
// of the SVG ellipse-flare. The SVG keeps only the crisp core pin; Skia
// owns everything feathered. Flip to false to fall back to the pure-SVG
// flare (e.g. if running in a context without the Skia native module).
const USE_SKIA_FLARE = true

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
// programmatic StarNode positions (STAR_POS) land on the orbital ring.
// ART_CENTER is the gravity centre — home of the small black hole + its
// warm glow.
const ART_CENTER_X = ORNAMENT_TX + (1024 * ORNAMENT_S) / 2
const ART_CENTER_Y = ORNAMENT_TY + (1024 * ORNAMENT_S) / 2
// m-day raster placement. UX audit pulled 0.42 → 0.28 — the previous
// scale made the sphere DOMINATE the canvas and read as the subject,
// pushing the dimension stars into the role of decoration. Manifesto
// reverses that: the dimensions are the data; the sphere just anchors.
//
// Paired with `ART_OPACITY = 0.6` on the render group so even at this
// smaller size the orb recedes rather than competing with the stars.
//
// `ART_SPHERE_Y_NORM` — fraction of source height where the sphere's
// visual centre lives (the rest of the PNG is mist tail below). Was
// 0.38 (estimated sphere centre at upper third); bumped to 0.50 after
// the user reported the sphere read as sitting BELOW the hex centre
// — the real centre of the visible orb in the PNG sits closer to
// geometric middle than the visual estimate. Bigger value = anchor
// point pulled down in the PNG = PNG lifted up on screen = sphere
// closer to the hex's gravity centre.
const ART_SRC = 1254
const ART_S = 0.28
const ART_SPHERE_Y_NORM = 0.5
const ART_OPACITY = 0.6
const ART_TX = ART_CENTER_X - (ART_SRC * ART_S) / 2
const ART_TY = ART_CENTER_Y - ART_SRC * ART_S * ART_SPHERE_Y_NORM
// Visible radius of the sphere in viewBox units — its mask + glow key off
// it. Tightened from /2 (full PNG halfwidth) to ~18 % of source width
// because the actual sphere occupies less than the full canvas; the mist
// tail below is decorative and shouldn't drive halo geometry.
const ART_R = ART_SRC * ART_S * 0.18
// Was 1.35 (pushed the six stars out toward the edges — read as scattered,
// disconnected). Pulled to 1.0 so they ring tightly just outside the warm
// core's glow and read as one system, not loose specks.
const DIM_SCALE = 1.0

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

// Ambient dust scattered in the annulus around the galaxy bulge. Cut
// 45 → 16 motes: the Skia nebula now carries the continuous "cosmic
// dust" texture, so the discrete points only need to sell the system's
// ROTATION (the diagram's single Keplerian movement). They're kept
// CLOSE to the bulge (radius 40 .. 95) — the inner motes are the ones
// that read as a swirl; outer ones just looked like specks in the void.
// Each mote carries its own angular speed (inverse-radius, Keplerian:
// inner faster than outer) so the ring deforms into spiral arms.
const DUST_MOTE_COUNT = 16
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
  // Inner radial band (40 .. 95) — hugs the bulge where the swirl reads.
  const radius = 40 + ((i * 19) % 55)
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
    r: 0.5 + depth * 0.9, // 0.5 .. 1.4 — calmer so the swirl doesn't
    // compete with the galactic centre (the anchor).
    // Floor kept confident (0.18) but ceiling lowered so the rotation is
    // FELT, not announced — the centre stays the brightest thing here.
    op: 0.18 + depth * 0.32, // 0.18 .. 0.50
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
  // Pause ambient loops when the Órbita tab isn't focused (see useScreenActive).
  const screenActive = useScreenActive()
  useEffect(() => {
    if (!screenActive) return
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
  }, [screenActive, t, slowClock, profile.glowDurationMs])

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
      // Pan matches the first stage of the zoom (480 ms ease-out
      // cubic) so the camera doesn't drift sideways while the
      // canvas is still zooming up. Mismatching the curves makes
      // the focused star "jump" toward the edge mid-animation
      // before settling — both animations must progress together.
      targetXVal.value = withTiming(pos.x, {
        duration: 480,
        easing: Easing.out(Easing.cubic),
      })
      targetYVal.value = withTiming(pos.y, {
        duration: 480,
        easing: Easing.out(Easing.cubic),
      })
      zoomT.value = withSequence(
        withTiming(1.08, { duration: 480, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 240, easing: Easing.inOut(Easing.cubic) }),
      )
    } else {
      zoomT.value = withTiming(0, { duration: 380, easing: Easing.inOut(Easing.cubic) })
    }
  }, [selectedKey, zoomT, targetXVal, targetYVal])

  // Arrival haptic — a soft impact ~480 ms after a selection, timed to
  // when the camera LANDS (the end of the first zoom stage), not the tap
  // (which already fired a selection tick in the Pressable). The body
  // feels the moment of focus, not just the touch.
  useEffect(() => {
    if (selectedKey == null) return
    const id = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }, 480)
    return () => clearTimeout(id)
  }, [selectedKey])

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

  // Dust drift — the ambient dust motes scattered between bulge
  // and dimension hexagon orbit slowly around the galaxy centre,
  // like a slow gravitational current. The galaxy itself, the
  // dimension stars, the labels, and the painted halos all stay
  // fixed. 180 s/cycle (2°/s) — visible but not distracting.
  const dustOrbit = useSharedValue(0)
  useEffect(() => {
    if (!screenActive) return
    dustOrbit.value = withRepeat(
      withTiming(360, { duration: 180000, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(dustOrbit)
  }, [screenActive, dustOrbit])
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
    //
    // The translate uses the LIVE scale `s` (not constant ZOOM_SCALE)
    // and a focus mix clamped to [0, 1]. When zoomT overshoots past 1
    // for the cinematic recoil, the scale grows past ZOOM_SCALE but
    // the translate compensates so the focused glyph stays anchored
    // at (ART_CENTER_X, FOCUS_CENTER_Y) instead of being pushed
    // sideways past the centre and bumping back.
    const mix = Math.min(tz, 1)
    const tx = mix * (ART_CENTER_X - s * targetXVal.value)
    const ty = mix * (FOCUS_CENTER_Y - s * targetYVal.value)
    return { transform: [{ translateX: tx }, { translateY: ty }, { scale: s }] }
  })

  // Memoised so the Skia flare layer (which takes `placed` by prop)
  // doesn't reconcile its whole canvas on every parent render — only
  // when the dimensions actually change.
  const placed = useMemo(() => dimensions.map((d) => ({ d, pos: place(d) })), [dimensions])

  // The day's average light — drives the warm central core: the more
  // dimensions are awake, the warmer/wider the centre glows (the manifesto
  // loop). 0 = a waiting ember, 1 = a full warm sun. Never goes dark.
  const litAvg = useMemo(
    () =>
      dimensions.length ? dimensions.reduce((s, d) => s + d.brightness, 0) / dimensions.length : 0,
    [dimensions],
  )
  // Animate the warm core glow toward the new average so logging a dimension
  // makes the centre brighten smoothly rather than jump.
  const litAvgSV = useSharedValue(litAvg)
  useEffect(() => {
    litAvgSV.value = withTiming(litAvg, { duration: 900, easing: Easing.out(Easing.cubic) })
    return () => cancelAnimation(litAvgSV)
  }, [litAvg, litAvgSV])
  const coreGlowProps = useAnimatedProps(() => {
    'worklet'
    // A warm ember even at 0 (never a dead void); brighter as more wake.
    return { opacity: 0.35 + 0.55 * litAvgSV.value }
  })

  // Orb breath — a subtle opacity wobble centred on ART_OPACITY,
  // driven by the SAME `t` clock that the stars breathe on. UX audit
  // flagged that the orb felt "alive" while the dimensions felt
  // "dead" because they pulsed on different rhythms (or, in the
  // orb's case, not at all). Sharing `t` means the centerpiece +
  // dimension stars rise and fall together — read as one system.
  // Range tuned narrow (±0.08 around ART_OPACITY) so the orb stays
  // recessed at all times; the stars still carry the focal motion.
  //
  // `zoomFade` removes the orb during focus: when the camera dives
  // onto a star, the centerpiece would peek in from the side of the
  // focused frame (visible art-direction failure per the audit). We
  // fade it to 0 as zoomT rises so the focused dimension owns the
  // canvas.
  const orbBreathProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    const zoomFade = Math.max(0, 1 - zoomT.value * 1.8)
    return { opacity: ART_OPACITY * (0.88 + wave * 0.24) * zoomFade }
  })

  // viewBox → pixel factor for the Skia flare overlay. Measured from the
  // wrap (which fills the orbital container at the viewBox aspect ratio),
  // so k = px width ÷ viewBox width = px height ÷ viewBox height.
  const [flareK, setFlareK] = useState(0)

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width
        if (w > 0) setFlareK(w / W)
      }}
    >
      <Svg viewBox={`0 ${VB_TOP} ${W} ${VB_H}`} style={styles.svg}>
        <Defs>
          {/* A dimension star — warm white core fading to magenta. */}
          <RadialGradient id="orb-star" cx="50%" cy="50%" r="55%">
            <Stop offset="0%" stopColor={SKY.starCore} />
            <Stop offset="35%" stopColor={SKY.starGlow} />
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
            <Stop offset="0%" stopColor={SKY.starCore} stopOpacity={1} />
            <Stop offset="28%" stopColor={SKY.starCore} stopOpacity={0.72} />
            <Stop offset="62%" stopColor={SKY.starCore} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={SKY.starCore} stopOpacity={0} />
          </RadialGradient>
          {/* Chromatic-aberration tails — translucent violet + cyan
              ghosts thrown to either side of a blown-out RADIANTE
              core. Same feathered ellipse trick as `flare-soft` but
              tinted + lower peak opacity so they read as the colour
              fringe a real lens smears past a supernova-bright point,
              not a second coloured streak. Used ONLY on radiante. */}
          <RadialGradient id="flare-chroma-violet" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={SKY.chromaViolet} stopOpacity={0.85} />
            <Stop offset="45%" stopColor={SKY.chromaViolet} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={SKY.chromaViolet} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="flare-chroma-cyan" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={SKY.chromaCyan} stopOpacity={0.85} />
            <Stop offset="45%" stopColor={SKY.chromaCyan} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={SKY.chromaCyan} stopOpacity={0} />
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
            <Stop offset="0%" stopColor={SKY.haloCream} stopOpacity={0.72} />
            <Stop offset="40%" stopColor={SKY.haloCream} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={SKY.haloCream} stopOpacity={0} />
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
          {/* Warm core glow — an oro halo painted BEHIND the small black
              hole so the centre EMITS instead of only absorbing. Its opacity
              grows with the day's average light (litAvg) via coreGlowProps.
              Oro, never magenta (the header keeps the lone magenta accent). */}
          <RadialGradient id="core-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.oroLight} stopOpacity={0.6} />
            <Stop offset="55%" stopColor={colors.oro} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={colors.oro} stopOpacity={0} />
          </RadialGradient>
          {/* Edge-fade mask so the BH raster melts into the field instead of
              showing a boxy/hard rim. Sized to the BH's visible radius. */}
          <RadialGradient id="bh-fade" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="55%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="82%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
          <Mask id="bh-mask" maskUnits="userSpaceOnUse">
            <Circle cx={ART_CENTER_X} cy={ART_CENTER_Y} r={ART_R * 1.12} fill="url(#bh-fade)" />
          </Mask>
          {/* Glyph glow — one filter per dimension. Recolours the rose
              constellation to the dimension's hue (FeColorMatrix) then
              blurs it (FeGaussianBlur), so a soft shaped bloom in the
              dimension colour sits behind the crisp glyph and bleeds its
              light into the halo. The constellation stops reading as a
              flat sticker and starts EMITTING. Generous filter region so
              the blur isn't clipped. */}
          {DIM_KEYS.map((key) => (
            <Filter
              key={`glow-${key}`}
              id={`glyph-glow-${key}`}
              x="-60%"
              y="-60%"
              width="220%"
              height="220%"
            >
              <FeColorMatrix
                type="matrix"
                values={glowMatrix(colors.dimension[key])}
                result="tint"
              />
              <FeGaussianBlur in="tint" stdDeviation={1.8} />
            </Filter>
          ))}
        </Defs>

        {/* Ambient dust — 120 cream specks orbiting the bulge in
            shifting spiral arms. SITS OUTSIDE the zoom transform
            so the motion stays visible throughout the focus
            cinematic (inside the zoom group the dust scaled 2.6×
            and most particles flew off-screen, making the motion
            read as "frozen"). Each mote computes its own (cx, cy)
            from dustOrbit + an inverse-radius speed factor. */}
        <G fill={SKY.starGlow}>
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

          {/* Warm core glow — BEHIND the black hole, so the centre emits a
              warm halo that GROWS with the day's light (coreGlowProps drives
              its opacity from litAvg). The BH sits on top and keeps its dark
              centre + accretion disk. */}
          <AnimatedG animatedProps={coreGlowProps}>
            <Circle cx={ART_CENTER_X} cy={ART_CENTER_Y} r={ART_R * 0.85} fill="url(#core-glow)" />
          </AnimatedG>

          {/* The centerpiece — the central anchor the dimensions ring.
              Edge-faded via bh-mask so it melts into the field. Opacity
              breathes on the same `t` clock the stars use, so the orb
              and the dimensions rise/fall together as one system (see
              `orbBreathProps` notes above). */}
          <AnimatedG mask="url(#bh-mask)" animatedProps={orbBreathProps}>
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

          {/* Orbital traces (thin magenta ellipses centre→star) were
              tried for the vector galaxy but read as a geometric CAD
              spirograph AND duplicate the orbital ring day-orb.png
              already paints — so they're left to the PNG. */}
          {/* Centre "tú" DecorativeStar removed — the galaxy's painted
              bulge + the bulb halo are the only luminous centre. A
              programmatic white core on top would over-saturate or read
              as a second misaligned star. */}

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
              focus zoom (restLabelsProps).

              UX-tuned hierarchy: the PROTAGONIST (highest-brightness
              en-luz dim) reads in `colors.leche` at full opacity; every
              other label recedes to `colors.bone` at 0.55 — the eye
              lands on today's lead dimension before scanning the rest.
              When nothing is en luz (cold start) all labels stay at the
              bone level so no fake "lead" is fabricated. */}
          <AnimatedG animatedProps={restLabelsProps}>
            {(() => {
              const enLuzDims = placed.filter(
                ({ d }) => d.brightness >= EN_LUZ_THRESHOLD,
              )
              const heroKey =
                enLuzDims.length > 0
                  ? enLuzDims.reduce((best, cur) =>
                      cur.d.brightness > best.d.brightness ? cur : best,
                    ).d.key
                  : null
              return placed.map(({ d, pos }) => {
                const offset = STAR_LABEL_OFFSETS[d.key]
                const isHero = d.key === heroKey
                return (
                  <SvgText
                    key={`rest-label-${d.key}`}
                    x={pos.x + offset.dx}
                    y={pos.y + offset.dy}
                    fill={isHero ? colors.leche : colors.bone}
                    fontSize={10}
                    fontFamily="HankenGrotesk_700Bold"
                    letterSpacing={1.2}
                    textAnchor="middle"
                    opacity={isHero ? 0.98 : 0.55}
                  >
                    {d.label.toUpperCase()}
                  </SvgText>
                )
              })
            })()}
          </AnimatedG>
        </AnimatedG>
      </Svg>

      {/* Skia flare overlay — real blur + additive blend on top of the
          SVG diagram. pointerEvents off so the per-star Pressables below
          still catch taps. Only mounts once the wrap has measured (k>0)
          and when the Skia flare is enabled. */}
      {USE_SKIA_FLARE && flareK > 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <SkiaFlareLayer
            placed={placed}
            k={flareK}
            zoomT={zoomT}
            targetX={targetXVal}
            targetY={targetYVal}
            slowClock={slowClock}
            t={t}
            reduced={reducedMotion ?? false}
          />
        </View>
      ) : null}

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
  return <AnimatedCircle fill={SKY.starCore} animatedProps={props} />
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
 *  • Optional dense CORONA — N short spikes at deterministic angles
 *    (a few jittered to break symmetry) for the supernova read on a
 *    RADIANTE star. Opt-in via `coronaCount`; 0 = no corona, so
 *    existing call sites are unchanged.
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
  coronaCount = 0,
  coronaOpacity,
  sparkleCount = 4,
}: {
  x: number
  y: number
  length: number
  opacity: number
  diagOpacity?: number
  strokeWidth: number
  /** Number of short corona spikes radiating around the core. 0 (the
   *  default) keeps the classic 4 + 2 ray flare unchanged so
   *  non-radiante call sites behave exactly as before. */
  coronaCount?: number
  /** Group opacity for the corona spikes. Defaults to opacity * 0.62. */
  coronaOpacity?: number
  /** How many off-axis sparkle twinkles to draw. Defaults to 4 (the
   *  historical value) so existing call sites are unchanged. */
  sparkleCount?: number
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
  // Corona — N short feathered spikes radiating around the core at
  // deterministic angles. A few are jittered (angle + length) so the
  // ring never reads as a perfectly regular gear. Drawn as one flat
  // list inside this <G>, so the PARENT's single animated group
  // (shimmerAnim) animates all of them together — no per-spike
  // animation. Spike length is length * 0.32 (short, hugging the
  // core) so they thicken the bloom rather than competing with the
  // long primary rays.
  const coronaOp = coronaOpacity ?? opacity * 0.62
  const coronaLen = length * 0.32
  const coronaRy = Math.max(0.7, length * 0.02 + strokeWidth * 0.2)
  const corona =
    coronaCount > 0
      ? Array.from({ length: coronaCount }, (_, i) => {
          const baseAngle = (i * 360) / coronaCount
          // Deterministic jitter on every 3rd-ish spike: break the
          // symmetry without randomness (stable across renders).
          const jitter = i % 3 === 0 ? (((i * 37) % 13) - 6) * 0.9 : 0
          const lenScale = i % 4 === 0 ? 1.25 : i % 3 === 0 ? 0.78 : 1
          return { angle: baseAngle + jitter, rx: coronaLen * lenScale }
        })
      : []
  // Sparkle dots — hand-picked offsets so they fall OFF the cardinal
  // axes (not on the cross itself). Tiny radii, descending opacity,
  // they add the "twinkle" that breaks the symmetric starburst.
  const sparkleSeeds = [
    { dx: length * 0.42, dy: -length * 0.22, r: length * 0.025, op: opacity * 0.55 },
    { dx: -length * 0.28, dy: length * 0.38, r: length * 0.022, op: opacity * 0.5 },
    { dx: length * 0.16, dy: length * 0.52, r: length * 0.018, op: opacity * 0.45 },
    { dx: -length * 0.45, dy: -length * 0.12, r: length * 0.02, op: opacity * 0.45 },
    { dx: length * 0.55, dy: length * 0.3, r: length * 0.016, op: opacity * 0.4 },
  ]
  const sparkles = sparkleSeeds.slice(0, Math.max(0, sparkleCount))
  return (
    <G>
      {/* Corona spikes — drawn FIRST so they sit behind the primary
          rays + the sparkles. Each is a feathered ellipse rotated to
          its angle; the whole set rides the parent's single animated
          group, never animated individually. */}
      {corona.map((c, i) => (
        <G key={`corona-${i}`} transform={`rotate(${c.angle} ${x} ${y})`}>
          <Ellipse
            cx={x + c.rx}
            cy={y}
            rx={c.rx}
            ry={coronaRy}
            fill="url(#flare-soft)"
            opacity={coronaOp}
          />
        </G>
      ))}
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
        <Circle
          key={`sp-${i}`}
          cx={x + s.dx}
          cy={y + s.dy}
          r={s.r}
          fill={SKY.starCore}
          opacity={s.op}
        />
      ))}
    </G>
  )
}

// ── Skia flare layer ────────────────────────────────────────────────
// The SVG diagram above paints the galaxy, the orbits and a crisp core
// pin per dimension. This Skia <Canvas> sits ON TOP of it and adds the
// part SVG can't: real Gaussian-blurred volumetric glow, additive
// diffraction rays, chromatic-aberration edges and sparkle motes — the
// lens-flare read from the reference. It tracks the SAME zoom transform
// as the SVG (so the flares ride the camera) and fades out as the focus
// cinematic begins (zoomT → the SVG glyph/halo takes over from there).

/** "#RRGGBB" → "r,g,b" so we can build rgba() strings with arbitrary
 *  alpha for Skia gradient stops. Pure. */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const n = parseInt(full, 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

const SKIA_FLARE_CHROMA = {
  violet: hexToRgb(SKY.chromaViolet),
  cyan: hexToRgb(SKY.chromaCyan),
} as const

// Page background, as "r,g,b" — used to feather-knock-back the hard
// coloured halo the day-orb.png paints behind each node, so the Skia
// flare reads as white light on nebula rather than a coloured disc.
const SKIA_BG_RGB = hexToRgb(colors.bg)

/* One dimension's flare, drawn in Skia in LOCAL viewBox units around the
 * origin; the wrapping <Group> transform places + scales it into canvas
 * pixels (and applies the live zoom). Layered, back-to-front:
 *   1. soft coloured glow (dimension hue) — wide, respirating, `screen`
 *   2. inner bloom — white→hue, tighter
 *   3. chromatic edges — violet/cyan ghosts (RADIANTE only), `plus`
 *   4. diffraction rays — feathered streaks, `plus`
 *   5. blown core — over-exposed white centre, `plus`
 *   6. sparkles — a few off-axis twinkles, `plus`
 * Drama is gated on register exactly like the SVG StarNode: radiante =
 * full supernova, en-formación = a modest bloom + two short rays,
 * silencio is never drawn here (its faint SVG point is enough). */
function FlareNode({
  vbX,
  vbY,
  b,
  dimKey,
  hero,
  phase,
  k,
  zoomT,
  targetX,
  targetY,
  slowClock,
  reduced,
}: {
  vbX: number
  vbY: number
  b: number
  dimKey: DimensionKey
  /** True only for the day's brightest en-luz dimension — earns the
   *  full lens-flare (long cross, streak, chroma, sparkles, white core).
   *  Every other star accompanies with a calmer cream bloom. */
  hero: boolean
  phase: number
  k: number
  zoomT: SharedValue<number>
  targetX: SharedValue<number>
  targetY: SharedValue<number>
  slowClock: SharedValue<number>
  reduced: boolean
}) {
  const radiante = b >= TONE_BRILLANTE
  const R = 2.5 + b * 1.5
  const dimRgb = hexToRgb(colors.dimension[dimKey])
  const creamRgb = hexToRgb(SKY.haloCream)
  // CONTINUOUS intensity in brightness — replaces the old binary
  // `radiante ? 1 : 0.68` step so 0.92 dominates 0.72 instead of every
  // radiante star detonating identically. Formación ramps 0.45→0.69,
  // radiante 0.70→1.0; continuous across the 0.7 boundary.
  const m = radiante ? 0.7 + (b - 0.7) : 0.45 + (b - 0.3) * 0.6

  // Mirror of OrbitalSystem's zoomTransform, baked straight to canvas
  // pixels: place the flare at the node's live screen position and scale
  // it by the zoom (s) × the viewBox→pixel factor (k).
  const transform = useDerivedValue(() => {
    const tz = zoomT.value
    const s = 1 + tz * (ZOOM_SCALE - 1)
    const mix = Math.min(tz, 1)
    const tx = mix * (ART_CENTER_X - s * targetX.value)
    const ty = mix * (FOCUS_CENTER_Y - s * targetY.value)
    const cx = (s * vbX + tx) * k
    const cy = (s * vbY + ty - VB_TOP) * k
    return [{ translateX: cx }, { translateY: cy }, { scale: s * k }]
  })
  // Fade the whole flare out as the camera locks on (gone by zoomT ≈ 0.4)
  // — the SVG glyph + coloured halo carry the focus state from there.
  const opacity = useDerivedValue(() => Math.max(0, 1 - Math.min(1, zoomT.value * 2.5)))
  // Slow respiration of the glow halo only — the core never blinks.
  const breathe = useDerivedValue(() => {
    const wave = reduced ? 0.5 : 0.5 + 0.5 * Math.sin((slowClock.value + phase) * 2 * Math.PI)
    const sc = 0.9 + wave * 0.18
    return [{ scale: sc }]
  })

  // Bloom radii — a white-hot core inside a wider dimension-hue aura, so
  // the star reads as white light BUT each dimension keeps its colour
  // identity (colour = "en luz"). The hue aura is feathered (blurred),
  // never the hard disc the PNG painted.
  const whiteBloomR = radiante ? R * 5.5 : R * 3.5
  const hueBloomR = radiante ? R * 15 : R * 8

  // The defining feature: a DENSE FINE STARBURST. Many thin spikes at
  // even angles, alternating long/short, kept sharp (low blur). A small
  // deterministic angular jitter stops it reading as a machined gear.
  // Fine starburst points — kept modest for every en-luz star. Odd
  // counts read less like a machined grid than even ones.
  const spikeCount = radiante ? 5 : 3
  const burst = Array.from({ length: spikeCount }, (_, i) => {
    const ang = (i * Math.PI * 2) / spikeCount + (((i * 37) % 7) - 3) * 0.03
    const long = i % 2 === 0
    return {
      ang,
      len: R * (long ? (radiante ? 8 : 5) : radiante ? 4 : 2.5),
      th: R * 0.22,
      op: (long ? 0.7 : 0.4) * m,
    }
  })
  // Dominant cross — the long bright rays that anchor the burst. The
  // FULL two-ray cross is the HERO's alone; other radiante stars get a
  // single short ray; en-formación gets none, so it reads as a calm
  // "ember", not a competing star. The vertical ray is nudged off
  // perfect 90° so the heroes' crosses don't tile into a grid.
  const majors = hero
    ? [
        { ang: 0, len: R * 10, th: R * 0.36, op: 0.7 },
        { ang: Math.PI / 2 + 0.05, len: R * 8, th: R * 0.3, op: 0.6 },
      ]
    : radiante
      ? [{ ang: 0, len: R * 5, th: R * 0.26, op: 0.4 }]
      : []
  // Long soft anamorphic streak — HERO only. The far-shooting line is
  // the single most "spectacular" element, so only the day's brightest
  // star earns it.
  const streaks = hero ? [{ ang: 0, len: R * 16, th: R * 0.5, op: 0.16 }] : []

  // Off-axis twinkles — the hero gets a small scatter; other radiante
  // stars a single glint; en-formación none.
  const sparkles = hero
    ? [
        { x: R * 7, y: -R * 4, r: R * 0.45, op: 0.5 },
        { x: -R * 5, y: R * 6, r: R * 0.38, op: 0.42 },
      ]
    : radiante
      ? [{ x: R * 4, y: -R * 3, r: R * 0.38, op: 0.4 }]
      : []

  return (
    <SkiaGroup transform={transform} opacity={opacity}>
      {/* 0 · knock back the PNG's hard coloured halo behind the node so
          the flare reads as white light on nebula, not a coloured disc.
          Normal blend (darkens toward the page bg), feathered to nothing. */}
      <SkiaCircle c={vec(0, 0)} r={R * 7.5}>
        <SkiaRadialGradient
          c={vec(0, 0)}
          r={R * 7.5}
          colors={[
            `rgba(${SKIA_BG_RGB},0.5)`,
            `rgba(${SKIA_BG_RGB},0.18)`,
            `rgba(${SKIA_BG_RGB},0)`,
          ]}
        />
      </SkiaCircle>

      {/* 1 · bloom — white-dominant, with a faint hue wash beneath.
          Respirating together. */}
      <SkiaGroup blendMode="screen" transform={breathe}>
        <SkiaCircle c={vec(0, 0)} r={hueBloomR}>
          <SkiaRadialGradient
            c={vec(0, 0)}
            r={hueBloomR}
            colors={[
              `rgba(${dimRgb},${0.55 * m})`,
              `rgba(${dimRgb},${0.18 * m})`,
              `rgba(${dimRgb},0)`,
            ]}
          />
          <BlurMask blur={R * 4} style="normal" />
        </SkiaCircle>
        <SkiaCircle c={vec(0, 0)} r={whiteBloomR}>
          <SkiaRadialGradient
            c={vec(0, 0)}
            r={whiteBloomR}
            colors={[
              `rgba(255,255,255,${0.35 * m})`,
              `rgba(255,255,255,${0.1 * m})`,
              'rgba(255,255,255,0)',
            ]}
          />
          <BlurMask blur={R * 2} style="normal" />
        </SkiaCircle>
      </SkiaGroup>

      {/* 2 · long anamorphic streaks (soft, behind the burst). */}
      {streaks.length > 0 ? (
        <SkiaGroup blendMode="plus">
          {streaks.map((s, i) => (
            <SkiaGroup key={`streak-${i}`} transform={[{ rotate: s.ang }]}>
              <SkiaRect x={-s.len} y={-s.th / 2} width={s.len * 2} height={s.th}>
                <SkiaLinearGradient
                  start={vec(-s.len, 0)}
                  end={vec(s.len, 0)}
                  colors={[
                    'rgba(255,255,255,0)',
                    `rgba(255,255,255,${s.op})`,
                    'rgba(255,255,255,0)',
                  ]}
                  positions={[0, 0.5, 1]}
                />
                <BlurMask blur={R * 0.9} style="normal" />
              </SkiaRect>
            </SkiaGroup>
          ))}
        </SkiaGroup>
      ) : null}

      {/* 3 · fine starburst spikes + dominant cross. */}
      <SkiaGroup blendMode="plus">
        {burst.map((r, i) => (
          <SkiaGroup key={`burst-${i}`} transform={[{ rotate: r.ang }]}>
            <SkiaRect x={-r.len} y={-r.th / 2} width={r.len * 2} height={r.th}>
              <SkiaLinearGradient
                start={vec(-r.len, 0)}
                end={vec(r.len, 0)}
                colors={['rgba(255,255,255,0)', `rgba(255,255,255,${r.op})`, 'rgba(255,255,255,0)']}
                positions={[0, 0.5, 1]}
              />
              <BlurMask blur={Math.max(0.4, r.th * 0.4)} style="normal" />
            </SkiaRect>
          </SkiaGroup>
        ))}
        {majors.map((r, i) => (
          <SkiaGroup key={`major-${i}`} transform={[{ rotate: r.ang }]}>
            <SkiaRect x={-r.len} y={-r.th / 2} width={r.len * 2} height={r.th}>
              <SkiaLinearGradient
                start={vec(-r.len, 0)}
                end={vec(r.len, 0)}
                colors={['rgba(255,255,255,0)', `rgba(255,255,255,${r.op})`, 'rgba(255,255,255,0)']}
                positions={[0, 0.5, 1]}
              />
              <BlurMask blur={Math.max(0.5, r.th * 0.5)} style="normal" />
            </SkiaRect>
          </SkiaGroup>
        ))}
      </SkiaGroup>

      {/* 4 · chromatic glints near the core (HERO only). */}
      {hero ? (
        <SkiaGroup blendMode="plus">
          <SkiaCircle
            c={vec(R * 1.3, -R * 0.5)}
            r={R * 1.1}
            color={`rgba(${SKIA_FLARE_CHROMA.cyan},0.5)`}
          >
            <BlurMask blur={R * 0.6} style="normal" />
          </SkiaCircle>
          <SkiaCircle
            c={vec(-R * 1.3, R * 0.5)}
            r={R * 1.1}
            color={`rgba(${SKIA_FLARE_CHROMA.violet},0.5)`}
          >
            <BlurMask blur={R * 0.6} style="normal" />
          </SkiaCircle>
        </SkiaGroup>
      ) : null}

      {/* 5 · core — the HERO keeps a blown white centre; every other
          star gets a softer CREAM core (feathered, lower opacity) so
          only ONE point on screen is pure-white. A micro blur on the
          inner disc kills the hard "pill" edge → reads as light, not a
          solid dot. */}
      <SkiaGroup blendMode="plus">
        <SkiaCircle c={vec(0, 0)} r={hero ? R * 2.4 : R * 1.8}>
          <SkiaRadialGradient
            c={vec(0, 0)}
            r={hero ? R * 2.4 : R * 1.8}
            colors={
              hero
                ? ['rgba(255,255,255,0.7)', 'rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']
                : [`rgba(${creamRgb},0.5)`, `rgba(${creamRgb},0.16)`, `rgba(${creamRgb},0)`]
            }
          />
          <BlurMask blur={R} style="normal" />
        </SkiaCircle>
        <SkiaCircle
          c={vec(0, 0)}
          r={hero ? R * 0.85 : R * 0.6}
          color={hero ? 'white' : `rgba(${creamRgb},0.75)`}
        >
          <BlurMask blur={R * 0.25} style="normal" />
        </SkiaCircle>
      </SkiaGroup>

      {/* 6 · sparkles. */}
      <SkiaGroup blendMode="plus">
        {sparkles.map((s, i) => (
          <SkiaCircle
            key={`sp-${i}`}
            c={vec(s.x, s.y)}
            r={s.r}
            color={`rgba(255,255,255,${s.op})`}
          />
        ))}
      </SkiaGroup>
    </SkiaGroup>
  )
}

// Warm luminous cream (SKY.haloCream) as "r,g,b" — the mote colour.
const WEAVE_RGB = '255,233,214'

// Ambient rising motes — a slow drift of faint cosmic dust up the frame,
// screen-space (NOT zoomed) so it stays a constant atmospheric layer.
// This is the only thing left from the constellation-weave experiment:
// the glowing hexagon lines + node rings were removed because hard
// geometry over the photographic galaxy read as "background image with
// CAD on top". The realistic astrophotography read wins: photo galaxy +
// glowing stars + this faint drifting dust, no infographic linework.
// Deterministic seeds keep the motes stable across renders.
const RISE_PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  fx: ((i * 73) % 100) / 100,
  size: 0.7 + (((i * 37) % 10) / 10) * 1.1,
  phase: (i % 7) / 7,
  sway: 6 + (i % 5) * 3,
  speed: 0.5 + (((i * 53) % 10) / 10) * 0.4,
}))

const RiseMote = memo(function RiseMote({
  p,
  t,
  w,
  h,
  reduced,
}: {
  p: (typeof RISE_PARTICLES)[number]
  t: SharedValue<number>
  w: number
  h: number
  reduced: boolean
}) {
  const pos = useDerivedValue(() => {
    const prog = reduced ? p.phase : (t.value * p.speed + p.phase) % 1
    return vec(p.fx * w + Math.sin(prog * Math.PI * 2) * p.sway, h * (1 - prog))
  })
  const opacity = useDerivedValue(() => {
    const prog = reduced ? p.phase : (t.value * p.speed + p.phase) % 1
    return Math.sin(prog * Math.PI) * 0.5
  })
  return (
    <SkiaCircle c={pos} r={p.size} color={`rgba(${WEAVE_RGB},1)`} opacity={opacity}>
      <BlurMask blur={0.9} style="normal" />
    </SkiaCircle>
  )
})

function RisingParticles({
  t,
  w,
  h,
  reduced,
}: {
  t: SharedValue<number>
  w: number
  h: number
  reduced: boolean
}) {
  return (
    <SkiaGroup blendMode="screen">
      {RISE_PARTICLES.map((p, i) => (
        <RiseMote key={`rise-${i}`} p={p} t={t} w={w} h={h} reduced={reduced} />
      ))}
    </SkiaGroup>
  )
}

/* The Skia overlay — one <Canvas> spanning the same box as the SVG. It
 * draws the constellation weave + ambient particles, then a FlareNode
 * for every EN-LUZ dimension at its viewBox position. `k` (canvas px ÷
 * viewBox width) converts viewBox units to pixels; it comes from the
 * wrap's measured layout. */
const SkiaFlareLayer = memo(function SkiaFlareLayer({
  placed,
  k,
  zoomT,
  targetX,
  targetY,
  slowClock,
  t,
  reduced,
}: {
  placed: { d: Dimension; pos: { x: number; y: number } }[]
  k: number
  zoomT: SharedValue<number>
  targetX: SharedValue<number>
  targetY: SharedValue<number>
  slowClock: SharedValue<number>
  t: SharedValue<number>
  reduced: boolean
}) {
  const enLuz = placed.filter(({ d }) => d.brightness >= EN_LUZ_THRESHOLD)
  // The day's PROTAGONIST — the single brightest en-luz dimension. Only
  // it earns the full lens-flare arsenal (long cross, streak, chroma,
  // sparkles, pure-white core); every other star accompanies. This is
  // the hierarchy lever: a real day has one or two things alight, not
  // six identical suns. Ties resolve to the first in render order.
  const heroEntry = enLuz.reduce<(typeof enLuz)[number] | null>(
    (best, cur) => (best == null || cur.d.brightness > best.d.brightness ? cur : best),
    null,
  )
  const heroKey = heroEntry?.d.key ?? null
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {enLuz.map(({ d, pos }) => (
        <FlareNode
          key={d.key}
          vbX={pos.x}
          vbY={pos.y}
          b={d.brightness}
          dimKey={d.key}
          hero={d.key === heroKey}
          phase={(d.angleDeg / 360) % 1}
          k={k}
          zoomT={zoomT}
          targetX={targetX}
          targetY={targetY}
          slowClock={slowClock}
          reduced={reduced}
        />
      ))}
      {/* Ambient rising motes — screen-space, on top, very faint. */}
      <RisingParticles t={t} w={k * W} h={k * VB_H} reduced={reduced} />
    </Canvas>
  )
})

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
  // The drama is SEMANTIC: only a RADIANTE dimension (b ≥ 0.7)
  // detonates into a full supernova / lens-flare — long rays, a
  // dense corona, an over-exposed core and chromatic tails. An
  // "en formación" star (EN_LUZ ≤ b < BRILLANTE) gets a modest
  // bloom; a "silencio" star (b < EN_LUZ) stays a subtle point.
  // Everything below is gated off `radiante` so brightness alone
  // reads at a glance — colour + explosion = alight.
  const radiante = b >= TONE_BRILLANTE
  // When Skia owns the flare, this SVG StarNode drops its soft glow +
  // diffraction rays + chromatic edges (Skia draws them with real blur)
  // and keeps only the crisp core pin + the focus glyph/halo cinematic.
  const skiaOwnsFlare = USE_SKIA_FLARE && enLuz
  // The day-orb.png backdrop already paints each dimension as a
  // bright magenta halo with a thin Saturn ring. The programmatic
  // StarNode now only adds: (1) a tiny white-hot core + (2) the
  // diffraction-spike cross + (3) the per-star breath/selection
  // pulse animation. Halo radii are minimal so the painted star
  // stays the visual subject and the programmatic layer just
  // contributes life.
  const R = enLuz ? 2.5 + b * 1.5 : 2
  // Background bloom radii — escalated by register. A radiante star
  // throws a far wider, denser bloom (the supernova read); en
  // formación stays modest; silencio recedes. These feed both the
  // static three-layer bloom and the respirating slowGlow's base.
  const outerR = radiante ? R * 3.2 : enLuz ? R * 1.8 : R * 1.4
  const midR = radiante ? R * 2.4 : enLuz ? R * 1.4 : R * 1.2
  const auraR = radiante ? R * 1.6 : enLuz ? R * 1.1 : R * 1.05

  // Per-register lens-flare parameters. The geometry IS the drama —
  // these stay constant so the supernova reads identically with
  // animation OFF (reduced motion). The shimmer group only wobbles
  // scale a little on top.
  const spikeLength = radiante ? R * 20 : R * 6
  const spikeOpacity = radiante ? 1 : 0.45
  const spikeDiagOpacity = radiante ? 0.78 : 0
  const spikeStroke = radiante ? R * 0.42 : R * 0.22
  const coronaCount = radiante ? 24 : enLuz ? 6 : 0
  const coronaOpacity = radiante ? spikeOpacity * 0.62 : 0.3

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
  // `outerR` already carries the per-register radius (radiante = wide
  // supernova bloom), so this respirating layer inherits the drama.
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
  // Brightness gain — drives halo + glyph opacity from the dimension's
  // live brightness so the focused art looks AS QUIET as the dimension
  // is. EN SILENCIO (b < EN_LUZ_THRESHOLD) targets ~0.45 of the bloom;
  // a RADIANTE dim reaches full. Without this, every focused star
  // shouted with identical bloom regardless of data state — the audit
  // flagged it as "EN SILENCIO se ve igual de bright que EN LUZ".
  const brightnessGain = 0.45 + 0.55 * Math.min(1, b / TONE_BRILLANTE)

  const glyphAnim = useAnimatedProps(() => {
    'worklet'
    const z = Math.min(1, zoomT.value * 1.4)
    const op = z * z * 0.95 * brightnessGain
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
  // atmospheric, not opaque. Multiplied by brightnessGain so quiet
  // dimensions render a quiet halo.
  const haloAnim = useAnimatedProps(() => {
    'worklet'
    const z = Math.min(1, zoomT.value * 1.6)
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    // Arrival settle — popT (the one-shot selection pulse) gives the halo
    // a single over-shoot breath (×1 → ×1.12 → ×1) the instant the camera
    // lands, before it eases into the ambient `wave` respiration. Scaled
    // about (x, y) so it grows from the star, not the origin.
    const settle = 1 + popT.value * 0.12
    return {
      opacity: z * z * (0.55 + 0.18 * wave) * brightnessGain,
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: settle },
        { translateX: -x },
        { translateY: -y },
      ],
    }
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
  // twinkle of real camera-lens diffraction. The dense corona +
  // the chromatic tails live INSIDE this single group, so the
  // whole supernova rides ONE animated transform — never 24
  // spikes animated separately.
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
          stroke={colors.leche}
          strokeWidth={1.4}
          animatedProps={ripple}
        />
      ) : null}
      <AnimatedG animatedProps={breath}>
        {/* Slow respirating glow — only en luz stars get one. Sits
            BEHIND every other layer so it reads as ambient breathing
            light, not a competing bloom. Its `r` and opacity vary on
            slowClock; the breath group above only contributes scale
            + the soft opacity dip. A radiante star inherits the wide
            supernova `outerR` AND tints to the dimension colour. */}
        {enLuz && !skiaOwnsFlare ? (
          <AnimatedCircle
            cx={x}
            cy={y}
            fill={radiante ? colors.dimension[dim.key] : CONSTELLATION_COLORS.starHalo}
            animatedProps={slowGlow}
          />
        ) : null}
        {/* Three-layer bloom: wide outer → mid → tight warm aura.
            The outer bloom carries the dimension's OWN colour ONLY when
            it's "brillante" (b ≥ TONE_BRILLANTE) — so a glance reads
            which dimensions are en luz today. "En formación" and
            "silencio" stay neutral cream, so colour means "alight".
            Radiante also drives a magenta fall to a fuller peak
            (caída magenta) — the over-exposed supernova base. */}
        {skiaOwnsFlare ? null : (
          <>
            <Circle
              cx={x}
              cy={y}
              r={outerR}
              fill={radiante ? colors.dimension[dim.key] : SKY.starGlow}
              opacity={radiante ? 0.3 : enLuz ? 0.14 + b * 0.12 : 0.05}
            />
            {radiante ? (
              <Circle cx={x} cy={y} r={midR * 1.2} fill={colors.magenta} opacity={0.22} />
            ) : null}
            <Circle
              cx={x}
              cy={y}
              r={midR}
              fill={SKY.starGlow}
              opacity={radiante ? 0.4 : enLuz ? 0.2 + b * 0.14 : 0.06}
            />
            <Circle
              cx={x}
              cy={y}
              r={auraR}
              fill={SKY.starGlow}
              opacity={radiante ? 0.6 : enLuz ? 0.38 + b * 0.22 : 0.1}
            />
          </>
        )}
        {/* Lens-flare starburst — ON for EVERY en luz star, but the
            DRAMA is gated on register. A radiante star gets long rays
            (R*20), bright diagonals, a dense 24-spike corona and the
            chromatic tails (all riding ONE shimmer group). En
            formación gets a modest R*6 cross + a sparse 6-spike
            corona, no diagonals, no chroma. Everything is geometry +
            opacity so it reads identically with motion OFF. */}
        {enLuz && !skiaOwnsFlare ? (
          <AnimatedG animatedProps={shimmerAnim}>
            {/* Chromatic-aberration tails — violet + cyan ghosts the
                lens throws past a blown-out core, offset ~0.4·R from
                the H and V axes. RADIANTE ONLY. Inside the shimmer
                group so they twinkle + fade with focusDim like the
                spikes. */}
            {radiante ? (
              <>
                <Ellipse
                  cx={x - R * 0.4}
                  cy={y}
                  rx={R * 21}
                  ry={Math.max(1.2, R * 0.3)}
                  fill="url(#flare-chroma-violet)"
                  opacity={0.7}
                />
                <Ellipse
                  cx={x + R * 0.4}
                  cy={y}
                  rx={R * 21}
                  ry={Math.max(1.2, R * 0.3)}
                  fill="url(#flare-chroma-cyan)"
                  opacity={0.6}
                />
                <Ellipse
                  cx={x}
                  cy={y - R * 0.4}
                  rx={Math.max(1, R * 0.26)}
                  ry={R * 21}
                  fill="url(#flare-chroma-violet)"
                  opacity={0.7}
                />
                <Ellipse
                  cx={x}
                  cy={y + R * 0.4}
                  rx={Math.max(1, R * 0.26)}
                  ry={R * 21}
                  fill="url(#flare-chroma-cyan)"
                  opacity={0.6}
                />
              </>
            ) : null}
            <DiffractionSpikes
              x={x}
              y={y}
              length={spikeLength}
              opacity={spikeOpacity}
              diagOpacity={spikeDiagOpacity}
              strokeWidth={spikeStroke}
              coronaCount={coronaCount}
              coronaOpacity={coronaOpacity}
              sparkleCount={radiante ? 5 : 2}
            />
          </AnimatedG>
        ) : null}
        {/* Impact flash — a brief expanding white burst that fires
            on selection, driven by popT. */}
        {selected ? (
          <AnimatedCircle cx={x} cy={y} fill={SKY.starCore} animatedProps={flashAnim} />
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
            give the centre its blown-out brightness peak. A
            radiante star over-exposes: a wider core-gradient disc,
            a new innerGlow wash and a heavier white-disc stack.

            The white discs + new innerGlow are wrapped in an
            AnimatedG that fades them during zoom on the SELECTED
            star — so the dimension glyph rendered below has a
            magenta-bloom canvas to land on instead of being washed
            out by the opaque white core. */}
        <AnimatedG animatedProps={coreFade}>
          {/* Inner glow — a soft over-exposed wash painted under the
              white discs. RADIANTE = wide + near-opaque (the blown
              core); en formación = small + softer; silencio = none. */}
          {skiaOwnsFlare ? null : radiante ? (
            <Circle cx={x} cy={y} r={R * 6.4} fill="url(#flare-soft)" opacity={0.9} />
          ) : b >= EN_LUZ_THRESHOLD ? (
            <Circle cx={x} cy={y} r={R * 3} fill="url(#flare-soft)" opacity={0.5} />
          ) : null}
          {skiaOwnsFlare ? null : (
            <>
              <Circle
                cx={x}
                cy={y}
                r={radiante ? R * 4.6 : enLuz ? R * 2.2 : R}
                fill="url(#orb-star)"
              />
              {radiante ? (
                <>
                  <Circle cx={x} cy={y} r={R * 2.2} fill={SKY.starCore} opacity={0.55} />
                  <Circle cx={x} cy={y} r={R * 1.3} fill={SKY.starCore} opacity={0.95} />
                  <Circle cx={x} cy={y} r={R * 0.7} fill={SKY.starCore} opacity={1} />
                </>
              ) : enLuz ? (
                <>
                  <Circle cx={x} cy={y} r={R * 1.1} fill={SKY.starCore} opacity={0.32} />
                  <Circle cx={x} cy={y} r={R * 0.5} fill={SKY.starCore} opacity={1} />
                </>
              ) : (
                <Circle cx={x} cy={y} r={R * 0.4} fill={SKY.starCore} opacity={1} />
              )}
            </>
          )}
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
          {/* The neutral `focus-spark` cream layer was here. Removed
              per art audit — the dimension-tinted halo above is more
              confident on its own; the cream wash sat on top and
              flattened the hue into generic "AI yellow / gold",
              reading as a Photoshop outer-glow filter rather than
              atmospheric light. */}
        </>
      ) : null}
      {/* Dimension glyph — materialises at the star centre as the
          zoom cinematic progresses. A blurred, dimension-hued copy sits
          BEHIND the crisp cream one (glyph-glow filter): the
          constellation EMITS light in its own colour and bleeds it into
          the halo, instead of reading as a flat rose sticker on a disc. */}
      {showGlyph ? (
        <AnimatedG animatedProps={glyphAnim}>
          <G filter={`url(#glyph-glow-${dim.key})`} opacity={0.85}>
            {GLYPHS[dim.key]}
          </G>
          {/* Crisp glyph layer — tinted to the DIMENSION's brand hue
              instead of generic cream. Per art audit: the glyph must
              "bathe in the same hue as its halo" so the focused art
              speaks one colour, not "neutral icon on coloured glow".
              Requires line-work SVGs that respect `currentColor` (see
              the redrawn energy-vect.svg). */}
          <G color={colors.dimension[dim.key]}>{GLYPHS[dim.key]}</G>
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
    fontSize: typography.sizes.bodyLarge,
    color: SKY.haloCream,
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
