import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Ellipse, Path } from 'react-native-svg'

import type { PhotoAngle } from '@/features/onboarding/photos/hooks/usePhotosToday'

/*
 * El placeholder de cada ángulo de foto (dueña 7 oct 2026: "no me gustan los
 * placeholders"), al estilo de la cámara de Apple y sin dibujar ningún cuerpo:
 * un visor (cuatro esquinas que se asientan) y, adentro, un busto genérico
 * sobre una plataforma: un punto gira hasta donde va la cámara (abajo = de
 * frente, arriba = de espaldas, a los lados = perfiles). Reduce-motion: quieto.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

// Ángulo (grados) del punto de cámara sobre la plataforma: 90 = hacia ti
// (frente), -90 = atrás (espalda), 180 = izquierda, 0 = derecha.
const TARGET: Record<PhotoAngle, number> = {
  front: 90,
  back: -90,
  side_left: 180,
  side_right: 0,
}

export function AngleGlyph({
  angle,
  color,
  accent,
  size = 56,
}: {
  angle: PhotoAngle
  color: string
  accent: string
  size?: number
}) {
  const reduce = useReducedMotion()
  const target = TARGET[angle]
  // El punto arranca al frente y gira sobre la plataforma hasta su ángulo.
  const deg = useSharedValue(reduce ? target : 90)
  useEffect(() => {
    if (reduce) return
    deg.value = withDelay(
      250,
      withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) }),
    )
  }, [reduce, target, deg])
  const dot = useAnimatedProps(() => {
    const r = (deg.value * Math.PI) / 180
    return { cx: 28 + 15 * Math.cos(r), cy: 46 + 4.5 * Math.sin(r) }
  })
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      {/* Busto genérico (como el avatar de Contactos), sin cuerpo. */}
      <Circle cx={28} cy={16} r={6.5} stroke={color} strokeWidth={1.6} />
      <Path
        d="M15 38c0-7.5 5.8-12 13-12s13 4.5 13 12"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* La plataforma y el punto: dónde va la cámara. */}
      <Ellipse cx={28} cy={46} rx={15} ry={4.5} stroke={color} strokeWidth={1.2} opacity={0.5} />
      <AnimatedCircle r={3} fill={accent} animatedProps={dot} />
    </Svg>
  )
}

/** Las cuatro esquinas del visor, que se asientan (de un poco más grandes a su
 *  lugar) al aparecer. Llena el slot que lo contiene. */
export function Viewfinder({ color }: { color: string }) {
  const reduce = useReducedMotion()
  const s = useSharedValue(reduce ? 1 : 0)
  useEffect(() => {
    if (reduce) return
    s.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })
  }, [reduce, s])
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * s.value,
    transform: [{ scale: 1.06 - 0.06 * s.value }],
  }))
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.frame, style]} pointerEvents="none">
      <View style={[styles.corner, styles.tl, { borderColor: color }]} />
      <View style={[styles.corner, styles.tr, { borderColor: color }]} />
      <View style={[styles.corner, styles.bl, { borderColor: color }]} />
      <View style={[styles.corner, styles.br, { borderColor: color }]} />
    </Animated.View>
  )
}

const C = 18
const styles = StyleSheet.create({
  frame: { margin: 12 },
  corner: { position: 'absolute', width: C, height: C },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 6,
  },
})
