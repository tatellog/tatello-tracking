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
import Svg, { Circle, Defs, G, Line, RadialGradient, Stop, Text as SvgText } from 'react-native-svg'

import type { ZodiacSign } from '@/features/tabs/zodiac'
import { colors, typography } from '@/theme'

import type { Dimension, DimensionKey } from '../logic'
import { Cosmos } from './Cosmos'
import { zodiacGlyphPaths } from './ZodiacGlyph'

/*
 * The orbital diagram — the hero of the Día segment. A solar system:
 * the user (their name + sign) is the luminous core, and six
 * dimensions orbit it as PLANETS. Each planet is a shaded sphere — a
 * radial gradient gives it a lit side and a shadowed side. Brightness
 * is how lit the planet is: en luz glows warm and vivid, lejos sits
 * small and dark. Tapping a planet selects it.
 * See docs/tu-orbita-design.md.
 */

const W = 372
const CX = W / 2
const CY = W / 2
const MAX_R = 132
const HIT = 66 // tap-target box, in px

const AnimatedG = Animated.createAnimatedComponent(G)

/** Linear blend between two #rrggbb colours. */
function lerpHex(a: string, b: string, t: number): string {
  const ca = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)]
  const cb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)]
  const m = (i: number) => Math.round(ca[i]! + (cb[i]! - ca[i]!) * t)
  return `rgb(${m(0)},${m(1)},${m(2)})`
}

// A planet's three shading stops, interpolated lejos → en luz. The
// lejos end is a cool deep plum (not a muddy brown), so a dark planet
// reads as distant, not dead.
const orbHighlight = (b: number) => lerpHex('#574C63', '#FFE7EF', b)
const orbMid = (b: number) => lerpHex('#2A2238', '#EC5A90', b)
const orbShadow = (b: number) => lerpHex('#120E1C', '#4C1129', b)

/** Deterministic soft surface patches for a planet — breaks the
 *  flawless gradient into a textured body, less CG billiard ball. Two
 *  light patches, one dark, hashed by the planet's index so each
 *  planet's "surface" differs but never reshuffles between renders.
 *  Kept inside ~0.8r so they never poke past the crisp limb. */
function mottlePatches(
  x: number,
  y: number,
  r: number,
  index: number,
): { cx: number; cy: number; r: number; light: boolean }[] {
  const out: { cx: number; cy: number; r: number; light: boolean }[] = []
  for (let i = 0; i < 3; i++) {
    const seed = index * 2.7 + i * 1.93
    const f1 = 0.5 + 0.5 * Math.sin(seed * 3.7)
    const f2 = 0.5 + 0.5 * Math.sin(seed * 6.1)
    const dist = (0.1 + f1 * 0.26) * r
    out.push({
      cx: x + Math.cos(seed * 1.3) * dist,
      cy: y + Math.sin(seed * 1.3) * dist,
      r: (0.26 + f2 * 0.18) * r,
      light: i !== 1,
    })
  }
  return out
}

/** Canvas position of a dimension — fixed by its angle + orbit radius. */
function place(d: Dimension): { x: number; y: number } {
  const rad = ((d.angleDeg - 90) * Math.PI) / 180
  const r = d.radiusFrac * MAX_R
  return { x: CX + Math.cos(rad) * r, y: CY + Math.sin(rad) * r }
}

