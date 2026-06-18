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
} from 'react-native-reanimated'
import Svg, { Circle, Polygon } from 'react-native-svg'

import { colors } from '@/theme'

/*
 * Región 5 — Geometría Sagrada. Estructura sagrada SUTIL alrededor de la figura.
 * Estado inicial: incompleto. Despierta: emerge un mándala delicado (hexágonos
 * concéntricos + inscripciones doradas finas). Cada capa aparece al cruzar su
 * umbral de %. Significado: conciencia.
 *
 * Cálido y apenas presente (NO una estrella de David dura encima de la figura):
 * oro fino, baja opacidad, mándala detrás. SVG en primer plano (transparente
 * salvo el trazo → no tapa el arte). Sin rotación continua (re-rasteriza SVG en
 * Android); lo "vivo" es el APARECER por umbral + una respiración de opacidad
 * del grupo (compositor).
 */

// Polígono regular de n lados, radio r (en viewBox 100), centrado en (50,50).
function poly(n: number, r: number, rotDeg = -90): string {
  return Array.from({ length: n }, (_, k) => {
    const a = ((rotDeg + (k * 360) / n) * Math.PI) / 180
    return `${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`
  }).join(' ')
}

// Hexágonos concéntricos (uno rotado 30°) → mándala tenue, no estrella de David.
const HEX_OUTER = poly(6, 30, -90)
const HEX_INNER = poly(6, 21, -60)
// Inscripciones — puntos finos en los vértices del hexágono exterior.
const MARKS = Array.from({ length: 6 }, (_, k) => {
  const a = ((-90 + k * 60) * Math.PI) / 180
  return { x: 50 + 30 * Math.cos(a), y: 50 + 30 * Math.sin(a) }
})

export function GeometriaSagrada({ artSize, pct }: { artSize: number; pct: number }) {
  const reduced = useReducedMotion() ?? false
  const intensity = Math.max(0, Math.min(1, pct / 100))
  const breath = useSharedValue(0)

  useEffect(() => {
    if (reduced) return
    breath.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [reduced, breath])

  const groupStyle = useAnimatedStyle(() => {
    const b = reduced ? 0.7 : 0.55 + 0.45 * Math.sin(breath.value * Math.PI * 2)
    return { opacity: 0.4 + 0.25 * b }
  })

  if (intensity <= 0) return null
  const on = (at: number) => intensity >= at

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, groupStyle]}>
        <Svg width={artSize} height={artSize} viewBox="0 0 100 100" pointerEvents="none">
          {/* hexágono base — estructura tenue que se completa */}
          <Polygon
            points={HEX_OUTER}
            fill="none"
            stroke={colors.oro}
            strokeWidth={0.4}
            strokeOpacity={0.4}
          />
          {/* hexágono interior rotado → mándala (no estrella de David) */}
          {on(0.45) ? (
            <Polygon
              points={HEX_INNER}
              fill="none"
              stroke={colors.oroSoft}
              strokeWidth={0.4}
              strokeOpacity={0.38}
            />
          ) : null}
          {/* inscripciones finas en los vértices */}
          {on(0.75)
            ? MARKS.map((m, i) => (
                <Circle key={i} cx={m.x} cy={m.y} r={0.8} fill={colors.oroSoft} opacity={0.7} />
              ))
            : null}
        </Svg>
      </Animated.View>
    </View>
  )
}
