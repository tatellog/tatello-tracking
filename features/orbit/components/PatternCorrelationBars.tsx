import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

import type { EvidenceBar } from '../month-built'

/*
 * PatternCorrelationBars — la PRUEBA que conecta el patrón con el norte: dos
 * barras pareadas por TASA (p.ej. "Con entreno 8/10 · Sin entreno 3/7") que
 * muestran cuánto más apareció el déficit cuando el hábito estuvo. Es la misma
 * gramática de evidencia de Órbita Mes, en la ceremonia. Las barras se rellenan
 * en secuencia guiadas por el `progress` 0→1 de la ceremonia.
 */

const CLAMP = Extrapolation.CLAMP
const TRACK_W = 150

function Bar({
  bar,
  order,
  progress,
}: {
  bar: EvidenceBar
  order: number
  progress: SharedValue<number>
}) {
  const total = bar.total ?? 0
  const rate = total > 0 ? Math.max(0, Math.min(1, bar.value / total)) : 0
  const start = 0.28 + order * 0.16
  const fillStyle = useAnimatedStyle(() => {
    const t = interpolate(progress.value, [start, start + 0.32], [0, 1], CLAMP)
    return { width: TRACK_W * rate * t }
  })
  const color = bar.highlight ? colors.magentaHot : 'rgba(244, 236, 222, 0.42)'
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{bar.label}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color }, fillStyle]} />
      </View>
      <Text style={[styles.value, bar.highlight && styles.valueHi]}>
        {total > 0 ? `${bar.value}/${total}` : `${bar.value}`}
      </Text>
    </View>
  )
}

export function PatternCorrelationBars({
  bars,
  progress,
}: {
  bars: EvidenceBar[]
  progress: SharedValue<number>
}) {
  return (
    <View style={styles.wrap}>
      {bars.map((bar, i) => (
        <Bar key={bar.label} bar={bar} order={i} progress={progress} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    width: 108,
    textAlign: 'right',
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
  },
  track: {
    width: TRACK_W,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(244, 236, 222, 0.1)',
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: 5,
  },
  value: {
    width: 40,
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.caption,
    color: colors.niebla,
    fontVariant: ['tabular-nums'],
  },
  valueHi: {
    color: colors.leche,
  },
})
