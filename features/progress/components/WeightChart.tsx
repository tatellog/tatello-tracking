import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg'

import { colors, typography } from '@/theme'

import { WEIGHT_SOURCE_LABEL, weightAxisTicks, type WeightPoint } from '../logic'

/*
 * La gráfica de peso al estilo Salud (dueña 7 oct 2026): tus mediciones como
 * puntos en el tiempo real, la escala en kilos a la derecha y fechas abajo.
 * Sin líneas inventadas ni proyecciones. Tocar (o arrastrar) elige un punto:
 * arriba se lee su valor, fecha y de dónde vino. Al aparecer, los puntos se
 * encienden de izquierda a derecha.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const H = 190
const PLOT_TOP = 30
const PLOT_BOTTOM = 160
const AXIS_W = 30
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function fmtShortDay(t: number): string {
  const d = new Date(t)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function WeightChart({ points }: { points: readonly WeightPoint[] }) {
  const [width, setWidth] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const reduce = useReducedMotion()
  const reveal = useSharedValue(reduce ? points.length : 0)
  useEffect(() => {
    setPicked(null)
    if (reduce) {
      reveal.value = points.length
      return
    }
    reveal.value = 0
    reveal.value = withDelay(
      200,
      withTiming(points.length, {
        duration: Math.min(900, 120 * points.length),
        easing: Easing.out(Easing.quad),
      }),
    )
  }, [points, reduce, reveal])

  const ticks = weightAxisTicks(points)
  const plotW = Math.max(0, width - AXIS_W)
  const t0 = points[0]?.t ?? 0
  const t1 = points[points.length - 1]?.t ?? 1
  const span = Math.max(1, t1 - t0)
  const x = (t: number) => (points.length === 1 ? plotW / 2 : 6 + ((t - t0) / span) * (plotW - 12))
  const y = (w: number) =>
    PLOT_BOTTOM - ((w - ticks[0]) / (ticks[2] - ticks[0])) * (PLOT_BOTTOM - PLOT_TOP)

  const sel = picked ?? points.length - 1
  const selPoint = points[sel]

  const pickAt = (lx: number) => {
    if (points.length === 0) return
    let best = 0
    let bestD = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(x(p.t) - lx)
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    setPicked(best)
  }

  const mid = points.length > 2 ? points[Math.floor(points.length / 2)] : null

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {selPoint ? (
        <Text style={styles.readout} accessibilityLiveRegion="polite">
          <Text style={styles.readoutValue}>{selPoint.weight.toFixed(1)} kg</Text>
          {`  ${fmtShortDay(selPoint.t)}`}
          {selPoint.source ? ` · ${WEIGHT_SOURCE_LABEL[selPoint.source]}` : ''}
        </Text>
      ) : null}
      {width > 0 ? (
        <Pressable
          onPress={(e) => pickAt(e.nativeEvent.locationX)}
          onTouchMove={(e) => pickAt(e.nativeEvent.locationX)}
          accessibilityRole="adjustable"
          accessibilityLabel={`Gráfica de peso, ${points.length} mediciones`}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) =>
            setPicked((p) => {
              const cur = p ?? points.length - 1
              const next = e.nativeEvent.actionName === 'increment' ? cur + 1 : cur - 1
              return Math.max(0, Math.min(points.length - 1, next))
            })
          }
        >
          <Svg width={width} height={H}>
            {ticks.map((tk, i) => (
              <Line
                key={tk}
                x1={0}
                x2={plotW}
                y1={y(tk)}
                y2={y(tk)}
                stroke={i === 0 ? colors.hairlineStrong : colors.hairline}
                strokeWidth={1}
              />
            ))}
            {ticks.map((tk) => (
              <SvgText
                key={`l${tk}`}
                x={plotW + 8}
                y={y(tk) + 4}
                fill={colors.niebla}
                fontSize={11}
                fontFamily={typography.uiMedium}
              >
                {tk}
              </SvgText>
            ))}
            {selPoint ? (
              <Line
                x1={x(selPoint.t)}
                x2={x(selPoint.t)}
                y1={PLOT_TOP - 8}
                y2={PLOT_BOTTOM}
                stroke={colors.hairlineStrong}
                strokeWidth={1}
              />
            ) : null}
            {selPoint ? (
              <Circle
                cx={x(selPoint.t)}
                cy={y(selPoint.weight)}
                r={12}
                fill={colors.magenta}
                opacity={0.22}
              />
            ) : null}
            {points.map((p, i) => (
              <Dot
                key={p.t}
                cx={x(p.t)}
                cy={y(p.weight)}
                index={i}
                reveal={reveal}
                selected={i === sel}
              />
            ))}
            <SvgText
              x={0}
              y={H - 8}
              fill={colors.niebla}
              fontSize={11}
              fontFamily={typography.uiMedium}
            >
              {points[0] ? fmtShortDay(points[0].t) : ''}
            </SvgText>
            {mid ? (
              <SvgText
                x={x(mid.t)}
                y={H - 8}
                fill={colors.niebla}
                fontSize={11}
                fontFamily={typography.uiMedium}
                textAnchor="middle"
              >
                {fmtShortDay(mid.t)}
              </SvgText>
            ) : null}
            {points.length > 1 ? (
              <SvgText
                x={plotW}
                y={H - 8}
                fill={colors.niebla}
                fontSize={11}
                fontFamily={typography.uiMedium}
                textAnchor="end"
              >
                {fmtShortDay(t1)}
              </SvgText>
            ) : null}
          </Svg>
        </Pressable>
      ) : (
        <View style={{ height: H }} />
      )}
    </View>
  )
}

function Dot({
  cx,
  cy,
  index,
  reveal,
  selected,
}: {
  cx: number
  cy: number
  index: number
  reveal: SharedValue<number>
  selected: boolean
}) {
  const props = useAnimatedProps(() => {
    const on = Math.max(0, Math.min(1, reveal.value - index))
    return { opacity: on, r: (selected ? 5.5 : 4) * (0.4 + 0.6 * on) }
  })
  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill={selected ? colors.leche : colors.magenta}
      animatedProps={props}
    />
  )
}

const styles = StyleSheet.create({
  readout: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.label,
    color: colors.niebla,
    marginBottom: 2,
  },
  readoutValue: { fontFamily: typography.uiBold, color: colors.leche },
})
