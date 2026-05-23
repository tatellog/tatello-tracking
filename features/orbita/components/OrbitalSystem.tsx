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
import Svg, { Circle, Defs, G, LinearGradient, Line, RadialGradient, Stop } from 'react-native-svg'

import { colors } from '@/theme'

import {
  CONSTELLATION_COLORS,
  getConstellationProfile,
  type ConstellationIntensity,
  type ConstellationProfile,
} from '../constants/constellationTheme'
import { EN_LUZ_THRESHOLD, type Dimension, type DimensionKey } from '../logic'
import { AnimatedConstellation } from './AnimatedConstellation'
import { Cosmos } from './Cosmos'

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

// The ConstellationDrawing is authored in a 1024 × 1024 SVG space;
// we project it into our viewBox via a single transform. ORNAMENT_S
// scales source-space units into viewBox-space units; ORNAMENT_TX/TY
// then shift so the source content centre (~520, 450) lands on the
// canvas centre. The same transform is used both on the <G> that
// renders the drawing AND on the star positions below — keeping
// the live stars perfectly aligned with the drawn bursts.
const ORNAMENT_S = 0.5
const ORNAMENT_TX = -74
const ORNAMENT_TY = -61.75

/** Project a source-space (1024-space) point into the SVG viewBox. */
function ornamentPos(sx: number, sy: number): { x: number; y: number } {
  return { x: ORNAMENT_TX + sx * ORNAMENT_S, y: ORNAMENT_TY + sy * ORNAMENT_S }
}

// Six dimension stars sit on six of the eight burst points in the
// drawing (the central diamond and a right-mid burst stay
// decorative). Source coords are read directly from the SVG's
// star-* paths in constellation_app_day.svg.
const STAR_POS: Record<DimensionKey, { x: number; y: number }> = {
  // Top burst.
  mente: ornamentPos(492, 145),
  // Upper-left and lower-left.
  cuerpo: ornamentPos(323, 252),
  energia: ornamentPos(319, 563),
  // Upper-right and right-of-centre.
  sueno: ornamentPos(662, 252),
  alimento: ornamentPos(604, 568),
  // Bottom burst.
  ciclo: ornamentPos(509, 755),
}

