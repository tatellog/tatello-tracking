import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, Ellipse, G, RadialGradient, Stop } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Región 1 — Núcleo Astral. La estrella del centro del pecho. Estado inicial:
 * tenue. Despierta: estrella que LATE (ritmo de corazón), glow que respira y
 * emisión suave de partículas. La intensidad (brillo + amplitud del latido +
 * partículas) crece con `pct`. Solo opacidad/translate (compositor) — sin
 * escalar el SVG por frame. Sagrado y elegante, nada de fanfarria.
 */

type Props = {
  /** Centro del núcleo sobre el arte, 0..1. */
  cx: number
  cy: number
  /** Lado del lienzo del arte en px. */
  artSize: number
  /** % de despertar de la región (0..100). */
  pct: number
}

const PARTICLES = [0, 1, 2, 3, 4, 5]

export function NucleoAstral({ cx, cy, artSize, pct }: Props) {
  const reduced = useReducedMotion() ?? false
  const intensity = Math.max(0, Math.min(1, pct / 100))
  // Zona del núcleo: aura suave + estrella de 4 puntas (cruz fina larga).
  const box = artSize * 0.6
  const left = cx * artSize - box / 2
  const top = cy * artSize - box / 2

  const beat = useSharedValue(0) // latido (lub-dub)
  const flow = useSharedValue(0) // emisión continua de partículas

  useEffect(() => {
    if (reduced) return
    // Latido: lub-dub y descanso (~2.9 s). Amplitud la modula `intensity`.
    beat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0.25, { duration: 190 }),
        withTiming(0.6, { duration: 130 }),
        withTiming(0, { duration: 220 }),
        withTiming(0, { duration: 2200 }),
      ),
      -1,
      false,
    )
    flow.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(beat)
      cancelAnimation(flow)
    }
  }, [reduced, beat, flow])

  // Glow: base tenue (dormido) + latido, todo escalado por intensidad.
  const glowStyle = useAnimatedStyle(() => {
    const base = 0.12 + 0.5 * intensity
    return { opacity: base + 0.4 * intensity * beat.value }
  })
  const coreStyle = useAnimatedStyle(() => {
    const base = 0.2 + 0.6 * intensity
    return { opacity: base + 0.3 * intensity * beat.value }
  })

  return (
    <View style={[styles.wrap, { left, top, width: box, height: box }]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <Svg width={box} height={box} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="nucleo-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.oroLeche} stopOpacity={0.7} />
              <Stop offset="0.35" stopColor={colors.oro} stopOpacity={0.22} />
              <Stop offset="1" stopColor={colors.oro} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={50} fill="url(#nucleo-glow)" />
        </Svg>
      </Animated.View>

      {/* Emisión de partículas — pocas, suaves, salen del centro. */}
      {!reduced && intensity > 0.05
        ? PARTICLES.map((i) => (
            <NucleoParticle key={i} flow={flow} seed={i} box={box} intensity={intensity} />
          ))
        : null}

      {/* Estrella de 4 puntas — cruz fina y larga + núcleo chico e intenso.
          Late con el corazón (coreStyle). Transparente salvo los rayos → no
          tapa la figura, solo la corona de luz sobre el pecho. */}
      <Animated.View style={[StyleSheet.absoluteFill, coreStyle]} pointerEvents="none">
        <Svg width={box} height={box} viewBox="0 0 100 100" fill="none">
          <Defs>
            <RadialGradient id="nucleo-ray" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.oroLeche} stopOpacity={0.95} />
              <Stop offset="0.5" stopColor={colors.oroLeche} stopOpacity={0.3} />
              <Stop offset="1" stopColor={colors.oroLeche} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="nucleo-core" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="0.4" stopColor={colors.oroLeche} stopOpacity={0.9} />
              <Stop offset="1" stopColor={colors.oro} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          {/* diagonales — muy tenues y cortas (apenas se insinúan) */}
          <G rotation={45} originX={50} originY={50} opacity={0.14}>
            <Ellipse cx={50} cy={50} rx={0.8} ry={28} fill="url(#nucleo-ray)" />
            <Ellipse cx={50} cy={50} rx={28} ry={0.8} fill="url(#nucleo-ray)" />
          </G>

          {/* cruz — halo tenue + núcleo fino, larga y dominante */}
          <Ellipse cx={50} cy={50} rx={2.6} ry={46} fill="url(#nucleo-ray)" opacity={0.28} />
          <Ellipse cx={50} cy={50} rx={46} ry={2.6} fill="url(#nucleo-ray)" opacity={0.28} />
          <Ellipse cx={50} cy={50} rx={0.9} ry={47} fill="url(#nucleo-ray)" />
          <Ellipse cx={50} cy={50} rx={47} ry={0.9} fill="url(#nucleo-ray)" />

          {/* núcleo chico e intenso */}
          <Circle cx={50} cy={50} r={4.5} fill="url(#nucleo-core)" />
          <Circle cx={50} cy={50} r={1.3} fill="#FFFFFF" />
        </Svg>
      </Animated.View>
    </View>
  )
}

function NucleoParticle({
  flow,
  seed,
  box,
  intensity,
}: {
  flow: SharedValue<number>
  seed: number
  box: number
  intensity: number
}) {
  const angle = (seed / 6) * Math.PI * 2 + seed * 0.6
  const dist = box * (0.16 + ((seed * 0.041) % 0.12))
  const dx = Math.cos(angle) * dist
  const dy = Math.sin(angle) * dist - box * 0.06 // leve sesgo hacia arriba
  const phase = seed / 6

  const style = useAnimatedStyle(() => {
    const t = (flow.value + phase) % 1
    const opacity = (t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8) * 0.7 * intensity
    return {
      opacity: Math.max(0, opacity),
      transform: [{ translateX: dx * t }, { translateY: dy * t }],
    }
  })

  return <Animated.View style={[styles.particle, style]} />
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  particle: {
    position: 'absolute',
    width: 2.4,
    height: 2.4,
    borderRadius: 1.2,
    backgroundColor: colors.oroLeche,
  },
})
