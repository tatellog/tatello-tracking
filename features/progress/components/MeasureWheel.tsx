import { useCallback } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'

import { colors, typography } from '@/theme'

/*
 * MeasureWheel v2 (mock dueña 14 jul 2026) — UNA sola columna compacta: el
 * valor activo vive dentro de un marco redondeado (magenta, con la unidad
 * adentro) y los vecinos se atenúan arriba/abajo. Paso 0.1 con décimas
 * (0.5 sería muy grueso para peso) · enteros cuando decimals=false.
 *
 * FlatList con ventana (windowing) a propósito: peso 30–200 a paso 0.1 son
 * ~1700 filas; montarlas todas en un ScrollView (v1) era inviable. El truco
 * estándar de wheel-picker: getItemLayout reporta offsets SIN el padding del
 * contenedor, así initialScrollIndex/snap aterrizan centrados y la ventana
 * solo queda corrida ~PAD (lo cubre el overscan por defecto).
 */

const ITEM_H = 40
const VISIBLE = 3
const WHEEL_H = ITEM_H * VISIBLE
const PAD = (WHEEL_H - ITEM_H) / 2
const WIDTH = 176

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function WheelItem({
  label,
  index,
  scrollY,
  padRight,
}: {
  label: string
  index: number
  scrollY: SharedValue<number>
  padRight: number
}) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(index - scrollY.value / ITEM_H)
    // Math inline: un helper JS plano dentro del worklet truena en release
    // (memoria del repo).
    return {
      opacity: interpolate(d, [0, 1, 2], [1, 0.35, 0.12], Extrapolation.CLAMP),
      color: interpolateColor(Math.min(d, 1), [0, 1], [colors.magentaHot, colors.leche]),
      transform: [{ scale: interpolate(d, [0, 1, 2], [1, 0.72, 0.55], Extrapolation.CLAMP) }],
    }
  })
  return (
    <View style={[styles.item, { paddingRight: padRight }]}>
      <Animated.Text style={[styles.itemText, style]}>{label}</Animated.Text>
    </View>
  )
}

export function MeasureWheel({
  value,
  min,
  max,
  unit,
  decimals = true,
  onChange,
}: {
  value: number
  min: number
  max: number
  unit: string
  /** false → solo enteros. */
  decimals?: boolean
  onChange: (v: number) => void
}) {
  const step = decimals ? 0.1 : 1
  const count = Math.round((max - min) / step) + 1
  const valueAt = useCallback((i: number) => Math.round((min + i * step) * 10) / 10, [min, step])
  const fmt = useCallback((v: number) => (decimals ? v.toFixed(1) : String(v)), [decimals])
  // El padre re-monta con key por métrica; la posición inicial se lee una vez.
  const initialIndex = clamp(Math.round((value - min) / step), 0, count - 1)
  const padRight = unit ? 44 : 0

  const scrollY = useSharedValue(initialIndex * ITEM_H)
  const handler = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y
  })

  const renderItem = useCallback(
    ({ index }: { index: number }) => (
      <WheelItem label={fmt(valueAt(index))} index={index} scrollY={scrollY} padRight={padRight} />
    ),
    [fmt, valueAt, scrollY, padRight],
  )

  return (
    <View style={styles.box}>
      {/* El marco del valor activo (la unidad vive adentro, como el mock). */}
      <View style={styles.frame} pointerEvents="none">
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      <Animated.FlatList
        data={Array.from({ length: count }, (_, i) => i)}
        keyExtractor={(i) => String(i)}
        renderItem={renderItem}
        getItemLayout={(_, i) => ({ length: ITEM_H, offset: i * ITEM_H, index: i })}
        initialScrollIndex={initialIndex}
        initialNumToRender={VISIBLE + 4}
        windowSize={5}
        style={{ width: WIDTH, height: WHEEL_H }}
        contentContainerStyle={{ paddingVertical: PAD }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        onScroll={handler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const i = clamp(Math.round(e.nativeEvent.contentOffset.y / ITEM_H), 0, count - 1)
          onChange(valueAt(i))
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { width: WIDTH, height: WHEEL_H, alignSelf: 'center' },
  frame: {
    position: 'absolute',
    top: PAD,
    left: 0,
    right: 0,
    height: ITEM_H,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.bruma,
    backgroundColor: colors.bgCard2,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 14,
  },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: {
    fontFamily: typography.displayHeavy,
    fontSize: typography.sizes.displayMd,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    fontFamily: typography.uiSemi,
    fontSize: typography.sizes.body,
    color: colors.niebla,
  },
})
