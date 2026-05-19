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
  G,
  Line,
  Path,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import type { ZodiacSign } from '@/features/tabs/zodiac'
import { colors, typography } from '@/theme'

import type { DiaSemana } from '../mock'
import { Cosmos } from './Cosmos'
import { zodiacGlyphPaths } from './ZodiacGlyph'

/*
 * The Semana hero — your week as a SPIRAL unwinding from you. Día is a
 * snapshot (a closed system); Semana is time (a path with a start and
 * an end). Monday begins close to the core; the spiral opens outward
 * day by day. Same core "tú", same cosmos, same tilt as the Día
 * diagram — but a spiral, not closed orbits, so the two read as
 * siblings yet never the same screen.
 *
 * The spiral expresses the present. The full week is always mapped as
 * a faint path; the stretch you have lived (Monday → today) burns
 * over it as a bright trail; today is the comet head — the brightest,
 * ringed node where the live trail ends; the days still to come are
 * hollow stations, unlit, waiting further out.
 */

const W = 372
const CX = W / 2
const CY = W / 2
const TILT = 0.62 // same plane tilt as the Día diagram
const HIT = 56
const SUN_R = 30

// Spiral: Monday at THETA0 / R0, opening SWEEP° out to R1 by Sunday.
// Just under a full turn, so the path opens cleanly and never crosses
// itself — a week unwinding, not a coil. R0 clears the core so the
// early days never crowd it.
const THETA0 = 115
const SWEEP = 335
const R0 = 92
const R1 = 160

const AnimatedG = Animated.createAnimatedComponent(G)

function lerpHex(a: string, b: string, t: number): string {
  const ca = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)]
  const cb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)]
  const m = (i: number) => Math.round(ca[i]! + (cb[i]! - ca[i]!) * t)
  return `rgb(${m(0)},${m(1)},${m(2)})`
}
const nodeBody = (b: number) => lerpHex('#3A2440', '#F0608E', b)
const nodeShadow = (b: number) => lerpHex('#150C18', '#5E173A', b)

type Pos = { x: number; y: number; depth: number }

/** A point on the tilted week-spiral; s ∈ 0 (Monday) … 1 (today). */
function spiral(s: number): Pos {
  const theta = ((THETA0 + s * SWEEP) * Math.PI) / 180
  const r = R0 + s * (R1 - R0)
  const depth = Math.sin(theta)
  return { x: CX + Math.cos(theta) * r, y: CY + depth * r * TILT, depth }
}

const TRAIL_SAMPLES = 46
const LIVED_SEGMENTS = 24

