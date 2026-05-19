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

import type { ZodiacSign } from '@/features/tabs/zodiac'
import { colors, typography } from '@/theme'

import { EN_LUZ_THRESHOLD, type Dimension, type DimensionKey } from '../logic'
import { Cosmos } from './Cosmos'
import { zodiacGlyphPaths } from './ZodiacGlyph'

/*
 * The orbital diagram — the hero of the Día segment. A constellation:
 * you are the luminous star at the centre, and six dimensions hang on
 * faint dotted threads around you. A dimension en luz is a luminous
 * cream orb; one lejos is a hollow station, an unlit ring. Each wears
 * its label and a one-word state. Tapping a node selects it.
 * The plane is tilted (ry = rx · TILT) so the system reads as 3D.
 * See docs/tu-orbita-design.md.
 */

const W = 372
const CX = W / 2
const CY = W / 2
const MAX_R = 140
const HIT = 66 // tap-target box, in px
const TILT = 0.62

const AnimatedG = Animated.createAnimatedComponent(G)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** Canvas position of a dimension on the tilted orbital plane.
 *  `depth` is -1 (far / behind the core) … +1 (near / in front). */
function place(d: Dimension): { x: number; y: number; depth: number } {
  const rad = ((d.angleDeg - 90) * Math.PI) / 180
  const r = d.radiusFrac * MAX_R
  const depth = Math.sin(rad)
  return { x: CX + Math.cos(rad) * r, y: CY + depth * r * TILT, depth }
}

