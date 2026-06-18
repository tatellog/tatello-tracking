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

import { colors } from '@/theme'

/*
 * Región 2 — Órbitas Eternas. Anillos celestiales ALREDEDOR de la figura.
 * Estado inicial: líneas estáticas tenues. Despierta: movimiento orbital lento
 * (estrellas que viajan por los anillos, capas que aparecen). Intensidad
 * (brillo + presencia de las estrellas) crece con `pct`. Significado:
 * constancia / hábito.
 *
 * Se coloca por GEOMETRÍA (concéntricos al centro de la figura) — no necesita
 * node-map. Anillos = Views con borde (círculos); estrellas = dots en
 * contenedores que ROTAN (View plana → compositor, sin re-rasterizar SVG; evita
 * el gotcha de SVG hermano sobre Image).
 */

type Ring = {
  /** Radio como fracción del lado del hero. */
  rf: number
  /** Vueltas por ciclo base (60 s). Lento. */
  turns: number
  dir: 1 | -1
  /** Ángulos base (grados) de las estrellas que orbitan ese anillo. */
  stars: number[]
}

const RINGS: Ring[] = [
  { rf: 0.33, turns: 1.0, dir: 1, stars: [20] },
  { rf: 0.42, turns: 0.68, dir: -1, stars: [130, 300] },
  { rf: 0.5, turns: 0.46, dir: 1, stars: [220] },
]

export function OrbitasEternas({ artSize, pct }: { artSize: number; pct: number }) {
  const reduced = useReducedMotion() ?? false
  const intensity = Math.max(0, Math.min(1, pct / 100))
  const t = useSharedValue(0)

  useEffect(() => {
    if (reduced) return
    t.value = withRepeat(withTiming(1, { duration: 60000, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(t)
  }, [reduced, t])

  const center = artSize / 2

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {RINGS.map((ring, i) => {
        const r = ring.rf * artSize
        return (
          <View key={i} style={StyleSheet.absoluteFill}>
            {/* anillo estático (líneas) — apenas visible al inicio */}
            <View
              style={{
                position: 'absolute',
                left: center - r,
                top: center - r,
                width: 2 * r,
                height: 2 * r,
                borderRadius: r,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.oro,
                opacity: 0.05 + 0.18 * intensity,
              }}
            />
            {/* estrellas que orbitan el anillo */}
            <OrbitStars
              t={t}
              turns={ring.turns}
              dir={ring.dir}
              r={r}
              center={center}
              angles={ring.stars}
              intensity={intensity}
              reduced={reduced}
            />
          </View>
        )
      })}
    </View>
  )
}

function OrbitStars({
  t,
  turns,
  dir,
  r,
  center,
  angles,
  intensity,
  reduced,
}: {
  t: SharedValue<number>
  turns: number
  dir: 1 | -1
  r: number
  center: number
  angles: number[]
  intensity: number
  reduced: boolean
}) {
  const rotStyle = useAnimatedStyle(() => {
    const deg = (reduced ? 0 : t.value) * 360 * turns * dir
    return { transform: [{ rotate: `${deg}deg` }] }
  })

  return (
    <Animated.View style={[StyleSheet.absoluteFill, rotStyle]}>
      {angles.map((ang, j) => {
        const rad = (ang * Math.PI) / 180
        const x = center + r * Math.cos(rad)
        const y = center + r * Math.sin(rad)
        const size = 3
        return (
          <View
            key={j}
            style={{
              position: 'absolute',
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.oroSoft,
              opacity: intensity * 0.9,
            }}
          />
        )
      })}
    </Animated.View>
  )
}