// The remaining two SVG burst points (right-mid and the central
// diamond). The app paints luminous decorative stars at these so
// every line endpoint terminates on a star — same source coords.
const DECORATIVE_STAR_POS: { x: number; y: number }[] = [
  ornamentPos(719, 488), // right-mid burst
  ornamentPos(509, 528), // central diamond
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
  // breath + twinkle. `drift` (44 s) drives the nebula. `slowClock`
  // drives the slow respirating glow behind active stars; its period
  // comes from the profile so 'low' breathes ~10 s, 'high' ~5.5 s.
  const t = useSharedValue(0)
  const drift = useSharedValue(0)
  const slowClock = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    drift.value = withRepeat(withTiming(1, { duration: 44000, easing: Easing.linear }), -1, false)
    slowClock.value = withRepeat(
      withTiming(1, { duration: profile.glowDurationMs, easing: Easing.linear }),
      -1,
      false,
    )
    return () => {
      cancelAnimation(t)
      cancelAnimation(drift)
      cancelAnimation(slowClock)
    }
  }, [t, drift, slowClock, profile.glowDurationMs])

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
          {/* A dimension star — warm white core fading to magenta. */}
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

          {/* The ornamental constellation — native SVG paths from
              `assets/constellations/constellation_app_day.svg`,
              projected into our viewBox via ORNAMENT_S/TX/TY. The
              AnimatedConstellation wrapper adds an energy-flow
              overlay on the eight connecting lines; everything else
              about ConstellationDrawing renders untouched. */}
          <G transform={`translate(${ORNAMENT_TX} ${ORNAMENT_TY}) scale(${ORNAMENT_S})`}>
            <AnimatedConstellation intensity={intensity} />
          </G>
          {/* Decorative stars at the two SVG burst endpoints not
              bound to a dimension (right-mid burst + central
              diamond). They share StarNode's slow-glow language so
              every line endpoint feels alive, not just the six
              interactive ones. */}
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

      {/* Soft horizontal blend fades — the diagram's content needs
          to dissolve into the page rather than ending on a hard
          vertical edge, but the previous attempt (fade to opaque
          colours.bg) painted a dark band that read as a frame
          against the surrounding magenta glow. The new approach
          uses a SEMI-TRANSPARENT, magenta-tinted end colour
          (rgba(40, 14, 24, 0.6) ≈ bg + low-mag tint at 60 %
          opacity). At the diagram's right edge the overlay dims
          the content by 60 % AND tints it toward the same wine
          shade the surrounding ambient glow lands on, so the
          transition reads as a soft dissolve into the surrounding
          rather than a coloured frame. Wide (100 px each side) for
          a long, soft falloff. */}
      <FadeGradient
        colors={['rgba(40, 14, 24, 0.6)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.leftBlend}
        pointerEvents="none"
      />
      <FadeGradient
        colors={['transparent', 'rgba(40, 14, 24, 0.6)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.rightBlend}
        pointerEvents="none"
      />
    </View>
  )
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
  // luz star is a luminous starburst with a white-hot core, three
  // layered blooms (outer wide → mid → inner aura), and a
  // diffraction-spike cross. Lejos stars stay small and quiet so
  // the contrast between states is loud.
  const R = enLuz ? 3.4 + b * 3 : 2
  const outerR = enLuz ? R * 5.5 : R * 2
  const midR = enLuz ? R * 2.8 : R * 1.5
  const auraR = enLuz ? R * 1.5 : R * 1.2

  // Each star breathes on its own phase so the constellation feels
  // alive but not synchronised. The 8 s `t` clock drives scale +
  // opacity together — both ride a sine wave but the opacity range
  // is shallower so the star never "blinks", it dips softly.
  const phase = (dim.angleDeg / 360) % 1
  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    let scale = 1 + wave * (enLuz ? profile.pulseScale + 0.04 : 0.05)
    if (selected) scale *= 1 + popT.value * 0.6
    const opacity = enLuz ? 1 - profile.pulseOpacity * (1 - wave) : 1
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
            warm aura. Layered radii + opacities produce a gradient
            falloff that reads as light spilling out of the core,
            rather than a flat filled disc.  */}
        <Circle
          cx={x}
          cy={y}
          r={outerR}
          fill={colors.magenta}
          opacity={enLuz ? 0.1 + b * 0.1 : 0.05}
        />
        <Circle cx={x} cy={y} r={midR} fill="#FBD7E3" opacity={enLuz ? 0.14 + b * 0.12 : 0.06} />
        <Circle cx={x} cy={y} r={auraR} fill="#FBD7E3" opacity={enLuz ? 0.28 + b * 0.18 : 0.1} />
        {/* Diffraction-spike starburst — ON for EVERY en luz star,
            not just the selected one. Length + opacity scale with
            brightness so brighter dimensions throw bigger flares. */}
        {enLuz ? (
          <DiffractionSpikes
            x={x}
            y={y}
            length={R * 7}
            opacity={0.4 + b * 0.35}
            diagOpacity={0.16 + b * 0.12}
            strokeWidth={0.5}
          />
        ) : null}
        {/* Impact flash — a brief expanding white burst that fires
            on selection, driven by popT. */}
        {selected ? (
          <AnimatedCircle cx={x} cy={y} fill="#FFFFFF" animatedProps={flashAnim} />
        ) : null}
        {/* Lens-flare starburst (the BIG flare) — only the selected
            star, wrapped in an AnimatedG that scales + fades in with
            the zoom. Stacks on top of the always-on spikes above. */}
        {showFlare ? (
          <AnimatedG animatedProps={flareAnim}>
            <DiffractionSpikes
              x={x}
              y={y}
              length={R * 10}
              opacity={0.7}
              diagOpacity={0.28}
              strokeWidth={0.6}
            />
          </AnimatedG>
        ) : null}
        {/* Selection crown — a cream outline ring around the core. */}
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
        {/* The luminous point — gradient disc + bright white centre.
            The centre is bigger and at full opacity now, so the core
            reads as white-hot like a real over-exposed star. */}
        <Circle cx={x} cy={y} r={R} fill="url(#orb-star)" />
        {enLuz ? <Circle cx={x} cy={y} r={R * 0.6} fill="#FFFFFF" opacity={1} /> : null}
        {enLuz ? <Circle cx={x} cy={y} r={R * 0.3} fill="#FFFFFF" /> : null}
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
  // Soft horizontal blend overlays — semi-transparent magenta-
  // tinted gradients on the left and right edges so the diagram
  // dissolves into the surrounding ambient glow without a dark
  // band or a hard edge. 100 px wide each = long, gentle falloff.
  leftBlend: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 100,
  },
  rightBlend: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 100,
  },
})
