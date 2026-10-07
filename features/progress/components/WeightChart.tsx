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

import { WEIGHT_SOURCE_LABEL, weightAxisTicks, type WeightSource } from '../logic'

/** Un punto de la gráfica: peso o cualquier métrica (la clave se llama
 *  `weight` por historia; es el valor). */
export type ChartPoint = { t: number; weight: number; source?: string }

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

export function fmtShortDay(t: number, withYear = false): string {
  const d = new Date(t)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${String(d.getFullYear()).slice(2)}` : ''}`
}

export function WeightChart({
  points,
  unit = 'kg',
  color = colors.magenta,
  sourceLabel = (s: string) => WEIGHT_SOURCE_LABEL[s as WeightSource] ?? s,
}: {
  points: readonly ChartPoint[]
  unit?: string
  /** El color de la categoría (magenta para peso; el de cada métrica). */
  color?: string
  sourceLabel?: (source: string) => string
}) {
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
  // Si el rango cruza años, las fechas llevan el año ("15 ago 24" vs "15 ago 25").
  const yr = new Date(t0).getFullYear() !== new Date(t1).getFullYear()
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

  const midCand = points.length > 2 ? points[Math.floor(points.length / 2)] : null
  // La fecha de en medio solo si no se encima con la primera ni la última.
  const mid = midCand && x(midCand.t) > 80 && x(midCand.t) < plotW - 80 ? midCand : null

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {selPoint ? (
        <Text style={styles.readout} accessibilityLiveRegion="polite">
          <Text
            style={styles.readoutValue}
          >{`${selPoint.weight.toFixed(1)}${unit ? ` ${unit}` : ''}`}</Text>
          {`  ${fmtShortDay(selPoint.t, yr)}`}
          {selPoint.source ? ` · ${sourceLabel(selPoint.source)}` : ''}
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
                fill={color}
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
                color={color}
              />
            ))}
            <SvgText
              x={0}
              y={H - 8}
              fill={colors.niebla}
              fontSize={11}
              fontFamily={typography.uiMedium}
            >
              {points[0] ? fmtShortDay(points[0].t, yr) : ''}
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
                {fmtShortDay(mid.t, yr)}
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
                {fmtShortDay(t1, yr)}
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
  color,
}: {
  cx: number
  cy: number
  index: number
  reveal: SharedValue<number>
  selected: boolean
  color: string
}) {
  const props = useAnimatedProps(() => {
    const on = Math.max(0, Math.min(1, reveal.value - index))
    return { opacity: on, r: (selected ? 5.5 : 4) * (0.4 + 0.6 * on) }
  })
  return (
    <AnimatedCircle cx={cx} cy={cy} fill={selected ? colors.leche : color} animatedProps={props} />
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
