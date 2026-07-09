import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { colors } from '@/theme'

/*
 * TypingDots — los 3 puntos de "Stelar está escribiendo" (ritmo de conversación
 * humana), para los turnos de respuesta del chat. La onda dorada (DiscoveryWave)
 * se reserva para el momento ceremonial de apertura ("leyendo tu mes"); esto es
 * el ida y vuelta cotidiano. Solo anima opacidad/escala (nunca color).
 */

const DOTS = [0, 1, 2]

function Dot({ index }: { index: number }) {
  const v = useSharedValue(0.3)
  useEffect(() => {
    v.value = withDelay(
      index * 180,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 380, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 380, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    )
    return () => cancelAnimation(v)
  }, [v, index])
  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: 0.85 + v.value * 0.2 }],
  }))
  return <Animated.View style={[styles.dot, style]} />
}

export function TypingDots() {
  return (
    <View style={styles.row}>
      {DOTS.map((i) => (
        <Dot key={i} index={i} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingLeft: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.oroSoft },
})
