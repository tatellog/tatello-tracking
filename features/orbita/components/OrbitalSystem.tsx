import * as Haptics from 'expo-haptics'
// Aliased — react-native-svg also exports a LinearGradient.
import { LinearGradient as FadeGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg'

import { colors } from '@/theme'

import {
  CONSTELLATION_COLORS,
  getConstellationProfile,
  type ConstellationIntensity,
  type ConstellationProfile,
} from '../constants/constellationTheme'
import { EN_LUZ_THRESHOLD, type Dimension, type DimensionKey } from '../logic'
import { AnimatedConstellation } from './AnimatedConstellation'
import { GLYPHS } from './DimensionNodeList'

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
// Zoom factor for the selected-dimension cinematic. Reduced
// 2.4 → 1.9 so MORE of the constellation stays visible during
// zoom — multiple stars + their long flares + the connecting
// hexagon all read at the same time, matching the Genshin
// reference where several luminous bodies share the frame with
// the focused one. With the bigger R + longer flares + selected
// star's +30 % breath bump on top, the focused star still
// clearly dominates.
const ZOOM_SCALE = 1.9

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
const ORNAMENT_TX = 30
const ORNAMENT_TY = -23

/** Project a source-space (1024-space) point into the SVG viewBox. */
function ornamentPos(sx: number, sy: number): { x: number; y: number } {
  return { x: ORNAMENT_TX + sx * ORNAMENT_S, y: ORNAMENT_TY + sy * ORNAMENT_S }
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

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

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

  const zoomTransform = useAnimatedProps(() => {
    'worklet'
    const tz = zoomT.value
    const s = 1 + tz * (ZOOM_SCALE - 1)
    // Zoom IN-PLACE around the selected star's own position rather
    // than panning it to the viewBox centre. The selected star
    // stays exactly where it was at rest, and everything else
    // scales outward from that point. Mathematically, that's the
    // standard "scale about (px, py)" transform expanded:
    //   translate(px·(1−s), py·(1−s)) · scale(s)
    // At s = 1 (rest) the translate is 0 — pure identity. At s =
    // ZOOM_SCALE the star is unchanged while the surrounding
    // figure expands outward.
    const tx = targetXVal.value * (1 - s)
    const ty = targetYVal.value * (1 - s)
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
        </Defs>

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

          {/* The ornamental constellation — native SVG paths from
              `assets/constellations/daily_constellation.svg`,
              projected into our viewBox via ORNAMENT_S/TX/TY. The
              AnimatedConstellation wrapper renders the six
              concentric orbits + hexagonal outline with an energy
              beam on the outer two rings; ConstellationDrawing
              paints the static axis cross + spokes + ornaments. */}
          <G transform={`translate(${ORNAMENT_TX} ${ORNAMENT_TY}) scale(${ORNAMENT_S})`}>
            <AnimatedConstellation intensity={intensity} zoomT={zoomT} />
          </G>
          {/* Decorative stars at the unused burst endpoints. They
              share StarNode's slow-glow language so every line
              endpoint feels alive — except during zoom, where they
              get pushed off-centre by the in-place scale and would
              otherwise compete with the selected star. The
              AnimatedG fades them to ~10 % at full zoom. */}
          <AnimatedG animatedProps={decorativeFade}>
            {DECORATIVE_STAR_POS.map((p, i) => (
              <DecorativeStar
                key={`decor-${i}`}
                x={p.x}
                y={p.y}
                slowClock={slowClock}
                phase={(i + 1) / (DECORATIVE_STAR_POS.length + 1)}
                profile={profile}
              />
            ))}
          </AnimatedG>

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
        </AnimatedG>
      </Svg>

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
  // Anamorphic asymmetry — the H streak is longer and wider than V,
  // which is itself longer and wider than the diagonals. What a real
  // camera lens produces; never a symmetric square cross.
  const hLen = length * 1.18
  const vLen = length * 0.74
  const dLen = length * 0.34
  const dOp = diagOpacity ?? opacity * 0.32
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
  // Lens-flare stars in the Genshin Constellation style: every en
  // luz star is a LARGE luminous starburst with a white-hot core,
  // three layered blooms (outer wide → mid → inner aura), and a
  // long diffraction-spike cross. R bumped 3.4 → 5 (base) and
  // b * 3 → b * 4 (brightness contribution); lejos stars stay
  // small + quiet so the contrast between states is loud and the
  // bright stars carry the dramatic "luminous body" weight the
  // Genshin reference set as the target.
  const R = enLuz ? 5 + b * 4 : 2.5
  const outerR = enLuz ? R * 5 : R * 1.8
  const midR = enLuz ? R * 2.5 : R * 1.5
  const auraR = enLuz ? R * 1.4 : R * 1.2

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

  // Linger the flare render for ~420 ms after deselection so it can
  // fade out alongside the zoom-out instead of vanishing the moment
  // the React `selected` prop flips back to false.
  const [showFlare, setShowFlare] = useState(selected)
  useEffect(() => {
    if (selected) {
      setShowFlare(true)
      return
    }
    const id = setTimeout(() => setShowFlare(false), 420)
    return () => clearTimeout(id)
  }, [selected])

  // Flare bloom-in: scale + opacity ramp with the zoom. The flare
  // appears later in the zoom progress (power curve on opacity) so
  // it reads as the brightness "catching up" to the camera, and
  // overshoots scale just like the camera does — when the zoom
  // recoils from 1.08 back to 1.0, the flare breathes back with it.
  const flareAnim = useAnimatedProps(() => {
    'worklet'
    const z = Math.max(0, Math.min(zoomT.value, 1.1))
    // Slightly punchier than before — opacity peaks at 0.95 (was
    // 0.85) and the flare scale ramps to 1.2 (was 1.05) at the
    // overshoot. Combined with the breath's zoom-boosted scale,
    // the focused star reads markedly more alive at full zoom.
    const opacity = z * z * 0.95
    const scale = 0.35 + z * 0.85
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

  // Core fade — fades the white-hot disc layers (the R*1.1, R*0.7,
  // R*0.4 stack) as the camera locks on a selected star, so the
  // dimension GLYPH materialising on top can be seen against the
  // magenta bloom instead of disappearing into the bright core.
  // Drops 1 → 0.15 across the zoom. Non-selected stars: no fade.
  const coreFade = useAnimatedProps(() => {
    'worklet'
    if (!selected) return { opacity: 1 }
    return { opacity: Math.max(0.15, 1 - zoomT.value * 0.85) }
  })

  // Glyph reveal — the dimension's icon (heart, bolt, moon, bowl,
  // …) materialises at the star centre as zoom progresses.
  //
  // Two layered animations share the same worklet:
  //   • OPACITY — eased fade-in tied to zoomT. The 1.4× multiplier
  //     on the squared curve puts the icon at full op by zoomT ≈ 0.7,
  //     so it arrives in step with the camera, not after.
  //   • PULSE — gentle ±5 % scale breath on the 8-s system clock,
  //     so the icon throbs slowly even after the camera settles.
  //     Composed with GLYPH_SCALE into a single `scale` so the
  //     final scale on the 24-unit viewport is `GLYPH_SCALE × pulse`.
  //   • POSITION — translate is recomputed every frame to keep the
  //     glyph centred on (x, y) regardless of the breathing scale.
  //
  // The worklet doesn't gate on `selected` — instead the AnimatedG
  // is conditionally mounted based on `showGlyph` (linger state
  // below), so non-selected stars' worklets never run. Letting the
  // worklet always use zoomT lets the icon FADE OUT smoothly with
  // the zoom-out instead of vanishing the instant `selected` flips.
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

  // Linger the glyph render for ~420 ms after deselection so it can
  // fade out alongside the zoom-out instead of unmounting the moment
  // the React `selected` prop flips back to false.
  const [showGlyph, setShowGlyph] = useState(selected)
  useEffect(() => {
    if (selected) {
      setShowGlyph(true)
      return
    }
    const id = setTimeout(() => setShowGlyph(false), 420)
    return () => clearTimeout(id)
  }, [selected])

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
    return {
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
        {/* Diffraction-spike starburst — ON for EVERY en luz star,
            not just the selected one. Length bumped R*7 → R*11 so
            the anamorphic horizontal streak extends much further
            (Genshin-style long flare). Wrapped in an AnimatedG that
            shimmers so the rays never feel frozen. */}
        {enLuz ? (
          <AnimatedG animatedProps={shimmerAnim}>
            <DiffractionSpikes
              x={x}
              y={y}
              length={R * 11}
              opacity={0.55 + b * 0.35}
              diagOpacity={0.22 + b * 0.14}
              strokeWidth={0.7}
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
        {/* Lens-flare starburst (the BIG flare) — only the selected
            star, wrapped in an AnimatedG that scales + fades in with
            the zoom. Length bumped R*10 → R*16 + opacity 0.7 → 0.85
            so the selected star throws a much longer + brighter cross
            on zoom — the dramatic Genshin "Condensed Pyronado"-style
            burst. Stacks on top of the always-on spikes above. */}
        {showFlare ? (
          <AnimatedG animatedProps={flareAnim}>
            <DiffractionSpikes
              x={x}
              y={y}
              length={R * 16}
              opacity={0.85}
              diagOpacity={0.36}
              strokeWidth={0.8}
            />
          </AnimatedG>
        ) : null}
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
        <Circle cx={x} cy={y} r={R} fill="url(#orb-star)" />
        {enLuz ? (
          <AnimatedG animatedProps={coreFade}>
            <Circle cx={x} cy={y} r={R * 1.1} fill="#FFFFFF" opacity={0.32} />
            <Circle cx={x} cy={y} r={R * 0.7} fill="#FFFFFF" opacity={1} />
            <Circle cx={x} cy={y} r={R * 0.4} fill="#FFFFFF" />
          </AnimatedG>
        ) : null}
      </AnimatedG>
      {/* Dimension glyph — the icon (heart, bolt, moon, bowl, …) of
          the selected dimension materialises at the star centre as
          zoom progresses. The AnimatedG owns position, scale,
          opacity AND the gentle breath pulse (see glyphAnim).
          Wrapped in `color="#FBD7E3"` so the glyph paths' fill +
          stroke (which use `currentColor`) read as warm cream-pink
          against the magenta bloom, instead of the white-hot
          tone of the underlying core. */}
      {showGlyph ? (
        <AnimatedG animatedProps={glyphAnim}>
          <G color="#FBD7E3">{GLYPHS[dim.key]}</G>
        </AnimatedG>
      ) : null}
      {/* Labels intentionally removed — the right-side DimensionNodeList
          is the single source of identification. Two labels for the
          same dimension was visual noise and they kept colliding with
          the ornament's flourishes. */}
    </AnimatedG>
  )
}

// Dimension glyphs are authored in a 24×24 viewport; we render them
// at ~22.8 viewBox units (scale 0.95) so the icon dominates the
// star's bloom radius and reads clearly as the focal element of
// the zoomed star — bigger than the white core that fades behind
// it, comparable in size to the right-side badge so the user reads
// "that's the energía star" without comparing them.
const GLYPH_SCALE = 0.95
const GLYPH_HALF = 12 // half the source 24-unit viewport — used to recentre.

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
