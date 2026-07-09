import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { colors } from '@/theme'

/*
 * DiscoveryWave — la onda de Stelar mientras "lee" tu mes (tipo Siri/Claude,
 * pero DORADA y muy lenta, elegante). Barras verticales cuyo alto ondula con
 * una onda que viaja. Solo se anima la escala (color estático · el crash de
 * gradientes Skia no aplica aquí, pero mantenemos la regla). Cancela el loop al
 * desmontar (no dejar animaciones huérfanas).
 */

const N = 24

export function DiscoveryWave({ width = 220 }: { width?: number }) {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(t)
  }, [t])

  return (
    <View style={[styles.row, { width }]}>
      {Array.from({ length: N }, (_, i) => (
        <Bar key={i} t={t} index={i} />
      ))}
    </View>
  )
}

function Bar({ t, index }: { t: SharedValue<number>; index: number }) {
  const style = useAnimatedStyle(() => {
    const phase = index / N
    const h = 0.22 + 0.78 * (0.5 + 0.5 * Math.sin((t.value + phase) * Math.PI * 2))
    return { transform: [{ scaleY: h }] }
  })
  // Oro más brillante al centro, más tenue en los bordes (estático).
  const mid = Math.abs(index - (N - 1) / 2) / ((N - 1) / 2)
  const color = mid < 0.4 ? colors.oroLight : mid < 0.75 ? colors.oroVect : colors.oroSoft
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 34, gap: 3 },
  bar: { flex: 1, height: 34, borderRadius: 2, opacity: 0.9 },
})
