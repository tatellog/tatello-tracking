import { curveMonotoneX, line as d3Line } from 'd3-shape'
import { useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Line, Path } from 'react-native-svg'

import { colors, spacing, typography } from '@/theme'

import { computeYDomain, type WeightPoint } from '../logic'

type Props = {
  points: WeightPoint[]
  height?: number
}

const PADDING_X = 16
const PADDING_TOP = 24
const PADDING_BOTTOM = 28

/*
 * Gráfica calma de peso: línea suave monotoneX en mauveDeep, sin
 * grid, sin dots por defecto. Las únicas etiquetas axis-like son el
 * peso + fecha del primer y último punto, abajo de la gráfica, en
 * tipografía editorial pequeña.
 *
 * Tap sobre el área activa el tooltip: línea vertical + dot + chip
 * pearl con la fecha + peso del punto más cercano. Tap fuera del
 * área lo cierra.
 *
 * El Y-domain hace auto-fit (computeYDomain) — nunca arranca en
 * cero. Esto hace que una variación de 76→78kg se vea como una
 * curva real, no como una línea casi plana.
 */
export function WeightChart({ points, height = 180 }: Props) {
  const [width, setWidth] = useState(0)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const onLayout = (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width
    if (next !== width) setWidth(next)
  }

  if (width === 0) return <View style={{ height }} onLayout={onLayout} />

  const innerW = width - PADDING_X * 2
  const innerH = height - PADDING_TOP - PADDING_BOTTOM
  const t0 = points[0]?.t ?? 0
  const tN = points[points.length - 1]?.t ?? 1
  const tSpan = Math.max(1, tN - t0)
  const [yMin, yMax] = computeYDomain(points)
  const ySpan = Math.max(0.01, yMax - yMin)

  const xOf = (t: number) => PADDING_X + ((t - t0) / tSpan) * innerW
  const yOf = (w: number) => PADDING_TOP + (1 - (w - yMin) / ySpan) * innerH

  const lineGen = d3Line<WeightPoint>()
    .x((p) => xOf(p.t))
    .y((p) => yOf(p.weight))
    .curve(curveMonotoneX)
  const d = lineGen(points) ?? ''

  const handlePress = (e: GestureResponderEvent) => {
    const x = e.nativeEvent.locationX
    if (x < PADDING_X || x > width - PADDING_X) {
      setActiveIndex(null)
      return
    }
    // Mapeamos x → t y buscamos el punto más cercano. Lineal en N,
    // pero N suele ser <100 y el Pressable se dispara una vez por tap,
    // así que el costo es despreciable.
    const targetT = t0 + ((x - PADDING_X) / innerW) * tSpan
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const point = points[i]
      if (!point) continue
      const dist = Math.abs(point.t - targetT)
      if (dist < bestDist) {
        bestDist = dist
        bestIdx = i
      }
    }
    setActiveIndex(bestIdx)
  }

  const first = points[0]
  const last = points[points.length - 1]
  const active = activeIndex != null ? points[activeIndex] : null

  return (
    <View style={styles.root}>
      <Pressable onPress={handlePress} onLayout={onLayout} style={{ height }}>
        <Animated.View entering={FadeIn.duration(600)} style={StyleSheet.absoluteFill}>
          <Svg width={width} height={height}>
            <Path d={d} stroke={colors.mauveDeep} strokeWidth={2} fill="none" />
            {active && (
              <>
                <Line
                  x1={xOf(active.t)}
                  x2={xOf(active.t)}
                  y1={PADDING_TOP}
                  y2={height - PADDING_BOTTOM}
                  stroke={colors.borderDashed}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
                <Circle
                  cx={xOf(active.t)}
                  cy={yOf(active.weight)}
                  r={4}
                  fill={colors.pearlElevated}
                  stroke={colors.mauveDeep}
                  strokeWidth={2}
                />
              </>
            )}
          </Svg>
        </Animated.View>
      </Pressable>

      {/* Etiquetas editoriales en primer y último punto. */}
      {first && last && first !== last && (
        <View style={[styles.endpoints, { paddingHorizontal: PADDING_X }]}>
          <Endpoint weight={first.weight} t={first.t} align="left" />
          <Endpoint weight={last.weight} t={last.t} align="right" />
        </View>
      )}

      {/* Tooltip flotante. Lo posicionamos relative al ancho medido
       *  con un small clamp para que no se salga del card. */}
      {active && (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            {
              left: clamp(xOf(active.t) - 60, PADDING_X, width - PADDING_X - 120),
              top: 4,
            },
          ]}
        >
          <Text style={styles.tooltipDate}>{formatDateEs(active.t)}</Text>
          <Text style={styles.tooltipWeight}>{active.weight.toFixed(1)} kg</Text>
        </View>
      )}
    </View>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

type EndpointProps = { weight: number; t: number; align: 'left' | 'right' }

function Endpoint({ weight, t, align }: EndpointProps) {
  return (
    <View style={[styles.endpoint, align === 'right' && styles.endpointRight]}>
      <Text style={styles.endpointWeight}>{weight.toFixed(1)}</Text>
      <Text style={styles.endpointDate}>{formatDateEs(t)}</Text>
    </View>
  )
}

function formatDateEs(t: number): string {
  const d = new Date(t)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).toUpperCase()
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  endpoints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -PADDING_BOTTOM + 4,
  },
  endpoint: {
    alignItems: 'flex-start',
  },
  endpointRight: {
    alignItems: 'flex-end',
  },
  endpointWeight: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.fontWeight.regular,
    color: colors.inkPrimary,
    letterSpacing: typography.letterSpacing.displayMed,
  },
  endpointDate: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.labelDim,
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.pearlElevated,
    borderColor: colors.borderSubtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minWidth: 120,
    alignItems: 'center',
  },
  tooltipDate: {
    fontFamily: typography.uiMedium,
    fontSize: typography.sizes.tinyLabel,
    fontWeight: typography.fontWeight.medium,
    letterSpacing: typography.letterSpacing.uppercaseMed,
    color: colors.labelMuted,
  },
  tooltipWeight: {
    fontFamily: typography.displayMedium,
    fontSize: typography.sizes.bodyLarge,
    fontWeight: typography.fontWeight.regular,
    color: colors.inkPrimary,
    letterSpacing: typography.letterSpacing.displayMed,
  },
})
