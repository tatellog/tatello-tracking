import * as Haptics from 'expo-haptics'
import { useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import { colors, typography } from '@/theme'

import { Cosmos } from './Cosmos'

/** A satellite slot in the hero — agnostic to whether it represents
 *  a confirmed pattern (mature view) or a first-cycle observation.
 *  The parent (MesSegment) decides what it carries and how taps
 *  route. `tentative` dims the visual + flags the satellite as
 *  hypothesis-in-formation. `selected` adds a cream ring so the
 *  user sees which one corresponds to the current readout. */
export type Satellite = {
  id: string
  label: string
  tentative?: boolean
  selected?: boolean
}

/*
 * The Mes hero — "Tu Cielo": a Gargantua-style black hole.
 *
 * The cycle is rendered as an accretion disk seen near edge-on: a
 * thin band of light passes in front of the void below, and the
 * back-half of the disk — bent by gravitational lensing — arches
 * up over the top of the void as a wider, taller halo. The four
 * pattern satellites float above and below the disk plane, in
 * inclined orbits around the central mass.
 *
 * The 28 day-dots scatter along the two visible arcs (front + lensed
 * back) instead of forming a flat ring — that's what sells the
 * "black hole" reading. The current phase (lutea band) glows
 * brighter on whichever arc its days fall on; today sits at the
 * left edge of the disk where the math projects it as the brightest
 * point (the Doppler beaming sweet spot) and wears a vertical
 * spike for extra signal.
 *
 * Motion layers, none synced:
 *  1. Photon ring around the void breathes (5 s).
 *  2. Today's day-dot pulses with the photon ring.
 *  3. Left/right Doppler streaks fade up and down with their own clock.
 *  4. Each satellite breathes on its own phase.
 */

const W = 372
const CX = W / 2
const CY = W / 2
const RX = 142 // disk's horizontal half-extent
// Layers from outer-soft to inner-sharp. The back is dramatically
// taller than the front — that asymmetry is the gravitational
// lensing signature. A near-flat front + a towering arched back is
// what makes the eye read "Gargantua" instead of "ellipse".
const RY_FRONT = [16, 10, 5] as const
const RY_BACK = [88, 65, 44] as const
const EH = 26 // event horizon radius
const PHOTON_BASE = EH * 1.08
const EINSTEIN_R = EH * 1.55 // outer Einstein ring — second halo of light
const DISK_TILT_DEG = -8 // breaks the perfect horizontal symmetry
const HIT = 56 // satellite tap-target box

/** Deterministic 1-D PRNG — same seed → same streaks every render. */
function rand(seed: number, i: number): number {
  const s = Math.sin(seed * 9301 + i * 49297) * 233280
  return s - Math.floor(s)
}

/** Where day i sits on the projected disk. Day 1 starts at the top
 *  of the back arc; days advance clockwise around the ring (8 → right
 *  edge-on, 15 → front bottom, 22 → left edge-on, 28 → back near top). */
function dayPos(i: number): { x: number; y: number; back: boolean; sinAbs: number } {
  const theta = Math.PI / 2 - ((i - 1) * 2 * Math.PI) / 28
  const c = Math.cos(theta)
  const sn = Math.sin(theta)
  const x = CX + RX * c
  if (sn > 0) {
    // back / lensed half — use the middle back layer's ry for placement
    return { x, y: CY - RY_BACK[1] * sn, back: true, sinAbs: Math.abs(sn) }
  }
  return { x, y: CY + RY_FRONT[1] * -sn, back: false, sinAbs: Math.abs(sn) }
}

const DAYS: readonly { day: number; x: number; y: number; back: boolean }[] = Array.from(
  { length: 28 },
  (_, i) => {
    const p = dayPos(i + 1)
    return { day: i + 1, x: p.x, y: p.y, back: p.back }
  },
)

/** Precomputed Doppler streaks — short bright lines emanating from
 *  the disk's edge-on points (left and right). Built once at module
 *  scope so the layout is stable. */
type Streak = { x1: number; y1: number; x2: number; y2: number; op: number }
const STREAKS: readonly Streak[] = (() => {
  const out: Streak[] = []
  for (const sign of [-1, 1] as const) {
    const edgeX = CX + sign * RX
    for (let i = 0; i < 9; i++) {
      const len = 22 + rand(7 + sign, i) * 42
      const angJitter = (rand(8 + sign, i) - 0.5) * 0.18
      const ex = edgeX + sign * len * Math.cos(angJitter)
      const ey = CY + (rand(9 + sign, i) - 0.5) * 18
      out.push({
        x1: edgeX,
        y1: CY,
        x2: ex,
        y2: ey,
        op: 0.22 + rand(10 + sign, i) * 0.36,
      })
    }
  }
  return out
})()

type Dust = { x: number; y: number; r: number; opacity: number; fill: string }

/** Disk dust — hundreds of fine particles scattered along the back
 *  and front arc paths. The disk gains real volumetric density,
 *  carrying the visual weight that the 3 stroke layers alone
 *  couldn't. Distributed deterministically. */
function buildDiskDust(
  seedBase: number,
  ryRange: readonly [number, number],
  side: 'back' | 'front',
  count: number,
): Dust[] {
  const out: Dust[] = []
  for (let i = 0; i < count; i++) {
    // Bias theta away from the very top/bottom (where the lensed
    // arc peaks) so the texture concentrates around the brighter
    // mid-arc zones.
    const theta = rand(seedBase, i) * Math.PI
    const ryNorm = rand(seedBase + 1, i)
    const ry = ryRange[0] + ryNorm * (ryRange[1] - ryRange[0])
    const x = CX + RX * Math.cos(theta)
    const y = side === 'back' ? CY - ry * Math.sin(theta) : CY + ry * Math.sin(theta)
    const size = 0.35 + rand(seedBase + 2, i) * 0.9
    // Outer particles dim, inner sharp. Edges (theta near 0 or π)
    // get a brightness boost — that's where Doppler beaming lives.
    const edgeBoost = Math.pow(Math.abs(Math.cos(theta)), 2) * 0.4
    const opacity = (0.22 + rand(seedBase + 3, i) * 0.55 + edgeBoost) * (1 - ryNorm * 0.45)
    const tint = rand(seedBase + 4, i)
    const fill =
      tint > 0.93 ? '#9DB5D6' : tint > 0.87 ? '#D9B57A' : tint > 0.55 ? '#FBD7E3' : '#FCE5EE'
    out.push({ x, y, r: size, opacity, fill })
  }
  return out
}

const DUST_BACK: readonly Dust[] = buildDiskDust(11, [RY_BACK[2], RY_BACK[0]], 'back', 140)
const DUST_FRONT: readonly Dust[] = buildDiskDust(21, [RY_FRONT[2], RY_FRONT[0]], 'front', 110)

/** Doppler hotspots — clustered bright particles at the edge-on
 *  tips. Make the brightest visual points feel like solar flares,
 *  not flat ellipse endpoints. */
const HOTSPOTS: readonly Dust[] = (() => {
  const out: Dust[] = []
  for (const sign of [-1, 1] as const) {
    for (let i = 0; i < 22; i++) {
      const r2 = rand(40 + sign * 3, i)
      const ang = rand(41 + sign * 3, i) * 2 * Math.PI
      // Cluster radius — tight near the edge, spreading horizontally.
      const dist = r2 * 11
      const x = CX + sign * RX + Math.cos(ang) * dist * 1.6
      const y = CY + Math.sin(ang) * dist * 0.6
      const size = 0.5 + rand(42 + sign * 3, i) * 1.0
      const opacity = 0.4 + rand(43 + sign * 3, i) * 0.55
      out.push({ x, y, r: size, opacity, fill: '#FFFFFF' })
    }
  }
  return out
})()

/** Nebular dust — sparse cloud particles in a wide field around
 *  the BH, mostly above and below the disk plane. Multi-tint so the
 *  field reads as cosmic dust, not a monochrome speckle. */
const NEBULA: readonly Dust[] = (() => {
  const out: Dust[] = []
  for (let i = 0; i < 110; i++) {
    const ang = rand(50, i) * 2 * Math.PI
    const dist = 55 + rand(51, i) * 130
    const x = CX + Math.cos(ang) * dist
    const y = CY + Math.sin(ang) * dist
    // Skip particles too close to the disk plane line — they'd
    // muddle the disk's silhouette.
    if (Math.abs(y - CY) < 18) continue
    const size = 0.35 + rand(52, i) * 1.2
    const opacity = (0.14 + rand(53, i) * 0.32) * (1 - dist / 220)
    const tint = rand(54, i)
    const fill =
      tint > 0.93 ? '#9DB5D6' : tint > 0.87 ? '#D9B57A' : tint > 0.55 ? '#FBD7E3' : '#F4ECDE'
    out.push({ x, y, r: size, opacity, fill })
  }
  return out
})()

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Satellite positions — four corners, off-cardinal, so the four
 *  patterns float above and below the disk plane like bodies in
 *  inclined orbits. */
const SAT_POS: readonly { x: number; y: number }[] = [
  { x: CX - 100, y: CY - 95 },
  { x: CX + 100, y: CY - 80 },
  { x: CX + 115, y: CY + 82 },
  { x: CX - 110, y: CY + 92 },
]

export function TuCielo({
  ciclo,
  satellites,
  onSatellitePress,
}: {
  ciclo: {
    day: number
    length: number
    band: readonly [number, number]
  }
  satellites: readonly Satellite[]
  /** When omitted the satellites render decoratively (no tap
   *  targets). First cycle uses this — observations are
   *  informational, not navigable. */
  onSatellitePress?: (id: string) => void
}) {
  const t = useSharedValue(0) // 5 s — photon ring, today's pulse, jet
  const drift = useSharedValue(0) // 44 s — nebula starfield drift
  const streakClock = useSharedValue(0) // 8 s — Doppler streak pulse
  const cometClock1 = useSharedValue(0) // 13 s — first comet orbit
  const cometClock2 = useSharedValue(0) // 17 s — second comet orbit
  const dustFlicker = useSharedValue(0) // 9 s — disk turbulence flicker
  const nebDrift = useSharedValue(0) // 45 s — nebula slow rotation

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 5000, easing: Easing.linear }), -1, false)
    drift.value = withRepeat(withTiming(1, { duration: 44000, easing: Easing.linear }), -1, false)
    streakClock.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    )
    cometClock1.value = withRepeat(
      withTiming(1, { duration: 13000, easing: Easing.linear }),
      -1,
      false,
    )
    cometClock2.value = withRepeat(
      withTiming(1, { duration: 17000, easing: Easing.linear }),
      -1,
      false,
    )
    dustFlicker.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
      false,
    )
    nebDrift.value = withRepeat(
      withTiming(1, { duration: 45000, easing: Easing.linear }),
      -1,
      false,
    )
    return () => {
      cancelAnimation(t)
      cancelAnimation(drift)
      cancelAnimation(streakClock)
      cancelAnimation(cometClock1)
      cancelAnimation(cometClock2)
      cancelAnimation(dustFlicker)
      cancelAnimation(nebDrift)
    }
  }, [t, drift, streakClock, cometClock1, cometClock2, dustFlicker, nebDrift])

  const photonProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    return {
      r: PHOTON_BASE + wave * 1.4,
      opacity: 0.78 + wave * 0.18,
    }
  })

  const streaksProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(streakClock.value * 2 * Math.PI)
    return { opacity: 0.55 + wave * 0.4 }
  })

  // Jet — wide soft bloom + bright core. Pulse with the photon ring
  // (same 5 s clock) so the centre breathes as one body.
  const jetProps = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    return { opacity: 0.78 + wave * 0.22 }
  })

  // Disk dust flicker — back and front go out of phase so when one
  // dims the other brightens. Reads as turbulence in the disk.
  const dustBackFlicker = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(dustFlicker.value * 2 * Math.PI)
    return { opacity: 0.78 + wave * 0.22 }
  })
  const dustFrontFlicker = useAnimatedProps(() => {
    'worklet'
    // Half-period offset → opposite phase from back.
    const wave = 0.5 + 0.5 * Math.sin((dustFlicker.value + 0.5) * 2 * Math.PI)
    return { opacity: 0.78 + wave * 0.22 }
  })

  // Nebula slow rotation — the field of background dust drifts
  // around the BH at ~45 s per revolution. Sells "everything orbits
  // this thing" without ever calling attention to itself.
  const nebProps = useAnimatedProps(() => {
    'worklet'
    const deg = nebDrift.value * 360
    return {
      transform: [
        { translateX: CX },
        { translateY: CY },
        { rotate: `${deg}deg` },
        { translateX: -CX },
        { translateY: -CY },
      ],
    }
  })

  // Bind the first four satellites to the four positions.
  const sats = satellites.slice(0, SAT_POS.length).map((sat, i) => ({
    ...sat,
    x: SAT_POS[i]!.x,
    y: SAT_POS[i]!.y,
    breathPhase: (i * 0.27) % 1,
  }))

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 0 ${W} ${W}`} style={styles.svg}>
        <Defs>
          {/* Disk-arc strokes — bright cream at the edge-on points
              (left/right), softer rosa in the middle. The brightness
              peak at the edges sells the Doppler beaming effect. */}
          <LinearGradient
            id="mc-front"
            gradientUnits="userSpaceOnUse"
            x1={CX - RX}
            y1={CY}
            x2={CX + RX}
            y2={CY}
          >
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
            <Stop offset="12%" stopColor="#FCE5EE" stopOpacity={0.9} />
            <Stop offset="35%" stopColor="#F4ABC8" stopOpacity={0.55} />
            <Stop offset="65%" stopColor="#F4ABC8" stopOpacity={0.55} />
            <Stop offset="88%" stopColor="#FCE5EE" stopOpacity={0.9} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={1} />
          </LinearGradient>
          <LinearGradient
            id="mc-back"
            gradientUnits="userSpaceOnUse"
            x1={CX - RX}
            y1={CY}
            x2={CX + RX}
            y2={CY}
          >
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="15%" stopColor="#FCE5EE" stopOpacity={0.7} />
            <Stop offset="40%" stopColor={colors.magenta} stopOpacity={0.55} />
            <Stop offset="60%" stopColor={colors.magenta} stopOpacity={0.55} />
            <Stop offset="85%" stopColor="#FCE5EE" stopOpacity={0.7} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0.9} />
          </LinearGradient>
          <RadialGradient id="mc-void" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor="#000000" />
            <Stop offset="65%" stopColor="#000000" />
            <Stop offset="92%" stopColor="#1A0410" />
            <Stop offset="100%" stopColor="#5A1430" />
          </RadialGradient>
          <RadialGradient id="mc-photon" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="35%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor={colors.magenta} />
          </RadialGradient>
          {/* Vertical jet — perpendicular to the disk plane. Bright
              cream at centre, fading to transparency at top/bottom
              so it reads as light emerging from the BH, not a
              full-height line. */}
          <LinearGradient id="mc-jet" gradientUnits="userSpaceOnUse" x1={CX} y1={0} x2={CX} y2={W}>
            <Stop offset="0%" stopColor="#FBD7E3" stopOpacity={0} />
            <Stop offset="30%" stopColor="#FBD7E3" stopOpacity={0.35} />
            <Stop offset="48%" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="52%" stopColor="#FFFFFF" stopOpacity={0.95} />
            <Stop offset="70%" stopColor="#FBD7E3" stopOpacity={0.35} />
            <Stop offset="100%" stopColor="#FBD7E3" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Cosmos t={t} drift={drift} />

        {/* Outer magenta haze around the BH — gives volumetric depth
            so the disk doesn't sit on a flat black void. */}
        {Array.from({ length: 10 }).map((_, i) => (
          <Circle
            key={`mc-haze-${i}`}
            cx={CX}
            cy={CY}
            r={140 - i * 12}
            fill={colors.magenta}
            opacity={0.014 + i * 0.005}
          />
        ))}

        {/* Nebular dust — sparse cosmic particles above and below
            the disk plane. Multi-tint (cream / blue / gold) so the
            field reads painterly, not monochrome. Wrapped in an
            AnimatedG that rotates the whole nebula slowly around
            the BH — the field drifts as one body. */}
        <AnimatedG animatedProps={nebProps}>
          {NEBULA.map((p, i) => (
            <Circle
              key={`mc-neb-${i}`}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={p.fill}
              opacity={p.opacity}
            />
          ))}
        </AnimatedG>

        {/* Vertical jet — perpendicular to the disk plane. Three
            stacked lines (wide soft → mid → sharp) give the beam
            volume; the linearGradient fades it to transparency at
            top/bottom so the BH centre reads as the source. Sits
            inside the tilt group so it tilts with the disk; the
            inner AnimatedG pulses opacity with the photon ring. */}
        <G transform={`rotate(${DISK_TILT_DEG} ${CX} ${CY})`}>
          <AnimatedG animatedProps={jetProps}>
            <Line
              x1={CX}
              y1={0}
              x2={CX}
              y2={W}
              stroke="url(#mc-jet)"
              strokeWidth={14}
              opacity={0.18}
            />
            <Line
              x1={CX}
              y1={0}
              x2={CX}
              y2={W}
              stroke="url(#mc-jet)"
              strokeWidth={5}
              opacity={0.4}
            />
            <Line
              x1={CX}
              y1={0}
              x2={CX}
              y2={W}
              stroke="url(#mc-jet)"
              strokeWidth={1.2}
              opacity={0.85}
            />
          </AnimatedG>
        </G>

        {/* BACK-HALF group — rotated -8° so the disk doesn't lock
            into a perfect horizontal symmetry. Contains the lensed
            arc, its day-specks and the Doppler streaks emerging
            from the disk's edge-on tips. Drawn BEFORE the void so
            the back content can be partially occluded by it. */}
        <G transform={`rotate(${DISK_TILT_DEG} ${CX} ${CY})`}>
          {/* Lensed back arc — three layers, outer-soft to inner-sharp.
              ry tops out at 88, so the arc towers ~62 px above the
              void's edge. That gap is the Gargantua signature. */}
          {RY_BACK.map((ry, i) => (
            <Path
              key={`mc-back-${i}`}
              d={`M ${CX - RX} ${CY} A ${RX} ${ry} 0 0 0 ${CX + RX} ${CY}`}
              fill="none"
              stroke="url(#mc-back)"
              strokeOpacity={[0.22, 0.6, 0.95][i]}
              strokeWidth={[3.0, 1.4, 0.55][i]}
            />
          ))}
          {/* Disk dust on the back — fine particles scattered along
              the lensed arc. Wrapped in an AnimatedG that flickers
              opacity out of phase with the front dust → reads as
              turbulence in the accretion flow. */}
          <AnimatedG animatedProps={dustBackFlicker}>
            {DUST_BACK.map((p, i) => (
              <Circle
                key={`mc-db-${i}`}
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={p.fill}
                opacity={p.opacity}
              />
            ))}
          </AnimatedG>
          {/* Travelling comets — bright destellos orbiting the BH
              on the 3D ring, projected via lensing. Only render
              when sin(θ) > 0 (on the back half); the front copy
              picks up the rest. Two clocks at relatively prime
              periods so the destellos never sync. */}
          <DiskComet clock={cometClock1} phase={0} half="back" />
          <DiskComet clock={cometClock2} phase={0.5} half="back" />
          {/* Day-specks on the back arc. */}
          {DAYS.filter((d) => d.back).map((d) => (
            <DaySpeck key={`bk-${d.day}`} day={d} ciclo={ciclo} clock={t} />
          ))}
          {/* Doppler streaks — bright lines emanating from the
              edge-on tips. Pulse together. */}
          <AnimatedG animatedProps={streaksProps}>
            {STREAKS.map((s, i) => (
              <Line
                key={`mc-streak-${i}`}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke="#FCE5EE"
                strokeOpacity={s.op}
                strokeWidth={0.65}
                strokeLinecap="round"
              />
            ))}
            {/* Doppler hotspot clusters — concentrated bright
                particles at the edge-on tips. Solar-flare feel. */}
            {HOTSPOTS.map((p, i) => (
              <Circle
                key={`mc-hot-${i}`}
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={p.fill}
                opacity={p.opacity}
              />
            ))}
          </AnimatedG>
        </G>

        {/* EVENT HORIZON — perfect black void with subtle magenta
            tint at its very edge (lit by the surrounding plasma).
            Stays axis-aligned: the BH is radially symmetric. */}
        <Circle cx={CX} cy={CY} r={EH} fill="url(#mc-void)" />
        {/* Inner darkness ring — gives the void a hint of depth, as
            if the eye is looking INTO a hole rather than at a disc. */}
        <Circle
          cx={CX}
          cy={CY}
          r={EH * 0.86}
          fill="none"
          stroke="#000000"
          strokeWidth={2}
          opacity={0.8}
        />
        {/* Photon ring — bright hot edge of the void. Breathes. */}
        <AnimatedCircle
          cx={CX}
          cy={CY}
          fill="none"
          stroke="url(#mc-photon)"
          strokeWidth={1.6}
          animatedProps={photonProps}
        />
        {/* Einstein ring — second, fainter halo at ~1.55× EH. The
            quiet glow of light from far-away stars bent around the
            void. Reads as 3D depth, not a flat circle outline. */}
        <Circle
          cx={CX}
          cy={CY}
          r={EINSTEIN_R}
          fill="none"
          stroke="#FBD7E3"
          strokeWidth={0.5}
          opacity={0.38}
        />

        {/* FRONT-HALF group — same tilt so it lines up with the back
            arc edge-on points. Drawn AFTER the void, on top. */}
        <G transform={`rotate(${DISK_TILT_DEG} ${CX} ${CY})`}>
          {/* Front arc — much flatter than the back. Three layers. */}
          {RY_FRONT.map((ry, i) => (
            <Path
              key={`mc-front-${i}`}
              d={`M ${CX - RX} ${CY} A ${RX} ${ry} 0 0 1 ${CX + RX} ${CY}`}
              fill="none"
              stroke="url(#mc-front)"
              strokeOpacity={[0.24, 0.65, 0.95][i]}
              strokeWidth={[2.4, 1.2, 0.5][i]}
            />
          ))}
          {/* Disk dust on the front — fine particles along the
              front arc. Flickers out of phase with the back dust. */}
          <AnimatedG animatedProps={dustFrontFlicker}>
            {DUST_FRONT.map((p, i) => (
              <Circle
                key={`mc-df-${i}`}
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill={p.fill}
                opacity={p.opacity}
              />
            ))}
          </AnimatedG>
          {/* The two comets' front halves — when each crosses sin(θ)
              ≤ 0, this copy lights up instead of the back one. */}
          <DiskComet clock={cometClock1} phase={0} half="front" />
          <DiskComet clock={cometClock2} phase={0.5} half="front" />
          {/* Day-specks on the front arc. */}
          {DAYS.filter((d) => !d.back).map((d) => (
            <DaySpeck key={`fr-${d.day}`} day={d} ciclo={ciclo} clock={t} />
          ))}
        </G>

        {/* Satellites — connector + body + label. Tentative ones
            render dimmer; visual difference signals "this isn't
            confirmed yet" without needing extra UI affordance. */}
        {sats.map((sat) => {
          const dx = sat.x - CX
          const dy = sat.y - CY
          const dist = Math.hypot(dx, dy) || 1
          const lx = sat.x + (dx / dist) * 22
          const ly = sat.y + (dy / dist) * 22 + 3
          return (
            <G key={sat.id}>
              <SatBody
                x={sat.x}
                y={sat.y}
                clock={t}
                phase={sat.breathPhase}
                tentative={sat.tentative}
                selected={sat.selected}
              />
              <SvgText
                x={lx}
                y={ly}
                textAnchor="middle"
                fontFamily={typography.uiBold}
                fontSize={9.5}
                letterSpacing={1.2}
                fill="#F4ECDE"
                opacity={sat.tentative ? 0.6 : 0.85}
              >
                {sat.label}
              </SvgText>
            </G>
          )
        })}
      </Svg>

      {/* Tap targets — rendered only when the parent provides a
          press handler. First cycle omits this: observations are
          informational, not navigable. */}
      {onSatellitePress
        ? sats.map((sat) => (
            <Pressable
              key={sat.id}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {})
                onSatellitePress(sat.id)
              }}
              style={[styles.hit, { left: `${(sat.x / W) * 100}%`, top: `${(sat.y / W) * 100}%` }]}
              accessibilityRole="button"
              accessibilityLabel={sat.label}
            />
          ))
        : null}
    </View>
  )
}

/* A single day on the projected disk. Today wears a brighter body,
 * a selection crown and a vertical spike; days inside the lutea
 * band glow magenta; the rest are quiet cream specks. */
function DaySpeck({
  day,
  ciclo,
  clock,
}: {
  day: { day: number; x: number; y: number; back: boolean }
  ciclo: { day: number; band: readonly [number, number] }
  clock: SharedValue<number>
}) {
  const isToday = day.day === ciclo.day
  const inBand = day.day >= ciclo.band[0] && day.day <= ciclo.band[1]
  const R = isToday ? 3.4 : inBand ? 2.6 : 1.5

  const breath = useAnimatedProps(() => {
    'worklet'
    if (!isToday) return { transform: [{ scale: 1 }] }
    const wave = 0.5 + 0.5 * Math.sin(clock.value * 2 * Math.PI)
    const scale = 1 + wave * 0.18
    return {
      transform: [
        { translateX: day.x },
        { translateY: day.y },
        { scale },
        { translateX: -day.x },
        { translateY: -day.y },
      ],
    }
  })

  return (
    <AnimatedG animatedProps={breath}>
      <Circle
        cx={day.x}
        cy={day.y}
        r={R * 2.6}
        fill={colors.magenta}
        opacity={isToday ? 0.5 : inBand ? 0.35 : 0.1}
      />
      <Circle
        cx={day.x}
        cy={day.y}
        r={R}
        fill={isToday ? '#FFFFFF' : inBand ? '#F4ABC8' : '#F4ECDE'}
        opacity={isToday ? 1 : inBand ? 0.95 : 0.55}
      />
      {isToday ? (
        <>
          {/* Selection crown */}
          <Circle
            cx={day.x}
            cy={day.y}
            r={R + 4}
            fill="none"
            stroke="#F4ECDE"
            strokeWidth={1.2}
            opacity={0.88}
          />
          {/* Vertical spike — extra signal: this dot is today */}
          <Line
            x1={day.x}
            y1={day.y - R * 4}
            x2={day.x}
            y2={day.y + R * 4}
            stroke="#FFFFFF"
            strokeOpacity={0.5}
            strokeWidth={0.5}
            strokeLinecap="round"
          />
        </>
      ) : (
        <Circle cx={day.x} cy={day.y} r={R * 0.4} fill="#FFFFFF" opacity={inBand ? 0.95 : 0.75} />
      )}
    </AnimatedG>
  )
}

/* A bright destello travelling around the BH on the conceptual 3D
 * ring. Projected via the same lensing geometry as the day-specks:
 * back half goes high above the void (RY_BACK), front half slides
 * flat below (RY_FRONT). Each comet renders TWO instances — one
 * inside the back tilt group, one inside the front; each is only
 * visible during its own half of the orbit, so the void naturally
 * occludes the comet when it would be behind the BH.
 *
 * Brightness peaks at the edge-on tips (Doppler beaming) — the
 * comet flashes hottest as it crosses the disk's bright edges. */
function DiskComet({
  clock,
  phase,
  half,
}: {
  clock: SharedValue<number>
  phase: number
  half: 'back' | 'front'
}) {
  const bloomProps = useAnimatedProps(() => {
    'worklet'
    const angle = (clock.value + phase) * 2 * Math.PI
    const sn = Math.sin(angle)
    const onBack = sn > 0
    if ((half === 'back') !== onBack) return { opacity: 0, r: 0, cx: CX, cy: CY }
    const c = Math.cos(angle)
    const x = CX + RX * c
    const y = onBack ? CY - RY_BACK[1] * sn : CY + RY_FRONT[1] * -sn
    // Edge boost — concentrate brightness at the Doppler tips.
    const edge = Math.pow(Math.abs(c), 2.5)
    return {
      cx: x,
      cy: y,
      r: 3 + edge * 9,
      opacity: 0.08 + edge * 0.35,
    }
  })
  const glowProps = useAnimatedProps(() => {
    'worklet'
    const angle = (clock.value + phase) * 2 * Math.PI
    const sn = Math.sin(angle)
    const onBack = sn > 0
    if ((half === 'back') !== onBack) return { opacity: 0, r: 0, cx: CX, cy: CY }
    const c = Math.cos(angle)
    const x = CX + RX * c
    const y = onBack ? CY - RY_BACK[1] * sn : CY + RY_FRONT[1] * -sn
    const edge = Math.pow(Math.abs(c), 2.5)
    return {
      cx: x,
      cy: y,
      r: 1.6 + edge * 4.2,
      opacity: 0.2 + edge * 0.6,
    }
  })
  const coreProps = useAnimatedProps(() => {
    'worklet'
    const angle = (clock.value + phase) * 2 * Math.PI
    const sn = Math.sin(angle)
    const onBack = sn > 0
    if ((half === 'back') !== onBack) return { opacity: 0, r: 0, cx: CX, cy: CY }
    const c = Math.cos(angle)
    const x = CX + RX * c
    const y = onBack ? CY - RY_BACK[1] * sn : CY + RY_FRONT[1] * -sn
    const edge = Math.pow(Math.abs(c), 2.5)
    return {
      cx: x,
      cy: y,
      r: 0.6 + edge * 1.9,
      opacity: 0.55 + edge * 0.45,
    }
  })
  return (
    <G>
      <AnimatedCircle animatedProps={bloomProps} fill="#FBD7E3" />
      <AnimatedCircle animatedProps={glowProps} fill="#FCE5EE" />
      <AnimatedCircle animatedProps={coreProps} fill="#FFFFFF" />
    </G>
  )
}

/* A satellite body — pattern marker. Breathes on its own phase so
 * the four bodies feel independently alive. `tentative` dims the
 * whole stack (smaller body, less halo, paler core) so the
 * hypothesis-in-formation slot reads as quieter than the rest. */
function SatBody({
  x,
  y,
  clock,
  phase,
  tentative,
  selected,
}: {
  x: number
  y: number
  clock: SharedValue<number>
  phase: number
  tentative?: boolean
  selected?: boolean
}) {
  const R = tentative ? 4.4 : 5.5
  const fill = tentative ? '#FCE5EE' : '#F4ABC8'
  const haloOp = tentative ? 0.08 : 0.14
  const auraOp = tentative ? 0.12 : 0.2
  const coreOp = tentative ? 0.62 : 0.85
  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((clock.value * 0.5 + phase) * 2 * Math.PI)
    const scale = 1 + wave * (tentative ? 0.06 : 0.09)
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
    <AnimatedG animatedProps={breath}>
      <Circle cx={x} cy={y} r={R * 3} fill={fill} opacity={haloOp} />
      <Circle cx={x} cy={y} r={R * 1.8} fill="#FBD7E3" opacity={auraOp} />
      {selected ? (
        <Circle
          cx={x}
          cy={y}
          r={R + 4}
          fill="none"
          stroke="#F4ECDE"
          strokeWidth={1.2}
          opacity={0.9}
        />
      ) : null}
      <Circle cx={x} cy={y} r={R} fill={fill} />
      <Circle cx={x} cy={y} r={R * 0.42} fill="#FFFFFF" opacity={coreOp} />
    </AnimatedG>
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
