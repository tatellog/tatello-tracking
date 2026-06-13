import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

/*
 * La ignición del registro — la recompensa que NACE en la yema del dedo
 * y sube al cielo. Al tocar (un vaso de agua, una comida) brota una
 * corona de luz en el punto de toque y tres chispas suben: "toqué →
 * encendí → alimentó mi cielo", todo a la vista, DENTRO del modal donde
 * está el dedo (el toast global vive debajo del Modal y no se veía).
 *
 * Plano RN (sin SVG), un timeline por capa, transform/opacity en UI
 * thread. Self-contained y one-shot: el padre lo monta keyed en {x,y}
 * (pageX/pageY del tap) y lo desmonta a LIFETIME_MS. Cero costo en
 * reposo. El glow (shadow*) solo pinta en iOS; en Android el borde + la
 * opacidad de la corona y el punto sólido de las chispas leen igual sin
 * él (lección de release-APK: nunca dependemos del shadow para la forma).
 */

export const IGNITION_LIFETIME_MS = 1500

const RING = 60

// Las chispas que suben — pocas (3) y ligeras: el gesto de agua se
// repite, la ignición no debe volverse confeti. Tiempos largos para que
// la recompensa se demore y se sienta (no un parpadeo).
const SPARKS = [
  { dx: -12, delay: 40, rise: 175, dur: 1000 },
  { dx: 6, delay: 150, rise: 235, dur: 1150 },
  { dx: 13, delay: 90, rise: 150, dur: 950 },
] as const

function Spark({
  dx,
  delay,
  rise,
  dur,
  color,
}: {
  dx: number
  delay: number
  rise: number
  dur: number
  color: string
}) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: dur, easing: Easing.out(Easing.quad) }))
  }, [t, delay, dur])
  const style = useAnimatedStyle(() => ({
    // Aparece rápido, se desvanece al subir.
    opacity: t.value < 0.16 ? t.value / 0.16 : 1 - (t.value - 0.16) / 0.84,
    transform: [
      { translateX: dx * t.value },
      { translateY: -rise * t.value },
      { scale: 1 - t.value * 0.35 },
    ],
  }))
  return (
    <Animated.View style={[styles.spark, { backgroundColor: color, shadowColor: color }, style]} />
  )
}

export function IgnitionBurst({ x, y, color }: { x: number; y: number; color: string }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) })
  }, [t])

  // Núcleo: un punto que brilla fuerte y se apaga rápido.
  const core = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.95,
    transform: [{ scale: 0.3 + t.value * 0.7 }],
  }))
  // Corona: anillo que se expande hacia afuera, más etéreo — la onda de
  // luz, como tocar agua en calma.
  const halo = useAnimatedStyle(() => ({
    opacity: (1 - t.value) * 0.5,
    transform: [{ scale: 0.4 + t.value * 1.7 }],
  }))

  return (
    <View pointerEvents="none" style={[styles.layer, { left: x - RING / 2, top: y - RING / 2 }]}>
      <Animated.View style={[styles.ring, halo, { borderColor: color, shadowColor: color }]} />
      <Animated.View style={[styles.core, core, { backgroundColor: color, shadowColor: color }]} />
      {SPARKS.map((s, i) => (
        <Spark key={i} color={color} {...s} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 1.2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  core: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  spark: {
    position: 'absolute',
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
})
