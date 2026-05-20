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
  RadialGradient,
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
const MAX_R = 140
const HIT = 66 // tap-target box, in px

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
  // drive a small particle traveling along each orbit — so the lines
  // feel alive, not static.
  const t = useSharedValue(0)
  const drift = useSharedValue(0)
  const orbit1 = useSharedValue(0)
  const orbit2 = useSharedValue(0)
  const orbit3 = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    drift.value = withRepeat(withTiming(1, { duration: 44000, easing: Easing.linear }), -1, false)
    orbit1.value = withRepeat(withTiming(1, { duration: 26000, easing: Easing.linear }), -1, false)
    orbit2.value = withRepeat(withTiming(1, { duration: 34000, easing: Easing.linear }), -1, false)
    orbit3.value = withRepeat(withTiming(1, { duration: 41000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(drift)
      cancelAnimation(orbit1)
      cancelAnimation(orbit2)
      cancelAnimation(orbit3)
    }
  }, [t, drift, orbit1, orbit2, orbit3])

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
      <Svg viewBox={`0 0 ${W} ${W}`} style={styles.svg}>
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
        </Defs>

        {/* The deep field — nebula + starfield. */}
        <Cosmos t={t} drift={drift} />

        {/* Cosmic interlace — three asymmetric orbits, each with its
            own centre, axis tilt and weight. Cream-white silver
            thread (not magenta) so the structure reads as quiet
            trace and the magenta lives only in the stars. */}
        {ORBITS.map((o, i) => (
          <Ellipse
            key={`orbit-${i}`}
            cx={o.cx}
            cy={o.cy}
            rx={o.rx}
            ry={o.ry}
            transform={`rotate(${o.rotation} ${o.cx} ${o.cy})`}
            fill="none"
            stroke="#F5EDE7"
            strokeOpacity={o.strokeOpacity}
            strokeWidth={o.strokeWidth}
          />
        ))}

        {/* One small particle travels along each orbit — like a comet
            tracing the line. Each at its own period so the three never
            sync up. */}
        <OrbitParticle orbit={ORBITS[0]!} clock={orbit1} />
        <OrbitParticle orbit={ORBITS[1]!} clock={orbit2} />
        <OrbitParticle orbit={ORBITS[2]!} clock={orbit3} />

        {/* The central star — the "you" the dimensions orbit. Smaller
            than before; the orbits are the loud thing now. */}
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
          style={[styles.hit, { left: `${(pos.x / W) * 100}%`, top: `${(pos.y / W) * 100}%` }]}
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

/* A small luminous particle traveling along an orbit's perimeter —
 * the orbit itself becomes alive, not just a static line. Each
 * orbit has its own clock period so the three never sync up. */
function OrbitParticle({
  orbit,
  clock,
}: {
  orbit: { cx: number; cy: number; rx: number; ry: number; rotation: number }
  clock: SharedValue<number>
}) {
  const rotRad = (orbit.rotation * Math.PI) / 180
  const cosR = Math.cos(rotRad)
  const sinR = Math.sin(rotRad)

  const props = useAnimatedProps(() => {
    'worklet'
    const phase = clock.value * 2 * Math.PI
    const ex = orbit.rx * Math.cos(phase)
    const ey = orbit.ry * Math.sin(phase)
    return {
      cx: orbit.cx + ex * cosR - ey * sinR,
      cy: orbit.cy + ex * sinR + ey * cosR,
    }
  })

  return (
    <G>
      <AnimatedCircle animatedProps={props} r={3} fill="#F5EDE7" opacity={0.25} />
      <AnimatedCircle animatedProps={props} r={1.4} fill="#FFFFFF" opacity={0.9} />
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
    aspectRatio: 1,
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