export function OrbitalSystem({
  dimensions,
  sign,
  selectedKey,
  onSelect,
}: {
  dimensions: Dimension[]
  /** The user's zodiac sign — the sigil at the core. */
  sign: ZodiacSign
  selectedKey: DimensionKey | null
  onSelect: (key: DimensionKey) => void
}) {
  // Two clocks: t (8 s) drives breathing + twinkle; drift (44 s) the
  // slow nebula movement.
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

  // Tap feedback: popT (0→1→0) amplifies the selected node with a
  // punchy overshoot; rippleT (0→1) drives a shockwave ring out of it.
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

  // Split nodes by depth so the back half tucks behind the core — real
  // 3D occlusion. Within each half, sort by screen-y.
  const placed = dimensions.map((d, i) => ({ d, i, pos: place(d) }))
  const backNodes = placed.filter((p) => p.pos.depth < 0).sort((a, b) => a.pos.y - b.pos.y)
  const frontNodes = placed.filter((p) => p.pos.depth >= 0).sort((a, b) => a.pos.y - b.pos.y)

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 0 ${W} ${W}`} style={styles.svg}>
        <Defs>
          {/* The core "sun" — a deep, glowing magenta orb. */}
          <RadialGradient id="orb-self" cx="38%" cy="33%" r="78%">
            <Stop offset="0%" stopColor="#E07BA0" />
            <Stop offset="48%" stopColor="#8A2150" />
            <Stop offset="100%" stopColor="#330A1E" />
          </RadialGradient>
          {/* A dimension en luz — a luminous cream orb. */}
          <RadialGradient id="orb-lit" cx="36%" cy="32%" r="76%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="44%" stopColor="#FBD7E3" />
            <Stop offset="100%" stopColor="#9A3358" />
          </RadialGradient>
        </Defs>

        {/* The deep field — nebula + starfield. */}
        <Cosmos t={t} drift={drift} />

        {/* Constellation threads — faint dotted lines from the core to
            each node; the selected one lifts and tightens. Drawn first
            so they emerge from behind the star. */}
        {dimensions.map((d) => {
          const { x, y } = place(d)
          const on = d.key === selectedKey
          return (
            <Line
              key={`spoke-${d.key}`}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke={colors.magenta}
              strokeOpacity={on ? 0.42 : 0.07 + d.brightness * 0.1}
              strokeWidth={1}
              strokeDasharray={on ? '3 4' : '1 6'}
            />
          )
        })}

        {/* Back nodes → core → front nodes. */}
        {backNodes.map(({ d, i }) => (
          <OrbitNode
            key={d.key}
            dim={d}
            index={i}
            t={t}
            popT={popT}
            rippleT={rippleT}
            selected={d.key === selectedKey}
            faded={selectedKey != null && d.key !== selectedKey}
          />
        ))}

        <CenterSelf sign={sign} t={t} />

        {frontNodes.map(({ d, i }) => (
          <OrbitNode
            key={d.key}
            dim={d}
            index={i}
            t={t}
            popT={popT}
            rippleT={rippleT}
            selected={d.key === selectedKey}
            faded={selectedKey != null && d.key !== selectedKey}
          />
        ))}
      </Svg>

      {/* Tap targets — RN Pressables over each node. */}
      {dimensions.map((d) => {
        const { x, y } = place(d)
        return (
          <Pressable
            key={`hit-${d.key}`}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {})
              onSelect(d.key)
            }}
            style={[styles.hit, { left: `${(x / W) * 100}%`, top: `${(y / W) * 100}%` }]}
            accessibilityRole="button"
            accessibilityState={{ selected: d.key === selectedKey }}
            accessibilityLabel={d.label}
          />
        )
      })}
    </View>
  )
}

/* The core everything orbits — "tú": a white-hot star with a deep
 * magenta bloom, marked with your zodiac sigil. No name — the centre
 * is felt by composition; the glyph is a symbol of you, not a label. */
const SUN_R = 35

function CenterSelf({ sign, t }: { sign: ZodiacSign; t: SharedValue<number> }) {
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
      {/* Bloom — the star's outer light. */}
      <Circle cx={CX} cy={CY} r={74} fill={colors.magenta} opacity={0.05} />
      <Circle cx={CX} cy={CY} r={54} fill={colors.magenta} opacity={0.1} />
      <Circle cx={CX} cy={CY} r={40} fill={colors.magenta} opacity={0.17} />
      {/* The orb. */}
      <Circle cx={CX} cy={CY} r={SUN_R} fill="url(#orb-self)" />
      {/* White-hot heart. */}
      <Circle cx={CX} cy={CY} r={SUN_R * 0.56} fill="#FFFFFF" opacity={0.28} />
      <Circle cx={CX} cy={CY} r={SUN_R * 0.32} fill="#FFFFFF" opacity={0.62} />
      {/* The zodiac sigil, hand-drawn, centred — deep enough to read
          against the hot core. */}
      <G
        transform={`translate(${CX - 12} ${CY - 12}) scale(1)`}
        stroke="#5E1734"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {zodiacGlyphPaths(sign)}
      </G>
    </AnimatedG>
  )
}

/* One dimension. En luz → a luminous cream orb that breathes and
 * glows; lejos → a hollow station, an unlit ring with a faint ember.
 * The label sits radially outward with its one-word state below it. */
function OrbitNode({
  dim,
  index,
  t,
  popT,
  rippleT,
  selected,
  faded,
}: {
  dim: Dimension
  index: number
  t: SharedValue<number>
  /** 0 → 1 → 0 tap ripple; the selected node amplifies on it. */
  popT: SharedValue<number>
  /** 0 → 1 tap ripple; drives the shockwave ring out of the node. */
  rippleT: SharedValue<number>
  selected: boolean
  faded: boolean
}) {
  const { x, y, depth } = place(dim)
  const b = dim.brightness
  const enLuz = b >= EN_LUZ_THRESHOLD
  // A near node (front of the plane) is a touch bigger, a far one
  // smaller — depth on top of the brightness size.
  const R = enLuz ? (10 + b * 5) * (1 + depth * 0.12) : 8.5
  const phase = (index * 0.17) % 1

  const dx = x - CX
  const dy = y - CY
  const dist = Math.hypot(dx, dy) || 1
  const labelOff = R + 16
  const lx = x + (dx / dist) * labelOff
  const ly = y + (dy / dist) * labelOff + 3

  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    let scale = 1 + wave * (enLuz ? 0.06 : 0.025)
    if (selected) scale *= 1 + popT.value * 0.5
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

  // Shockwave ring — radiates out of the node on tap.
  const ripple = useAnimatedProps(() => {
    'worklet'
    const u = rippleT.value
    return { r: R + u * R * 2.6, opacity: (1 - u) * 0.5 }
  })

  return (
    <G opacity={faded ? 0.42 : 1}>
      {selected ? (
        <AnimatedCircle
          cx={x}
          cy={y}
          r={R}
          fill="none"
          stroke="#F4ECDE"
          strokeWidth={1.6}
          animatedProps={ripple}
        />
      ) : null}
      <AnimatedG animatedProps={breath}>
        {enLuz ? (
          <>
            {/* Atmosphere — the glow of a lit dimension. */}
            <Circle cx={x} cy={y} r={R * 1.9} fill={colors.magenta} opacity={0.05 + b * 0.12} />
            <Circle cx={x} cy={y} r={R * 1.34} fill="#FBD7E3" opacity={0.06 + b * 0.14} />
            {selected ? (
              <Circle
                cx={x}
                cy={y}
                r={R + 6}
                fill="none"
                stroke="#F4ECDE"
                strokeWidth={1.4}
                opacity={0.9}
              />
            ) : null}
            {/* The luminous body. */}
            <Circle cx={x} cy={y} r={R} fill="url(#orb-lit)" />
            <Circle cx={x - R * 0.26} cy={y - R * 0.3} r={R * 0.32} fill="#FFFFFF" opacity={0.72} />
          </>
        ) : (
          <>
            {selected ? (
              <Circle
                cx={x}
                cy={y}
                r={R + 6}
                fill="none"
                stroke="#F4ECDE"
                strokeWidth={1.4}
                opacity={0.9}
              />
            ) : null}
            {/* A hollow station — unlit, not yet in light. */}
            <Circle cx={x} cy={y} r={R} fill={colors.bg} opacity={0.55} />
            <Circle cx={x} cy={y} r={R} fill="none" stroke={colors.bruma} strokeWidth={1.5} />
            <Circle cx={x} cy={y} r={R * 0.26} fill={colors.niebla} opacity={0.4} />
          </>
        )}
      </AnimatedG>
      <SvgText
        x={lx}
        y={ly}
        textAnchor="middle"
        fontFamily={typography.uiBold}
        fontSize={9}
        fill={enLuz ? colors.leche : colors.niebla}
        opacity={selected ? 1 : enLuz ? 0.6 + b * 0.4 : 0.7}
        letterSpacing={1.3}
      >
        {dim.label}
      </SvgText>
      {dim.word ? (
        <SvgText
          x={lx}
          y={ly + 11}
          textAnchor="middle"
          fontFamily={typography.serif}
          fontStyle="italic"
          fontSize={10}
          fill={colors.magenta}
          opacity={selected ? 1 : 0.78}
        >
          {dim.word}
        </SvgText>
      ) : null}
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
