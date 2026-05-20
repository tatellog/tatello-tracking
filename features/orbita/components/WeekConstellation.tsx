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
import Svg, { Circle, Defs, G, Line, RadialGradient, Stop, Text as SvgText } from 'react-native-svg'

import { colors, typography } from '@/theme'

import type { DiaSemana } from '../mock'
import { Cosmos } from './Cosmos'

/*
 * The Semana hero — your week as a SPIRAL GALAXY. Two logarithmic
 * arms of dust drift around a magenta nucleus; the seven days trace
 * one arm from the core outward, so the path of the week is the
 * path of light into the unknown.
 *
 * Domingo sits closest to the core (the week's start, freshly
 * arrived); Sábado trails out at the rim (still uncharted). Past
 * days are luminous magenta bodies; days that haven't arrived are
 * tiny cream ghosts on the spiral path. Today wears the selection
 * crown by default.
 *
 * The dust arms rotate together once every ~90 s. The day bodies
 * stay anchored to the spiral — they're the constellation the
 * galaxy turns around, so tap-targets never drift away from where
 * the user's eye lands.
 */

const W = 372
const CX = W / 2
const CY = W / 2
const HIT = 56
const CORE_R = 16

// Logarithmic spiral: r = SPIRAL_A * exp(SPIRAL_B * t). Two arms,
// offset by π. Sized so the galaxy fills the canvas — Domingo lands
// outside the core's bright bloom, Sábado reaches the canvas edge,
// and the dust arms trail off past the frame for the open-galaxy
// feel.
const SPIRAL_A = 45
const SPIRAL_B = 0.22
const ARM_T_MAX = 8.0

// One t value per day along the spiral, inner → outer, in Sunday-
// first order. Hand-tuned so bodies sit at visually-even arc length.
const DAY_T: readonly number[] = [1.4, 2.5, 3.5, 4.3, 5.0, 5.6, 6.2]

function spiralPos(t: number, armOffset: number): { x: number; y: number } {
  const r = SPIRAL_A * Math.exp(SPIRAL_B * t)
  const ang = t + armOffset
  return { x: CX + r * Math.cos(ang), y: CY + r * Math.sin(ang) }
}

// Deterministic 1-D PRNG — same seed → same galaxy every render, so
// the composition is stable across hot reloads and re-mounts.
function rand(seed: number, i: number): number {
  const s = Math.sin(seed * 9301 + i * 49297) * 233280
  return s - Math.floor(s)
}

type Dust = { x: number; y: number; r: number; opacity: number; fill: string }

// Pre-computed dust for both arms. Built once at module scope so the
// 180-particle layout doesn't recompute on every render. Each arm
// scatters around the ideal spiral path with jitter that widens
// with radius — the same way real galactic arms thicken outward.
const DUST: readonly Dust[] = (() => {
  const out: Dust[] = []
  for (let arm = 0; arm < 2; arm++) {
    const offset = arm * Math.PI
    for (let i = 0; i < 130; i++) {
      const t = 0.2 + (i / 130) * ARM_T_MAX
      const p = spiralPos(t, offset)
      const ang = t + offset
      const radius = SPIRAL_A * Math.exp(SPIRAL_B * t)
      const j = (rand(arm * 10 + 3, i) - 0.5) * radius * 0.22
      const nx = -Math.sin(ang)
      const ny = Math.cos(ang)
      const x = p.x + nx * j
      const y = p.y + ny * j
      const sz = 0.5 + rand(arm * 10 + 5, i) * 1.0
      const op = (0.85 - Math.min(0.5, radius / 130)) * (0.45 + rand(arm * 10 + 7, i) * 0.55)
      // Mostly cream; rare warm/cool flecks (≈ 1 in 12) so the field
      // reads as starlight rather than monochrome dots.
      const tint = rand(arm, i)
      const fill = tint > 0.93 ? '#D9B57A' : tint > 0.88 ? '#9DB5D6' : '#F4ECDE'
      out.push({ x, y, r: sz, opacity: op, fill })
    }
  }
  return out
})()

// Static day positions — computed once. Tap-target Pressables use
// these regardless of the dust rotation underneath.
const DAY_POS: readonly { x: number; y: number }[] = DAY_T.map((t) => spiralPos(t, 0))

const AnimatedG = Animated.createAnimatedComponent(G)

