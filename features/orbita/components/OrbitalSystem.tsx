import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
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
  Ellipse,
  G,
  Line,
  LinearGradient,
  Mask,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import { colors, typography } from '@/theme'

import { EN_LUZ_THRESHOLD, type Dimension, type DimensionKey } from '../logic'
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
// The diagram fades to transparent over its top FADE_H units — a mask,
// not a coloured overlay, so the real page background shows through
// and there is no flat patch.
const FADE_H = 56

// Three orbits — modelled after the triple-star reference photo. The
// shapes are hand-tuned for each orbit's character (tall vertical,
// two opposite diagonals meeting at the centre). They are FIXED,
// independent of the dimensions: the orbits are the structural
// drawing of the diagram, not derived from data.
const ORBITS: readonly {
  cx: number
  cy: number
  rx: number
  ry: number
  rotation: number
  /** Per-orbit stroke params so the three lines have depth, not the
   *  same flat weight. One feels closer, one farther — like a long
   *  exposure where the brightness of each path varies. */
  strokeOpacity: number
  strokeWidth: number
}[] = [
  // Tres trazos cósmicos asimétricos: ninguno comparte centro, eje
  // ni inclinación con otro. Ángulos 95° / 25° / 145° — diferencias
  // de 70° / 50° / 120°, jamás perpendiculares ni en triqueta. Cada
  // órbita encierra al núcleo y cruza a las otras dos en puntos
  // distintos → tejido cósmico real, no logotipo.
  // 1 — la vertical-tendida: larga, casi vertical, ligeramente caída.
  { cx: 175, cy: 145, rx: 130, ry: 50, rotation: 95, strokeOpacity: 0.4, strokeWidth: 1.4 },
  // 2 — la cometa diagonal: la más estirada (3:1), brilla un poco más.
  { cx: 200, cy: 215, rx: 120, ry: 40, rotation: 25, strokeOpacity: 0.5, strokeWidth: 1.6 },
  // 3 — la barrida amplia: más redonda, contracorriente, se desvanece.
  { cx: 165, cy: 195, rx: 110, ry: 60, rotation: 145, strokeOpacity: 0.32, strokeWidth: 1.2 },
]