export function WeekRing({
  days,
  sign,
  selectedIdx,
  onSelect,
}: {
  days: readonly DiaSemana[]
  /** The user's zodiac sign — the sigil at the core. */
  sign: ZodiacSign
  selectedIdx: number | null
  onSelect: (i: number) => void
}) {
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

  const popT = useSharedValue(0)
  useEffect(() => {
    if (selectedIdx == null) return
    popT.value = 0
    popT.value = withSequence(
      withTiming(1, { duration: 230, easing: Easing.out(Easing.back(2.4)) }),
      withTiming(0, { duration: 500, easing: Easing.inOut(Easing.cubic) }),
    )
  }, [selectedIdx, popT])

  const last = days.length - 1
  const todayIdx = days.findIndex((d) => d.today)
  const todayAt = todayIdx < 0 ? last : todayIdx
  const sToday = last > 0 ? todayAt / last : 0
  const placed = days.map((d, i) => ({ d, i, pos: spiral(i / last) }))
  const back = placed.filter((p) => p.pos.depth < 0).sort((a, b) => a.pos.y - b.pos.y)
  const front = placed.filter((p) => p.pos.depth >= 0).sort((a, b) => a.pos.y - b.pos.y)

  // The smooth spiral, as a sampled path for the soft glow underlay.
  let glowPath = ''
  for (let j = 0; j < TRAIL_SAMPLES; j++) {
    const p = spiral(j / (TRAIL_SAMPLES - 1))
    glowPath += `${j === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 0 ${W} ${W}`} style={styles.svg}>
        <Defs>
          <RadialGradient id="week-self" cx="38%" cy="33%" r="78%">
            <Stop offset="0%" stopColor="#E07BA0" />
            <Stop offset="48%" stopColor="#8A2150" />
            <Stop offset="100%" stopColor="#330A1E" />
          </RadialGradient>
        </Defs>

        <Cosmos t={t} drift={drift} />

        {/* The whole week stays mapped as a faint path; the lived
            stretch — Monday to today — burns over it, brightening
            toward today, the comet head. */}
        <Path d={glowPath} fill="none" stroke={colors.magenta} strokeWidth={5} opacity={0.09} />
        {Array.from({ length: LIVED_SEGMENTS }).map((_, j) => {
          const a = spiral((j / LIVED_SEGMENTS) * sToday)
          const b = spiral(((j + 1) / LIVED_SEGMENTS) * sToday)
          const mid = (j + 0.5) / LIVED_SEGMENTS
          return (
            <Line
              key={`tr-${j}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={colors.magenta}
              strokeOpacity={0.14 + mid * 0.5}
              strokeWidth={1.7}
              strokeLinecap="round"
            />
          )
        })}

        {back.map((p) => renderNode(p, todayAt, selectedIdx, t, popT))}

        <Core sign={sign} t={t} />

        {front.map((p) => renderNode(p, todayAt, selectedIdx, t, popT))}
      </Svg>

      {placed.map(({ d, i, pos }) => (
        <Pressable
          key={i}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {})
            onSelect(i)
          }}
          style={[styles.hit, { left: `${(pos.x / W) * 100}%`, top: `${(pos.y / W) * 100}%` }]}
          accessibilityRole="button"
          accessibilityState={{ selected: i === selectedIdx }}
          accessibilityLabel={d.label}
        />
      ))}
    </View>
  )
}

/* The core — "tú": the same glowing sun-orb as the Día diagram, the
 * family link between the two segments. Marked with your zodiac sigil;
 * no name — the centre is felt by composition, not labelled. */
function Core({ sign, t }: { sign: ZodiacSign; t: SharedValue<number> }) {
  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin(t.value * 2 * Math.PI)
    const scale = 1 + wave * 0.05
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
      <Circle cx={CX} cy={CY} r={52} fill={colors.magenta} opacity={0.07} />
      <Circle cx={CX} cy={CY} r={38} fill={colors.magenta} opacity={0.12} />
      <Circle cx={CX} cy={CY} r={SUN_R} fill="url(#week-self)" />
      <Circle
        cx={CX - SUN_R * 0.32}
        cy={CY - SUN_R * 0.36}
        r={SUN_R * 0.26}
        fill="#FFFFFF"
        opacity={0.38}
      />
      {/* The zodiac sigil, hand-drawn, centred in the orb. */}
      <G
        transform={`translate(${CX - 10.3} ${CY - 10.3}) scale(0.86)`}
        stroke="#E7BFCE"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {zodiacGlyphPaths(sign)}
      </G>
    </AnimatedG>
  )
}

/* One day on the spiral — a bead of light, brighter the better the
 * day went. Lighter than a Día planet: days are moments on a path,
 * not bodies. Today (and the selected day) wear a ring. */
function DayNode({
  day,
  pos,
  index,
  t,
  popT,
  selected,
  faded,
}: {
  day: DiaSemana
  pos: Pos
  index: number
  t: SharedValue<number>
  popT: SharedValue<number>
  selected: boolean
  faded: boolean
}) {
  const { x, y } = pos
  const b = day.brightness
  // Today is the head of the comet — a touch larger at rest.
  const R = (9 + b * 7) * (day.today ? 1.16 : 1)
  const phase = (index * 0.16) % 1
  const ring = selected || day.today

  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    let scale = 1 + wave * 0.06
    if (selected) scale *= 1 + popT.value * 0.46
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
    <G opacity={faded ? 0.4 : 1}>
      <AnimatedG animatedProps={breath}>
        <Circle
          cx={x}
          cy={y}
          r={R * 1.95}
          fill={colors.magenta}
          opacity={day.today ? 0.3 : b * 0.13}
        />
        <Circle
          cx={x}
          cy={y}
          r={R * 1.34}
          fill={colors.magenta}
          opacity={day.today ? 0.46 : b * 0.22}
        />
        {ring ? (
          <Circle
            cx={x}
            cy={y}
            r={R + 5}
            fill="none"
            stroke="#F4ECDE"
            strokeWidth={selected ? 1.5 : 1}
            opacity={selected ? 0.95 : 0.5}
          />
        ) : null}
        <Circle cx={x} cy={y} r={R} fill={nodeShadow(b)} />
        <Circle cx={x - R * 0.12} cy={y - R * 0.14} r={R * 0.86} fill={nodeBody(b)} />
        <Circle
          cx={x - R * 0.32}
          cy={y - R * 0.34}
          r={R * 0.3}
          fill="#FFFFFF"
          opacity={0.12 + b * 0.32}
        />
        <SvgText
          x={x}
          y={y + 3.6}
          textAnchor="middle"
          fontFamily={typography.uiBold}
          fontSize={10}
          fill="#FBF2E6"
          opacity={0.5 + b * 0.5}
        >
          {day.label}
        </SvgText>
      </AnimatedG>
    </G>
  )
}

/* A day still to come — a hollow station on the path, unlit. The week
 * is mapped, but you have not reached this point yet. */
function FutureNode({ day, pos, faded }: { day: DiaSemana; pos: Pos; faded: boolean }) {
  const { x, y } = pos
  const R = 9
  return (
    <G opacity={faded ? 0.55 : 1}>
      <Circle cx={x} cy={y} r={R} fill={colors.bg} opacity={0.7} />
      <Circle cx={x} cy={y} r={R} fill="none" stroke={colors.bruma} strokeWidth={1.4} />
      <SvgText
        x={x}
        y={y + 3.4}
        textAnchor="middle"
        fontFamily={typography.uiBold}
        fontSize={9.5}
        fill={colors.niebla}
        opacity={0.55}
      >
        {day.label}
      </SvgText>
    </G>
  )
}

type Placed = { d: DiaSemana; i: number; pos: Pos }

/* Picks the node for a day: lived days (Monday → today) are lit beads;
 * the days past today are hollow future stations. */
function renderNode(
  p: Placed,
  todayAt: number,
  selectedIdx: number | null,
  t: SharedValue<number>,
  popT: SharedValue<number>,
) {
  const faded = selectedIdx != null && p.i !== selectedIdx
  if (p.i > todayAt) {
    return <FutureNode key={p.i} day={p.d} pos={p.pos} faded={faded} />
  }
  return (
    <DayNode
      key={p.i}
      day={p.d}
      pos={p.pos}
      index={p.i}
      t={t}
      popT={popT}
      selected={p.i === selectedIdx}
      faded={faded}
    />
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