export function OrbitalSystem({
  dimensions,
  sign,
  name,
  selectedKey,
  onSelect,
}: {
  dimensions: Dimension[]
  /** The user's zodiac sign — the glyph at the core. */
  sign: ZodiacSign
  /** The user's first name — the luminous core is them. */
  name: string
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

  const selected = selectedKey ? (dimensions.find((d) => d.key === selectedKey) ?? null) : null
  const selectedPos = selected ? place(selected) : null

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 0 ${W} ${W}`} style={styles.svg}>
        <Defs>
          {/* One sphere-shading gradient per planet — light from the
              upper-left, shadow falling to the lower-right. */}
          {dimensions.map((d) => (
            <RadialGradient key={d.key} id={`orb-${d.key}`} cx="36%" cy="32%" r="75%">
              <Stop offset="0%" stopColor={orbHighlight(d.brightness)} />
              <Stop offset="46%" stopColor={orbMid(d.brightness)} />
              <Stop offset="100%" stopColor={orbShadow(d.brightness)} />
            </RadialGradient>
          ))}
          {/* The core "sun" — a deep, glowing magenta orb. */}
          <RadialGradient id="orb-self" cx="38%" cy="33%" r="78%">
            <Stop offset="0%" stopColor="#E07BA0" />
            <Stop offset="48%" stopColor="#8A2150" />
            <Stop offset="100%" stopColor="#330A1E" />
          </RadialGradient>
        </Defs>

        {/* The deep field — nebula + starfield — so the system reads
            as bodies IN space, not stickers on a void. */}
        <Cosmos t={t} drift={drift} />

        {/* Orbit rings — quiet hairlines; the selected one lights. */}
        {dimensions.map((d) => {
          const on = d.key === selectedKey
          return (
            <Circle
              key={`ring-${d.key}`}
              cx={CX}
              cy={CY}
              r={d.radiusFrac * MAX_R}
              fill="none"
              stroke={on ? colors.magenta : '#F4ECDE'}
              strokeOpacity={on ? 0.3 : 0.05}
              strokeWidth={1}
            />
          )
        })}

        {/* The thread from the core to the selected planet. */}
        {selectedPos ? (
          <Line
            x1={CX}
            y1={CY}
            x2={selectedPos.x}
            y2={selectedPos.y}
            stroke={colors.magenta}
            strokeWidth={1}
            strokeOpacity={0.36}
            strokeDasharray="2 4"
          />
        ) : null}

        <CenterSelf sign={sign} name={name} t={t} />

        {dimensions.map((d, i) => (
          <OrbitPlanet
            key={d.key}
            dim={d}
            index={i}
            t={t}
            selected={d.key === selectedKey}
            faded={selectedKey != null && d.key !== selectedKey}
          />
        ))}
      </Svg>

      {/* Tap targets — RN Pressables over each planet. Reliable hit
          testing regardless of how the SVG breathes underneath. */}
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

/* The core everything orbits — "tú": a deep, glowing sun-orb carrying
 * your name (in the serif coach voice) and your zodiac glyph. The
 * system literally turns around you. */
const SUN_R = 35

function CenterSelf({ sign, name, t }: { sign: ZodiacSign; name: string; t: SharedValue<number> }) {
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
    <G>
      <AnimatedG animatedProps={breath}>
        {/* Corona — a contained glow, not a smear. */}
        <Circle cx={CX} cy={CY} r={62} fill={colors.magenta} opacity={0.07} />
        <Circle cx={CX} cy={CY} r={46} fill={colors.magenta} opacity={0.13} />
        {/* The sun-orb, shaded, with a soft specular gloss. */}
        <Circle cx={CX} cy={CY} r={SUN_R} fill="url(#orb-self)" />
        <Circle
          cx={CX - SUN_R * 0.32}
          cy={CY - SUN_R * 0.36}
          r={SUN_R * 0.26}
          fill="#FFFFFF"
          opacity={0.4}
        />
      </AnimatedG>
      {/* Your name — the serif coach voice — and your sign, on the orb. */}
      <SvgText
        x={CX}
        y={CY - 6}
        textAnchor="middle"
        fontFamily={typography.serifSemi}
        fontStyle="italic"
        fontSize={22}
        fill="#FBF2E6"
      >
        {name}
      </SvgText>
      {/* The zodiac glyph, hand-drawn — a 24-unit glyph scaled,
          sitting just under the name. */}
      <G
        transform={`translate(${CX - 9.8} ${CY + 2}) scale(0.82)`}
        stroke="#E7BFCE"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {zodiacGlyphPaths(sign)}
      </G>
    </G>
  )
}

/* One dimension — a planet. A radial gradient shades it into a sphere;
 * brightness drives its size, how lit it is, its atmosphere glow and
 * its specular gloss. The planet breathes; the label stays put,
 * radially outward so inner planets never collide with the core. */
function OrbitPlanet({
  dim,
  index,
  t,
  selected,
  faded,
}: {
  dim: Dimension
  index: number
  t: SharedValue<number>
  selected: boolean
  faded: boolean
}) {
  const { x, y } = place(dim)
  const b = dim.brightness
  const R = 15 + b * 10
  const phase = (index * 0.17) % 1

  const dx = x - CX
  const dy = y - CY
  const dist = Math.hypot(dx, dy) || 1
  const labelOff = R + 16
  const lx = x + (dx / dist) * labelOff
  const ly = y + (dy / dist) * labelOff + 3.5

  const breath = useAnimatedProps(() => {
    'worklet'
    const wave = 0.5 + 0.5 * Math.sin((t.value + phase) * 2 * Math.PI)
    const scale = 1 + wave * 0.06
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
        {/* Atmosphere — a tight glow that only en-luz planets carry. */}
        <Circle cx={x} cy={y} r={R * 1.7} fill={colors.magenta} opacity={b * 0.1} />
        <Circle cx={x} cy={y} r={R * 1.32} fill={colors.magenta} opacity={b * 0.2} />
        {/* Selection crown. */}
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
        {/* The planet: a shaded body, strong soft mottling so the
            surface has character, and a diffuse inner luminosity — it
            glows, it is not a glossy CG ball. No specular dot, no rim
            "smile". */}
        <Circle cx={x} cy={y} r={R} fill={`url(#orb-${dim.key})`} />
        {mottlePatches(x, y, R, index).map((p, i) => {
          const col = p.light ? '#FFDDEA' : '#1B0A16'
          const op = (p.light ? 0.2 : 0.26) * (0.5 + b * 0.5)
          return (
            <G key={`mottle-${i}`}>
              <Circle cx={p.cx} cy={p.cy} r={p.r} fill={col} opacity={op * 0.5} />
              <Circle cx={p.cx} cy={p.cy} r={p.r * 0.58} fill={col} opacity={op * 0.78} />
            </G>
          )
        })}
        {/* Diffuse inner luminosity, biased to the lit side — the
            body glows from within rather than reflecting like glass. */}
        <Circle
          cx={x - R * 0.2}
          cy={y - R * 0.24}
          r={R * 0.66}
          fill="#FFE2EE"
          opacity={0.04 + b * 0.1}
        />
        <Circle
          cx={x - R * 0.24}
          cy={y - R * 0.28}
          r={R * 0.34}
          fill="#FFF0F5"
          opacity={0.05 + b * 0.16}
        />
      </AnimatedG>
      <SvgText
        x={lx}
        y={ly}
        textAnchor="middle"
        fontFamily={typography.uiBold}
        fontSize={9}
        fill={colors.leche}
        opacity={selected ? 1 : 0.36 + b * 0.6}
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