// Three dimensions live ON the orbits (at the prominent tip of each).
// The other three are PERIPHERAL — distant stars in the field around
// the orbital cluster, still part of the diagram but outside the main
// dance. Active flows (mente/energía/alimento) anchor the orbits;
// structural ones (cuerpo/sueño/ciclo) hover at the edges.
const STAR_POS: Record<DimensionKey, { x: number; y: number }> = {
  // Orbital trio — on the outer tips of each ellipse's major axis.
  // The vertical orbit's slight tilt nudges MENTE a touch right.
  mente: { x: 194, y: 26 },
  energia: { x: 79, y: 284 },
  alimento: { x: 293, y: 284 },
  // Peripheral trio — around the cluster, outside the orbits.
  cuerpo: { x: 45, y: 130 },
  sueno: { x: 325, y: 130 },
  ciclo: { x: 185, y: 325 },
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
  // (44 s) drives the nebula. orbit1/2/3 (relatively prime periods)
  // drive the destello traveling along each orbit; spin1/2/3 (longer,
  // also relatively prime) precess each ellipse's tilt — the bright
  // spot of the gradient sweeps around as the orbit slowly rotates,
  // so the three traces never freeze into a static drawing.
  const t = useSharedValue(0)
  const drift = useSharedValue(0)
  const orbit1 = useSharedValue(0)
  const orbit2 = useSharedValue(0)
  const orbit3 = useSharedValue(0)
  const spin1 = useSharedValue(0)
  const spin2 = useSharedValue(0)
  const spin3 = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    drift.value = withRepeat(withTiming(1, { duration: 44000, easing: Easing.linear }), -1, false)
    orbit1.value = withRepeat(withTiming(1, { duration: 13000, easing: Easing.linear }), -1, false)
    orbit2.value = withRepeat(withTiming(1, { duration: 17000, easing: Easing.linear }), -1, false)
    orbit3.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.linear }), -1, false)
    spin1.value = withRepeat(withTiming(1, { duration: 38000, easing: Easing.linear }), -1, false)
    spin2.value = withRepeat(withTiming(1, { duration: 47000, easing: Easing.linear }), -1, false)
    spin3.value = withRepeat(withTiming(1, { duration: 53000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(drift)
      cancelAnimation(orbit1)
      cancelAnimation(orbit2)
      cancelAnimation(orbit3)
      cancelAnimation(spin1)
      cancelAnimation(spin2)
      cancelAnimation(spin3)
    }
  }, [t, drift, orbit1, orbit2, orbit3, spin1, spin2, spin3])

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
          {/* Per-orbit pink gradient — runs along each ellipse's
              un-rotated major axis. Outer ends fade to cream-pink,
              middle blooms to soft rosy pink. The gradient rotates
              with the ellipse (same animated transform), so the
              bright zone sweeps around the orbit as it precesses. */}
          {ORBITS.map((o, i) => (
            <LinearGradient
              key={`orb-grad-${i}`}
              id={`orb-grad-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={o.cx - o.rx}
              y1={o.cy}
              x2={o.cx + o.rx}
              y2={o.cy}
            >
              <Stop offset="0%" stopColor="#FBD7E3" stopOpacity={0.2} />
              <Stop offset="32%" stopColor="#F4ABC8" stopOpacity={0.95} />
              <Stop offset="68%" stopColor="#F4ABC8" stopOpacity={0.95} />
              <Stop offset="100%" stopColor="#FBD7E3" stopOpacity={0.2} />
            </LinearGradient>
          ))}

          {/* Top-edge fade mask — black (transparent) at the canvas
              top easing to white (opaque) below, so the whole diagram
              dissolves into the page rather than ending on a hard
              edge. A mask, not an overlay: the real background shows
              through, no flat-coloured patch. */}
          <LinearGradient
            id="top-fade-grad"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={VB_TOP}
            x2="0"
            y2={VB_TOP + FADE_H}
          >
            <Stop offset="0" stopColor="#000000" />
            <Stop offset="1" stopColor="#FFFFFF" />
          </LinearGradient>
          <Mask id="top-fade" maskUnits="userSpaceOnUse" x={0} y={VB_TOP} width={W} height={VB_H}>
            <Rect x={0} y={VB_TOP} width={W} height={VB_H} fill="url(#top-fade-grad)" />
          </Mask>
        </Defs>

        {/* The whole diagram is drawn through the top-fade mask. */}
        <G mask="url(#top-fade)">
          {/* The deep field — nebula + starfield. */}
          <Cosmos t={t} drift={drift} />

          {/* Cosmic interlace — three asymmetric orbits, each with its
              own centre, axis tilt and weight. Each ellipse + its
              destello live inside a slowly-precessing group so the
              tilt drifts over time; the pink gradient sweeps with it. */}
          <OrbitGroup orbit={ORBITS[0]!} gradId="orb-grad-0" spin={spin1} particle={orbit1} />
          <OrbitGroup orbit={ORBITS[1]!} gradId="orb-grad-1" spin={spin2} particle={orbit2} />
          <OrbitGroup orbit={ORBITS[2]!} gradId="orb-grad-2" spin={spin3} particle={orbit3} />

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
              selected={d.key === selectedKey}
              faded={selectedKey != null && d.key !== selectedKey}
            />
          ))}
        </G>
      </Svg>

      {/* Tap targets — RN Pressables centred on each star. The hit
          box is generous so tiny stars stay easy to tap. */}
      {placed.map(({ d, pos }) => (
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
      ))}
    </View>
  )
}

/* The central star — small, bright, breathing. No glyph: the centre
 * is felt by composition, the orbits do the talking. */
const CORE_R = 9

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
      {/* Bloom — soft layered halo. The outermost layer is wide and
          almost invisible; it gives the eye a sense of light spilling
          beyond the bright disc without flooding the field. */}
      <Circle cx={CX} cy={CY} r={CORE_R * 7} fill={colors.magenta} opacity={0.015} />
      <Circle cx={CX} cy={CY} r={CORE_R * 4.2} fill={colors.magenta} opacity={0.06} />
      <Circle cx={CX} cy={CY} r={CORE_R * 2.6} fill={colors.magenta} opacity={0.12} />
      <Circle cx={CX} cy={CY} r={CORE_R * 1.6} fill={colors.magenta} opacity={0.22} />
      {/* Diffraction spikes — only the centre carries the cross, and
          only the cardinal pair. The "+" tells the eye this is the
          brightest body in the field; no diagonals so it stays
          minimal. */}
      <DiffractionSpikes x={CX} y={CY} length={CORE_R * 5} opacity={0.4} strokeWidth={0.7} />
      {/* The point itself. */}
      <Circle cx={CX} cy={CY} r={CORE_R} fill="url(#orb-self)" />
      <Circle cx={CX} cy={CY} r={CORE_R * 0.5} fill="#FFFFFF" opacity={0.85} />
    </AnimatedG>
  )
}

/* Telescope-style diffraction spikes — a "+" of two long thin lines
 * crossing through (x, y), with an optional diagonal "x" pair. Used
 * on the central star and on lit dimension stars to give them the
 * unmistakable look of real long-exposure astrophotography. */
function DiffractionSpikes({
  x,
  y,
  length,
  opacity,
  diagOpacity = 0,
  strokeWidth,
}: {
  x: number
  y: number
  length: number
  opacity: number
  diagOpacity?: number
  strokeWidth: number
}) {
  const d = length / Math.SQRT2
  return (
    <G>
      <Line
        x1={x - length}
        y1={y}
        x2={x + length}
        y2={y}
        stroke="#FFFFFF"
        strokeOpacity={opacity}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={x}
        y1={y - length}
        x2={x}
        y2={y + length}
        stroke="#FFFFFF"
        strokeOpacity={opacity}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {diagOpacity > 0 ? (
        <>
          <Line
            x1={x - d}
            y1={y - d}
            x2={x + d}
            y2={y + d}
            stroke="#FFFFFF"
            strokeOpacity={diagOpacity}
            strokeWidth={strokeWidth * 0.7}
            strokeLinecap="round"
          />
          <Line
            x1={x - d}
            y1={y + d}
            x2={x + d}
            y2={y - d}
            stroke="#FFFFFF"
            strokeOpacity={diagOpacity}
            strokeWidth={strokeWidth * 0.7}
            strokeLinecap="round"
          />
        </>
      ) : null}
    </G>
  )
}

/* A precessing orbit group — wraps the ellipse and its destello
 * inside an AnimatedG that rotates around the orbit's centre. The
 * static asymmetric tilt is baked into the same transform, so we
 * apply it once here instead of on the ellipse itself; the particle
 * stays anchored to the rotating frame and the pink gradient
 * sweeps along with the ellipse. */
function OrbitGroup({
  orbit,
  gradId,
  spin,
  particle,
}: {
  orbit: {
    cx: number
    cy: number
    rx: number
    ry: number
    rotation: number
    strokeOpacity: number
    strokeWidth: number
  }
  gradId: string
  spin: SharedValue<number>
  particle: SharedValue<number>
}) {
  const spinProps = useAnimatedProps(() => {
    'worklet'
    // 360° per full clock cycle, on top of the static tilt.
    const deg = orbit.rotation + spin.value * 360
    return {
      transform: [
        { translateX: orbit.cx },
        { translateY: orbit.cy },
        { rotate: `${deg}deg` },
        { translateX: -orbit.cx },
        { translateY: -orbit.cy },
      ],
    }
  })

  return (
    <AnimatedG animatedProps={spinProps}>
      <Ellipse
        cx={orbit.cx}
        cy={orbit.cy}
        rx={orbit.rx}
        ry={orbit.ry}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeOpacity={orbit.strokeOpacity}
        strokeWidth={orbit.strokeWidth}
      />
      <OrbitParticle orbit={orbit} clock={particle} />
    </AnimatedG>
  )
}

/* A luminous particle traveling along an orbit — it pulses as it
 * advances: from a tiny dim point it grows into a clear destello at
 * the far side of the orbit, then fades back. Position is computed
 * in the orbit's un-rotated local frame; the OrbitGroup wrapper
 * applies the static tilt + dynamic precession. */
function OrbitParticle({
  orbit,
  clock,
}: {
  orbit: { cx: number; cy: number; rx: number; ry: number }
  clock: SharedValue<number>
}) {
  // Wide bloom — a soft outer halo that only really lights up near
  // the peak, so the destello explodes at its zenith and disappears
  // in between. The exponent crushes the curve toward 0 in the dim
  // phase, giving the flash a sharper "on" moment.
  const bloomProps = useAnimatedProps(() => {
    'worklet'
    const phase = clock.value * 2 * Math.PI
    const pulse = 0.5 + 0.5 * Math.sin(phase - Math.PI / 2)
    const peakish = pulse * pulse
    return {
      cx: orbit.cx + orbit.rx * Math.cos(phase),
      cy: orbit.cy + orbit.ry * Math.sin(phase),
      r: 2 + peakish * 8,
      opacity: peakish * 0.35,
    }
  })

  // Outer glow — wider radius and softer; carries the bulk of the
  // brightness modulation so the destello reads as light, not mass.
  const glowProps = useAnimatedProps(() => {
    'worklet'
    const phase = clock.value * 2 * Math.PI
    const pulse = 0.5 + 0.5 * Math.sin(phase - Math.PI / 2)
    return {
      cx: orbit.cx + orbit.rx * Math.cos(phase),
      cy: orbit.cy + orbit.ry * Math.sin(phase),
      r: 1.4 + pulse * 4.4,
      opacity: 0.08 + pulse * 0.7,
    }
  })

  // Bright core — the white-hot point at the centre of the destello.
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const phase = clock.value * 2 * Math.PI
    const pulse = 0.5 + 0.5 * Math.sin(phase - Math.PI / 2)
    return {
      cx: orbit.cx + orbit.rx * Math.cos(phase),
      cy: orbit.cy + orbit.ry * Math.sin(phase),
      r: 0.5 + pulse * 2.1,
      opacity: 0.5 + pulse * 0.5,
    }
  })

  return (
    <G>
      <AnimatedCircle animatedProps={bloomProps} fill="#FBD7E3" />
      <AnimatedCircle animatedProps={glowProps} fill="#F5EDE7" />
      <AnimatedCircle animatedProps={coreProps} fill="#FFFFFF" />
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
  selected,
  faded,
}: {
  dim: Dimension
  pos: { x: number; y: number }
  t: SharedValue<number>
  popT: SharedValue<number>
  rippleT: SharedValue<number>
  selected: boolean
  faded: boolean
}) {
  const { x, y } = pos
  const b = dim.brightness
  const enLuz = b >= EN_LUZ_THRESHOLD
  // Small stars — size driven by brightness, with a clear gap
  // between en luz and lejos so the eye reads them as different
  // states. The core is the bright disc; the bloom is the halo.
  const R = enLuz ? 3.2 + b * 2.6 : 2
  const bloomR = enLuz ? R * 5 : R * 2.5
  const auraR = enLuz ? R * 2.6 : R * 1.6

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

  // Label sits along the radial vector outward from the centre.
  const dx = x - CX
  const dy = y - CY
  const dist = Math.hypot(dx, dy) || 1
  const labelOff = R + 14
  const lx = x + (dx / dist) * labelOff
  const ly = y + (dy / dist) * labelOff + 3

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
        {/* Bloom — the star's outer light. Only en luz stars carry a
            wide halo; lejos ones stay tight. */}
        <Circle
          cx={x}
          cy={y}
          r={bloomR}
          fill={colors.magenta}
          opacity={enLuz ? 0.07 + b * 0.13 : 0.06}
        />
        <Circle cx={x} cy={y} r={auraR} fill="#FBD7E3" opacity={enLuz ? 0.1 + b * 0.18 : 0.08} />
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
      <SvgText
        x={lx}
        y={ly}
        textAnchor="middle"
        fontFamily={typography.uiBold}
        fontSize={9}
        fill={enLuz ? colors.leche : colors.niebla}
        opacity={selected ? 1 : enLuz ? 0.65 + b * 0.35 : 0.6}
        letterSpacing={1.3}
      >
        {dim.label}
      </SvgText>
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
})