export function WeekConstellation({
  days,
  selectedIdx,
  onSelect,
}: {
  days: readonly DiaSemana[]
  /** Always set — today is selected by default. */
  selectedIdx: number
  onSelect: (i: number) => void
}) {
  const t = useSharedValue(0)
  const drift = useSharedValue(0)
  const spin = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    drift.value = withRepeat(withTiming(1, { duration: 44000, easing: Easing.linear }), -1, false)
    spin.value = withRepeat(withTiming(1, { duration: 55000, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(t)
      cancelAnimation(drift)
      cancelAnimation(spin)
    }
  }, [t, drift, spin])

  const popT = useSharedValue(0)
  useEffect(() => {
    popT.value = 0
    popT.value = withSequence(
      withTiming(1, { duration: 230, easing: Easing.out(Easing.back(2.4)) }),
      withTiming(0, { duration: 500, easing: Easing.inOut(Easing.cubic) }),
    )
  }, [selectedIdx, popT])

  const todayIdx = days.findIndex((d) => d.today)
  // While the user is reading a non-today day, the rest of the week
  // dims so the chosen story stays in focus.
  const exploring = selectedIdx !== todayIdx

  // The whole dust group rotates as one body around the nucleus.
  const dustSpin = useAnimatedProps(() => {
    'worklet'
    const deg = spin.value * 360
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

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 0 ${W} ${W}`} style={styles.svg}>
        <Defs>
          <RadialGradient id="weekCore" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="30%" stopColor="#FBD7E3" />
            <Stop offset="75%" stopColor={colors.magenta} />
            <Stop offset="100%" stopColor="#5A0E2A" />
          </RadialGradient>
          <RadialGradient id="weekBody" cx="50%" cy="50%" r="55%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="40%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor={colors.magenta} />
          </RadialGradient>
        </Defs>

        <Cosmos t={t} drift={drift} />

        {/* Soft magenta nebula behind the spiral — gives depth
            without competing with the core's bloom. */}
        {Array.from({ length: 10 }).map((_, i) => (
          <Circle
            key={i}
            cx={CX}
            cy={CY}
            r={140 - i * 11}
            fill="#5A1438"
            opacity={0.018 + i * 0.004}
          />
        ))}

        {/* Two arms of dust, rotating together. */}
        <AnimatedG animatedProps={dustSpin}>
          {DUST.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.fill} opacity={p.opacity} />
          ))}
        </AnimatedG>

        <GalacticCore t={t} />

        {/* The seven days — past/today as luminous bodies, future as
            ghosts on the spiral. */}
        {days.map((d, i) => {
          const pos = DAY_POS[i]!
          const selected = i === selectedIdx
          const faded = exploring && !selected
          const future = todayIdx >= 0 && i > todayIdx
          if (future) {
            // proximity 1 = tomorrow (the next one approaching),
            // larger = farther into the week. Used by DayGhost to
            // brighten the closer-up days and whisper the far ones.
            const proximity = i - todayIdx
            return (
              <DayGhost
                key={i}
                day={d}
                pos={pos}
                proximity={proximity}
                selected={selected}
                faded={faded}
              />
            )
          }
          return (
            <DayBody
              key={i}
              day={d}
              pos={pos}
              isToday={d.today}
              t={t}
              popT={popT}
              selected={selected}
              faded={faded}
              phase={(i * 0.17) % 1}
            />
          )
        })}
      </Svg>

      {/* Tap targets — anchored to the static spiral positions.
          The dust rotates underneath; the days don't, so the user's
          finger always lands on what they see. */}
      {DAY_POS.map((pos, i) => (
        <Pressable
          key={i}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {})
            onSelect(i)
          }}
          style={[styles.hit, { left: `${(pos.x / W) * 100}%`, top: `${(pos.y / W) * 100}%` }]}
          accessibilityRole="button"
          accessibilityState={{ selected: i === selectedIdx }}
          accessibilityLabel={days[i]?.weekday ?? ''}
        />
      ))}
    </View>
  )
}

/* The galactic nucleus — white-hot core, layered magenta bloom, and
 * the single cardinal cross that marks it as the brightest object in
 * the field. The cross breathes with the core. */
function GalacticCore({ t }: { t: SharedValue<number> }) {
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

  const SPIKE_LEN = CORE_R * 4.5
  return (
    <AnimatedG animatedProps={breath}>
      <Circle cx={CX} cy={CY} r={CORE_R * 7} fill={colors.magenta} opacity={0.02} />
      <Circle cx={CX} cy={CY} r={CORE_R * 4.5} fill={colors.magenta} opacity={0.05} />
      <Circle cx={CX} cy={CY} r={CORE_R * 2.8} fill={colors.magenta} opacity={0.12} />
      <Circle cx={CX} cy={CY} r={CORE_R * 1.7} fill={colors.magenta} opacity={0.22} />
      <Line
        x1={CX - SPIKE_LEN}
        y1={CY}
        x2={CX + SPIKE_LEN}
        y2={CY}
        stroke="#FFFFFF"
        strokeOpacity={0.35}
        strokeWidth={0.7}
        strokeLinecap="round"
      />
      <Line
        x1={CX}
        y1={CY - SPIKE_LEN}
        x2={CX}
        y2={CY + SPIKE_LEN}
        stroke="#FFFFFF"
        strokeOpacity={0.35}
        strokeWidth={0.7}
        strokeLinecap="round"
      />
      <Circle cx={CX} cy={CY} r={CORE_R} fill="url(#weekCore)" />
      <Circle cx={CX} cy={CY} r={CORE_R * 0.45} fill="#FFFFFF" opacity={0.92} />
    </AnimatedG>
  )
}

/* A lived day — a luminous magenta body anchored to the spiral.
 * Brightness drives size, halo and the highlight pop; today gets a
 * slightly larger body and stronger breath. */
function DayBody({
  day,
  pos,
  isToday,
  t,
  popT,
  selected,
  faded,
  phase,
}: {
  day: DiaSemana
  pos: { x: number; y: number }
  isToday: boolean
  t: SharedValue<number>
  popT: SharedValue<number>
  selected: boolean
  faded: boolean
  phase: number
}) {
  const { x, y } = pos
  const b = day.brightness
  // Smaller bodies than Día's dimensions — there are 7 here on one
  // arm, so each body's bloom has to leave room for the next.
  const R = (isToday ? 4.2 : 3) + b * 2.4
  const bloomR = R * 3.4
  const auraR = R * 1.9

  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    let scale = 1 + wave * (isToday ? 0.07 : 0.04)
    if (selected) scale *= 1 + popT.value * 0.4
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
    <G opacity={faded ? 0.5 : 1}>
      <AnimatedG animatedProps={breath}>
        <Circle cx={x} cy={y} r={bloomR} fill={colors.magenta} opacity={0.08 + b * 0.12} />
        <Circle cx={x} cy={y} r={auraR} fill="#FBD7E3" opacity={0.1 + b * 0.16} />
        {selected ? (
          <Circle
            cx={x}
            cy={y}
            r={R + 6}
            fill="none"
            stroke="#F4ECDE"
            strokeWidth={1.3}
            opacity={0.9}
          />
        ) : null}
        <Circle cx={x} cy={y} r={R} fill="url(#weekBody)" />
        <Circle cx={x} cy={y} r={R * 0.45} fill="#FFFFFF" opacity={0.85} />
        <SvgText
          x={x}
          y={y + R + 11}
          textAnchor="middle"
          fontFamily={typography.uiBold}
          fontSize={10}
          letterSpacing={1.4}
          fill={isToday ? '#F4ECDE' : '#D9C8B5'}
          opacity={isToday ? 1 : 0.9}
        >
          {day.label}
        </SvgText>
      </AnimatedG>
    </G>
  )
}

/* A day that hasn't arrived — a cream ghost on the spiral, still
 * present but quieter than a lived body. `proximity` brightens the
 * next day up and fades the far end of the week, so the week reads
 * as a sequence of approaching presences rather than a list of
 * absences. */
function DayGhost({
  day,
  pos,
  proximity,
  selected,
  faded,
}: {
  day: DiaSemana
  pos: { x: number; y: number }
  /** 1 = tomorrow, larger = farther into the week. */
  proximity: number
  selected: boolean
  faded: boolean
}) {
  const { x, y } = pos
  // proxFactor 1.0 (tomorrow) → 0.5 (far end). Each step back loses
  // ~18 % of presence, so by Sábado the ghost is barely a whisper.
  const proxFactor = Math.max(0.45, 1 - (proximity - 1) * 0.18)
  const R = 2 + proxFactor * 1.6
  return (
    <G opacity={faded ? 0.55 : 1}>
      <Circle cx={x} cy={y} r={R * 3.2} fill="#FBD7E3" opacity={0.04 + proxFactor * 0.08} />
      <Circle cx={x} cy={y} r={R * 1.7} fill="#FBD7E3" opacity={0.06 + proxFactor * 0.12} />
      <Circle cx={x} cy={y} r={R} fill="#F4ECDE" opacity={0.32 + proxFactor * 0.32} />
      <Circle cx={x} cy={y} r={R * 0.45} fill="#FFFFFF" opacity={0.5 + proxFactor * 0.35} />
      {selected ? (
        <Circle
          cx={x}
          cy={y}
          r={R + 5}
          fill="none"
          stroke="#F4ECDE"
          strokeWidth={1}
          opacity={0.85}
        />
      ) : null}
      <SvgText
        x={x}
        y={y + R + 11}
        textAnchor="middle"
        fontFamily={typography.uiBold}
        fontSize={9.5}
        letterSpacing={1.3}
        fill="#A89887"
        opacity={0.45 + proxFactor * 0.35}
      >
        {day.label}
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
