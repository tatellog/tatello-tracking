import { StyleSheet, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'

import { colors } from '@/theme'

/*
 * PatternEvidenceStrip — la EVIDENCIA visual de un patrón de constancia: la
 * frecuencia hecha imagen (p.ej. 5 de tus últimos 7 días). Reemplaza a la
 * "línea de vida" genérica (que es una metáfora de déficit, no de este patrón):
 * aquí lo que se ve ES el dato de la usuaria, no una animación decorativa.
 *
 * Los puntos ENCENDIDOS (count) se prenden en secuencia guiados por el mismo
 * `progress` 0→1 de la ceremonia; los apagados quedan como reposo tenue. Es un
 * conteo proporcional (cuántos de N), no un calendario: no afirma QUÉ días.
 */

const CLAMP = Extrapolation.CLAMP
const DOT = 16
const GAP = 12

function Dot({
  filled,
  order,
  span,
  progress,
}: {
  filled: boolean
  /** Posición en la secuencia de encendido (0..count-1); -1 si apagado. */
  order: number
  /** Cuántos encienden en total (para escalonar). */
  span: number
  progress: SharedValue<number>
}) {
  // Ventana de encendido de ESTE punto dentro del recorrido [0.18, 0.72].
  const start = 0.18 + (order < 0 ? 0 : order / Math.max(1, span)) * 0.5
  const style = useAnimatedStyle(() => {
    if (!filled) return { opacity: 0.22, transform: [{ scale: 1 }] }
    const t = interpolate(progress.value, [start, start + 0.12], [0, 1], CLAMP)
    return { opacity: 0.35 + t * 0.65, transform: [{ scale: 0.72 + t * 0.28 }] }
  })
  return <Animated.View style={[styles.dot, filled ? styles.filled : styles.empty, style]} />
}

export function PatternEvidenceStrip({
  count,
  total,
  progress,
}: {
  count: number
  total: number
  progress: SharedValue<number>
}) {
  // Puntos encendidos primero (izq.), apagados después; `order` solo para los
  // encendidos, que son los que animan en secuencia.
  const dots = Array.from({ length: total }, (_, i) => i < count)
  let lit = 0
  return (
    <View style={styles.row}>
      {dots.map((filled, i) => (
        <Dot key={i} filled={filled} order={filled ? lit++ : -1} span={count} progress={progress} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GAP,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  filled: {
    backgroundColor: colors.magentaHot,
    shadowColor: colors.magentaHot,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  empty: {
    borderWidth: 1.5,
    borderColor: 'rgba(244, 236, 222, 0.28)',
  },
})
