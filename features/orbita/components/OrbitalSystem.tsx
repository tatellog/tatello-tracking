import * as Haptics from 'expo-haptics'
// Aliased — react-native-svg also exports a `LinearGradient` (the
// SVG paint server used for the orbit strokes).
import { LinearGradient as FadeGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
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
  Image as SvgImage,
  Line,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg'

import { colors } from '@/theme'

import { EN_LUZ_THRESHOLD, type Dimension, type DimensionKey } from '../logic'
import { Cosmos } from './Cosmos'

// The ornamental constellation drawing — a single PNG with the
// scrollwork the Genshin-style hero needs. Imported source had a
// magenta-on-transparent line art at 818 × 912 (aspect 0.897); the
// box below matches that aspect exactly so `meet` and `slice`
// resolve to the same output and there's no letterbox or squish.
const diaOrnamentPng = require('@/assets/constellations/day-const.png') as number

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
// Zoom factor for the selected-dimension cinematic. 2.4x gives a
// neighbourhood ~155 units wide around the target — the star + its
// flare fill the frame, the rest of the constellation drifts off
// screen.
const ZOOM_SCALE = 2.4

// The PNG ornament is rendered at (IMG_X, IMG_Y) with size (IMG_W,
// IMG_H) inside the viewBox. The PNG itself is 818 × 912 pixels;
// IMG_H = IMG_W / (818/912) = 312 keeps the box at the source's
// exact aspect ratio. These constants both size the ornament and
// let us project the art's intrinsic star centres (detected from
// the PNG, in fractional coords) into the SVG's user space.
const IMG_X = 46
const IMG_Y = 20
const IMG_W = 280
const IMG_H = 312

// The art draws decorative bursts at fixed anchor points; the live
// dimension stars MUST land on those bursts so the constellation
// reads as one figure, not two layers. Fractional positions were
// detected programmatically from the PNG (cluster of pixels above
// the white-core threshold, blob-merged within a 70-px halo radius).
// `fx, fy` here go through the same mapping the <SvgImage> uses, so
// any time IMG_X/Y/W/H change the stars move with the art.
function ornamentPos(fx: number, fy: number): { x: number; y: number } {
  return { x: IMG_X + fx * IMG_W, y: IMG_Y + fy * IMG_H }
}

const STAR_POS: Record<DimensionKey, { x: number; y: number }> = {
  // Top burst — slightly right of centre.
  mente: ornamentPos(0.548, 0.119),
  // Left side: upper burst and lower burst.
  cuerpo: ornamentPos(0.095, 0.285),
  energia: ornamentPos(0.046, 0.712),
  // Right side: upper-right burst and the mid-right burst.
  sueno: ornamentPos(0.778, 0.276),
  alimento: ornamentPos(0.665, 0.704),
  // Bottom burst.
  ciclo: ornamentPos(0.51, 0.809),
}

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
}: {
  dimensions: Dimension[]
  selectedKey: DimensionKey | null
  onSelect: (key: DimensionKey) => void
}) {
  // Clocks for ambient motion. t (8 s) drives breath + twinkle; drift
  // (44 s) drives the nebula. The orbits — and their destellos — were
  // retired when the ornamental PNG took over as the constellation
  // drawing; only the two field clocks remain.
  const t = useSharedValue(0)
  const drift = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    drift.value = withRepeat(withTiming(1, { duration: 44000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(drift)
    }
  }, [t, drift])

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
    const tx = tz * (CX - ZOOM_SCALE * targetXVal.value)
    const ty = tz * (CY - ZOOM_SCALE * targetYVal.value)
    return { transform: [{ translateX: tx }, { translateY: ty }, { scale: s }] }
  })

  const placed = dimensions.map((d) => ({ d, pos: place(d) }))

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 ${VB_TOP} ${W} ${VB_H}`} style={styles.svg}>
        <Defs>
          {/* The central star — white-hot fading to magenta. */}
          <RadialGradient id="orb-self" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="40%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor="#9A2150" />
          </RadialGradient>
          {/* A dimension star — same warm core but smaller. */}
          <RadialGradient id="orb-star" cx="50%" cy="50%" r="55%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="35%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor={colors.magenta} />
          </RadialGradient>
          {/* Flare streak gradients — transparent at the tips, bright
              at the centre, so the diffraction spikes taper into the
              field instead of ending on hard cut-off points. One
              gradient per axis so each line maps onto its bounding
              box: horizontal, vertical, and the two diagonals. */}
          <LinearGradient id="flare-h" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="65%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="flare-v" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="65%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="flare-d1" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="65%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="flare-d2" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="65%" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Everything below sits inside the zoom transform — when a
            dimension is selected, this whole group translates+scales
            so the target star sits at the viewBox centre. The cosmos,
            the orbits, the centre star, the other dimension stars all
            zoom together; the selected star ends up dominating the
            frame. */}
        <AnimatedG animatedProps={zoomTransform}>
          {/* The deep field — nebula + starfield. */}
          <Cosmos t={t} drift={drift} />

          {/* The ornamental constellation drawing — scrollwork and
              decorative curves around the dimension stars. Sized
              smaller than the full viewBox so the figure fits within
              the topFade + bottomFade dissolve, and so the live
              dimension stars (whose positions are computed from the
              same IMG_X/Y/W/H constants) land exactly on the art's
              own burst points. Aspect of the box matches the PNG, so
              `meet` and `slice` resolve to the same output. */}
          <SvgImage
            x={IMG_X}
            y={IMG_Y}
            width={IMG_W}
            height={IMG_H}
            href={diaOrnamentPng}
            preserveAspectRatio="xMidYMid meet"
            opacity={0.82}
          />

          {/* The central star — the "you" the dimensions orbit. */}
          <CenterStar t={t} />

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

      {/* Top + bottom edge fades — static native gradients (cheap).
          The constellation now sits centred inside the canvas with
          breathing room above and below; both edges dissolve into
          colours.bg so the figure floats in the page instead of
          ending on hard rectangle edges. (An SVG mask would do this
          inside the SVG too, but masking the animated content group
          forced a per-frame re-composite and tanked performance.) */}
      <FadeGradient
        colors={[colors.bg, 'transparent']}
        style={styles.topFade}
        pointerEvents="none"
      />
      <FadeGradient
        colors={['transparent', colors.bg]}
        style={styles.bottomFade}
        pointerEvents="none"
      />
    </View>
  )
}

/* The central star — small, bright, breathing. Shrunk after the
 * ornamental PNG arrived: the art has its own central diamond, and
 * the previous CORE_R=9 painted a bright disc that competed with it.
 * Now the diamond carries the centre; this is just a quiet pulse. */
const CORE_R = 3.2

function CenterStar({ t }: { t: SharedValue<number> }) {
  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    const scale = 1 + wave * 0.06
    return {
      transform: [
        { translateX: CX },
        { translateY: CY },
        { scale },
        { translateX: -CX },
        { translateY: -CY },
      ],
    }
  })

  return (
    <AnimatedG animatedProps={breath}>
      {/* Bloom — soft layered halo. Tighter than before now that the
          ornament's central diamond sits behind the core; the very
          wide outermost layers were creating a magenta wash over the
          art. The bright disc carries most of the centre's weight. */}
      <Circle cx={CX} cy={CY} r={CORE_R * 4.2} fill={colors.magenta} opacity={0.03} />
      <Circle cx={CX} cy={CY} r={CORE_R * 2.6} fill={colors.magenta} opacity={0.07} />
      <Circle cx={CX} cy={CY} r={CORE_R * 1.6} fill={colors.magenta} opacity={0.14} />
      {/* Diffraction spikes — shorter and softer than before. The
          previous CORE_R * 5 with 0.4 opacity painted a high-contrast
          cross over the magenta ornament that read as a visual glitch
          rather than a flare. */}
      <DiffractionSpikes x={CX} y={CY} length={CORE_R * 3} opacity={0.25} strokeWidth={0.5} />
      {/* The point itself. */}
      <Circle cx={CX} cy={CY} r={CORE_R} fill="url(#orb-self)" />
      <Circle cx={CX} cy={CY} r={CORE_R * 0.5} fill="#FFFFFF" opacity={0.85} />
    </AnimatedG>
  )
}

/* Lens-flare spikes — the organic starburst a real camera lens
 * produces around a bright point, not a rigid geometric "+". The
 * horizontal streak is slightly longer and brighter than the
 * vertical (the anamorphic signature); each axis layers a wide soft
 * halo behind a thin bright core; tipless gradients taper the ends
 * to transparent so the streaks fade into the field; and four faint
 * diagonal whiskers soften the rigid cross into a starburst.
 *
 * Requires the parent SVG's <Defs> to define `flare-h`, `flare-v`,
 * `flare-d1`, `flare-d2` — one tapered gradient per axis.
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
  // Anamorphic asymmetry — what a real lens does, never a perfect
  // geometric square cross.
  const hLen = length * 1.18
  const vLen = length * 0.74
  // Diagonal whiskers project onto each axis by `dLen` — a short
  // overall length (≈0.6 × the vertical) so they read as faint
  // starburst whiskers, not full rays.
  const dLen = length * 0.3
  const dOp = diagOpacity ?? opacity * 0.35
  // Two-layer streak per axis: a wide soft halo behind a thin bright
  // core. The combination is what reads as "light", not a line.
  const haloW = Math.max(1, strokeWidth * 3.4)
  const coreW = Math.max(0.45, strokeWidth * 0.6)
  return (
    <G>
      {/* Horizontal — the dominant streak (anamorphic). */}
      <Line
        x1={x - hLen}
        y1={y}
        x2={x + hLen}
        y2={y}
        stroke="url(#flare-h)"
        strokeWidth={haloW}
        strokeLinecap="round"
        opacity={opacity * 0.5}
      />
      <Line
        x1={x - hLen}
        y1={y}
        x2={x + hLen}
        y2={y}
        stroke="url(#flare-h)"
        strokeWidth={coreW}
        strokeLinecap="round"
        opacity={opacity}
      />
      {/* Vertical — quieter, shorter than the horizontal. */}
      <Line
        x1={x}
        y1={y - vLen}
        x2={x}
        y2={y + vLen}
        stroke="url(#flare-v)"
        strokeWidth={haloW * 0.78}
        strokeLinecap="round"
        opacity={opacity * 0.42}
      />
      <Line
        x1={x}
        y1={y - vLen}
        x2={x}
        y2={y + vLen}
        stroke="url(#flare-v)"
        strokeWidth={coreW}
        strokeLinecap="round"
        opacity={opacity * 0.78}
      />
      {/* Diagonal whiskers — short and faint, the starburst breaks
          that keep the cross from reading as a rigid "+". */}
      {dOp > 0 ? (
        <>
          <Line
            x1={x - dLen}
            y1={y - dLen}
            x2={x + dLen}
            y2={y + dLen}
            stroke="url(#flare-d1)"
            strokeWidth={coreW}
            strokeLinecap="round"
            opacity={dOp}
          />
          <Line
            x1={x - dLen}
            y1={y + dLen}
            x2={x + dLen}
            y2={y - dLen}
            stroke="url(#flare-d2)"
            strokeWidth={coreW}
            strokeLinecap="round"
            opacity={dOp}
          />
        </>
      ) : null}
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
  selected,
  faded,
}: {
  dim: Dimension
  pos: { x: number; y: number }
  t: SharedValue<number>
  popT: SharedValue<number>
  rippleT: SharedValue<number>
  zoomT: SharedValue<number>
  selected: boolean
  faded: boolean
}) {
  const { x, y } = pos
  const b = dim.brightness
  const enLuz = b >= EN_LUZ_THRESHOLD
  // Small stars — size driven by brightness, with a clear gap
  // between en luz and lejos so the eye reads them as different
  // states. The core is the bright disc; the bloom is the halo.
  // Bloom/aura sized down from the old orbital diagram now that the
  // PNG carries its own burst halo behind each star — the previous
  // R*5 made big magenta blobs that fought the ornament.
  const R = enLuz ? 3.2 + b * 2.6 : 2
  const bloomR = enLuz ? R * 2.8 : R * 1.6
  const auraR = enLuz ? R * 1.7 : R * 1.2

  // Each star breathes on its own phase so the constellation feels
  // alive but not synchronised.
  const phase = (dim.angleDeg / 360) % 1
  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    let scale = 1 + wave * (enLuz ? 0.12 : 0.05)
    if (selected) scale *= 1 + popT.value * 0.6
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
    const opacity = z * z * 0.85
    const scale = 0.35 + z * 0.7
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

  return (
    <G opacity={faded ? 0.45 : 1}>
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
        {/* Bloom — the star's outer light. Soft, low-opacity now
            (the PNG ornament already paints its own burst behind
            each anchor, so the live star is the bright POINT, not
            another big halo). */}
        <Circle
          cx={x}
          cy={y}
          r={bloomR}
          fill={colors.magenta}
          opacity={enLuz ? 0.04 + b * 0.08 : 0.04}
        />
        <Circle cx={x} cy={y} r={auraR} fill="#FBD7E3" opacity={enLuz ? 0.06 + b * 0.1 : 0.05} />
        {/* Impact flash — a brief expanding white burst that fires
            on selection, driven by popT (peak ≈ 240 ms after the
            tap). Sits in front of the aura so it briefly washes out
            into the bloom on arrival, then fades. */}
        {selected ? (
          <AnimatedCircle cx={x} cy={y} fill="#FFFFFF" animatedProps={flashAnim} />
        ) : null}
        {/* Lens-flare starburst — wrapped in an AnimatedG that scales
            + fades in alongside the zoom progress (and lingers a
            beat after deselect so it eases out instead of vanishing).
            The inner opacity is high; the outer AnimatedG multiplies
            it down — at peak zoom the visible opacity lands around
            0.85 × 0.85 ≈ 0.7. */}
        {showFlare ? (
          <AnimatedG animatedProps={flareAnim}>
            <DiffractionSpikes
              x={x}
              y={y}
              length={R * 6}
              opacity={0.85}
              diagOpacity={0.32}
              strokeWidth={0.55}
            />
          </AnimatedG>
        ) : null}
        {/* Selection crown — sits between the aura and the bright
            point. */}
        {selected ? (
          <Circle
            cx={x}
            cy={y}
            r={R + 5}
            fill="none"
            stroke="#F4ECDE"
            strokeWidth={1.3}
            opacity={0.9}
          />
        ) : null}
        {/* The luminous point. */}
        <Circle cx={x} cy={y} r={R} fill="url(#orb-star)" />
        {enLuz ? <Circle cx={x} cy={y} r={R * 0.45} fill="#FFFFFF" opacity={0.85} /> : null}
      </AnimatedG>
      {/* Labels intentionally removed — the right-side DimensionNodeList
          is the single source of identification. Two labels for the
          same dimension was visual noise and they kept colliding with
          the ornament's flourishes. */}
    </G>
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
  // The diagram dissolves into the page across both its top and
  // bottom edges. Static native gradients — zero per-frame cost (an
  // SVG mask was the right visual but compositing it over the
  // animated group every frame was too expensive).
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
  },
})
