import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Región 6 — Halo Cósmico. El ENTORNO entero. Estado inicial: espacio vacío.
 * Despierta: universo vivo (campo de estrellas, nebula, atmósfera celestial).
 * Es la región FINAL. Significado: integración. Toda la capa fade-in con el % .
 *
 * Foreground muy tenue (atmósfera sobre todo, sin lavar la figura): nebula = SVG
 * estático (transparente salvo los patches suaves); campo de estrellas = Views
 * planas repartidas en 3 GRUPOS de fase que titilan en unísono. Perf: 3 worklets
 * de opacidad en lugar de 42 (una useAnimatedStyle por dot). Todo escalado por
 * intensidad.
 */

const GROUPS = 3

// Campo de estrellas — repartido por todo el lienzo (fracciones pseudo-aleatorias
// deterministas), tamaños variados, asignadas a un grupo de fase por índice.
const STARFIELD = Array.from({ length: 42 }, (_, i) => ({
  x: (i * 0.6180339887 + 0.07) % 1,
  y: (i * 0.7548776662 + 0.13) % 1,
  s: 0.7 + ((i * 7) % 3) * 0.5,
  g: i % GROUPS,
}))

export function HaloCosmico({ artSize, pct }: { artSize: number; pct: number }) {
  const reduced = useReducedMotion() ?? false
  const intensity = Math.max(0, Math.min(1, pct / 100))
  const tw = useSharedValue(0) // titilar campo de estrellas (un solo loop, 3 fases)

  useEffect(() => {
    if (reduced) return
    tw.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(tw)
  }, [reduced, tw])

  if (intensity <= 0) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Nebula — patches suaves en esquinas (magenta + oro), estática (fade-in
          con el % ; sin loop de respiración → menos composite por frame). */}
      <View style={[StyleSheet.absoluteFill, { opacity: intensity * 0.85 }]}>
        <Svg width={artSize} height={artSize} pointerEvents="none">
          <Defs>
            <RadialGradient id="halo-neb-a" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.magenta} stopOpacity={0.14} />
              <Stop offset="1" stopColor={colors.magenta} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="halo-neb-b" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.oro} stopOpacity={0.1} />
              <Stop offset="1" stopColor={colors.oro} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse
            cx={artSize * 0.2}
            cy={artSize * 0.22}
            rx={artSize * 0.4}
            ry={artSize * 0.34}
            fill="url(#halo-neb-a)"
          />
          <Ellipse
            cx={artSize * 0.82}
            cy={artSize * 0.8}
            rx={artSize * 0.42}
            ry={artSize * 0.36}
            fill="url(#halo-neb-b)"
          />
        </Svg>
      </View>

      {/* Campo de estrellas — 3 grupos de fase, cada uno titila en unísono. */}
      {Array.from({ length: GROUPS }, (_, g) => (
        <HaloStarGroup
          key={g}
          tw={tw}
          group={g}
          stars={STARFIELD.filter((s) => s.g === g)}
          artSize={artSize}
          intensity={intensity}
          reduced={reduced}
        />
      ))}
    </View>
  )
}

function HaloStarGroup({
  tw,
  group,
  stars,
  artSize,
  intensity,
  reduced,
}: {
  tw: SharedValue<number>
  group: number
  stars: { x: number; y: number; s: number }[]
  artSize: number
  intensity: number
  reduced: boolean
}) {
  const phase = group / GROUPS
  const style = useAnimatedStyle(() => {
    const w = reduced ? 0.6 : 0.5 + 0.5 * Math.sin((tw.value + phase) * Math.PI * 2)
    return { opacity: intensity * (0.22 + 0.45 * w) }
  })
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {stars.map((s, i) => {
        const size = s.s
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: s.x * artSize - size / 2,
              top: s.y * artSize - size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.oroLeche,
            }}
          />
        )
      })}
    </Animated.View>
  )
}
