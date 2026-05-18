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

import { ZODIAC, type ZodiacSign } from '@/features/tabs/zodiac'
import { colors, typography } from '@/theme'

import type { Dimension, DimensionKey } from '../logic'

/*
 * The orbital diagram — the hero of the Día segment. A solar system:
 * the user (their name + sign) is the luminous core, and six
 * dimensions orbit it as PLANETS. Each planet is a shaded sphere — a
 * radial gradient gives it a lit side and a shadowed side. Brightness
 * is how lit the planet is: en luz glows warm and vivid, lejos sits
 * small and dark. Tapping a planet selects it.
 * See docs/tu-orbita-design.md.
 */

const W = 320
const CX = W / 2
const CY = W / 2
const MAX_R = 106
const HIT = 58 // tap-target box, in px

const AnimatedG = Animated.createAnimatedComponent(G)

/** Linear blend between two #rrggbb colours. */
function lerpHex(a: string, b: string, t: number): string {
  const ca = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)]
  const cb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)]
  const m = (i: number) => Math.round(ca[i]! + (cb[i]! - ca[i]!) * t)
  return `rgb(${m(0)},${m(1)},${m(2)})`
}

// A planet's three shading stops, interpolated lejos → en luz: a dark
// distant sphere brightens into a vivid lit one.
const orbHighlight = (b: number) => lerpHex('#6E5862', '#FFE7EF', b)
const orbMid = (b: number) => lerpHex('#3A2530', '#E9528A', b)
const orbShadow = (b: number) => lerpHex('#190E15', '#4C1129', b)

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
  // One 8 s clock drives every breath, like LunarConstellation.
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(t)
  }, [t])

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
              strokeOpacity={on ? 0.42 : 0.07}
              strokeWidth={1}
              strokeDasharray={on ? '5 6' : undefined}
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
const SUN_R = 27

function CenterSelf({ sign, name, t }: { sign: ZodiacSign; name: string; t: SharedValue<number> }) {
  const z = ZODIAC[sign]

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
        <Circle cx={CX} cy={CY} r={46} fill={colors.magenta} opacity={0.07} />
        <Circle cx={CX} cy={CY} r={33} fill={colors.magenta} opacity={0.13} />
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
        y={CY - 1}
        textAnchor="middle"
        fontFamily={typography.serifSemi}
        fontStyle="italic"
        fontSize={19}
        fill="#FBF2E6"
      >
        {name}
      </SvgText>
      <SvgText
        x={CX}
        y={CY + 16}
        textAnchor="middle"
        fontFamily={typography.uiBold}
        fontSize={9}
        letterSpacing={1.8}
        fill="#E7BFCE"
      >
        {`${z.glyph}  ${z.label}`}
      </SvgText>
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
  const R = 9 + b * 9
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
        {/* The planet — a sphere via radial-gradient shading — and a
            small specular gloss on the lit side. */}
        <Circle cx={x} cy={y} r={R} fill={`url(#orb-${dim.key})`} />
        <Circle
          cx={x - R * 0.34}
          cy={y - R * 0.36}
          r={R * 0.24}
          fill="#FFFFFF"
          opacity={0.18 + b * 0.42}
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
