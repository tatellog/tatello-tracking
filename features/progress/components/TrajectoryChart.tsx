import { useEffect } from 'react'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg'

import { colors, typography } from '@/theme'

import type { Trend, WeightPoint } from '../logic'

/*
 * The trajectory (extraído de progress.tsx para Epic 08 · F1: la pantalla
 * /weight-trend lo reusa en grande; el tab lo sigue usando idéntico).
 *
 * X-axis is REAL TIME — points are placed by their `measured_at` timestamp so
 * the cadence of marks is visible: a 10-day gap and a same-day pair both read
 * truthfully. Same-day measurements are separated by a small temporal nudge
 * (epsilon ms) inside the scale so they don't overlap, but the rest of the
 * line breathes with the actual rhythm.
 *
 * Read as a constellation forming: the measurement stars sit in the sky, the
 * comet line draws itself between them on mount, the current weight blazes as
 * the comet head, and — with enough points for a trend — a dashed line
 * projects the pace forward (capped to a healthy ±1 kg/week so two volatile
 * weeks don't draw a fantasy 8-kg drop in 4 weeks).
 */

// 4-point star — the shared glyph; here it marks the trajectory origin.
const STAR_PATH = 'M12 2 L14.3 9.7 L22 12 L14.3 14.3 L12 22 L9.7 14.3 L2 12 L9.7 9.7 Z'

const AnimatedPath = Animated.createAnimatedComponent(Path)

/* Curva monótona (Fritsch–Carlson): suaviza sin inventar picos ni valles entre
 * registros (una Catmull-Rom se pasa de largo y dibuja un peso que nunca hubo). */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length
  if (n === 0) return ''
  if (n === 1) return `M ${xs[0]} ${ys[0]}`
  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1]! - xs[i]!
    m[i] = dx[i]! === 0 ? 0 : (ys[i + 1]! - ys[i]!) / dx[i]!
  }
  const t: number[] = [m[0]!]
  for (let i = 1; i < n - 1; i++) {
    t[i] = m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2
  }
  t[n - 1] = m[n - 2]!
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i]! / m[i]!
    const b = t[i + 1]! / m[i]!
    const h = a * a + b * b
    if (h > 9) {
      const k = 3 / Math.sqrt(h)
      t[i] = k * a * m[i]!
      t[i + 1] = k * b * m[i]!
    }
  }
  let d = `M ${xs[0]} ${ys[0]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]! / 3
    d += ` C ${xs[i]! + h} ${ys[i]! + t[i]! * h} ${xs[i + 1]! - h} ${ys[i + 1]! - t[i + 1]! * h} ${xs[i + 1]} ${ys[i + 1]}`
  }
  return d
}
const AnimatedG = Animated.createAnimatedComponent(G)

export function TrajectoryChart({
  points,
  trend,
  height = 188,
  variant = 'comet',
}: {
  points: readonly WeightPoint[]
  trend: Trend | null
  height?: number
  /** 'area' (pantalla de tendencia): curva suave + área tenue + cada registro
   *  como punto, y la proyección con su nombre. 'comet' = el tab, idéntico. */
  variant?: 'comet' | 'area'
}) {
  const W = 300
  const H = height
  const padX = 18
  const padY = 26

  const lastIdx = points.length - 1
  const last = points[lastIdx]
  const first = points[0]
  const hasProjection = trend != null && last != null

  // Reserve the right slice of the chart for the forward projection.
  const histEndX = hasProjection ? padX + (W - 2 * padX) * 0.64 : W - padX

  // Projection cap — clamp weekly change to ±1 kg/week so two volatile weeks
  // don't extrapolate to an alarming forecast.
  const PROJECTION_WEEKS = 4
  const MAX_WEEKLY_KG = 1
  const cappedWeekly =
    trend != null ? Math.max(-MAX_WEEKLY_KG, Math.min(MAX_WEEKLY_KG, trend.weeklyChange)) : 0
  const projectedWeight = hasProjection ? last.weight + cappedWeekly * PROJECTION_WEEKS : null

  const ys = points.map((p) => p.weight)
  const domainYs = projectedWeight != null ? [...ys, projectedWeight] : ys
  const minY = Math.min(...domainYs) - 0.7
  const maxY = Math.max(...domainYs) + 0.7

  // Temporal X-scale: map each point's timestamp into the historical band of
  // the chart. Ties (same-day points) are nudged by their ordinal index so
  // they don't collapse to a single column.
  const tFirst = first?.t ?? 0
  const tLast = last?.t ?? 1
  const tSpan = Math.max(1, tLast - tFirst)
  const TIE_NUDGE_MS = (24 * 60 * 60 * 1000) / 12
  const xByIndex = points.map((p, i) => {
    let dupes = 0
    for (let j = 0; j < i; j += 1) {
      if (points[j]?.t === p.t) dupes += 1
    }
    const tShifted = p.t + dupes * TIE_NUDGE_MS
    return padX + ((tShifted - tFirst) / tSpan) * (histEndX - padX)
  })
  const sx = (i: number) => xByIndex[i] ?? padX
  const sy = (y: number) => padY + ((maxY - y) / (maxY - minY)) * (H - 2 * padY)

  const isArea = variant === 'area'
  const linePath = isArea
    ? monotonePath(
        points.map((_, i) => sx(i)),
        points.map((p) => sy(p.weight)),
      )
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(i)} ${sy(p.weight)}`).join(' ')
  const areaPath =
    isArea && points.length > 1 ? `${linePath} L ${sx(lastIdx)} ${H} L ${sx(0)} ${H} Z` : null

  // Total polyline length — drives the stroke draw-in.
  let lineLen = 0
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    if (!a || !b) continue
    lineLen += Math.hypot(sx(i) - sx(i - 1), sy(b.weight) - sy(a.weight))
  }
  lineLen = (lineLen || 1) * (isArea ? 1.2 : 1)

  const draw = useSharedValue(0)
  useEffect(() => {
    draw.value = 0
    draw.value = withDelay(150, withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) }))
  }, [points, draw])

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: lineLen * (1 - draw.value),
  }))
  const revealProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.62, 1], [0, 1], Extrapolation.CLAMP),
  }))

  const originK = 12 / 24
  const ox = sx(0)
  const oy = sy(first?.weight ?? 0)
  const hx = sx(lastIdx)
  const hy = sy(last?.weight ?? 0)

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        {/* Comet gradient — deep magenta tail receding into the bright head. */}
        <SvgGradient id="comet" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={colors.magentaDeep} />
          <Stop offset="1" stopColor={colors.magentaHot} />
        </SvgGradient>
        <SvgGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.magenta} stopOpacity={0.22} />
          <Stop offset="1" stopColor={colors.magenta} stopOpacity={0} />
        </SvgGradient>
      </Defs>

      {/* Área tenue bajo la curva (solo 'area'): se lee la tendencia, no el zigzag. */}
      {areaPath ? (
        <AnimatedPath d={areaPath} fill="url(#area-fill)" animatedProps={revealProps} />
      ) : null}

      {/* Measurement stars — each logged weight, a point of light (pequeños:
          el protagonista es el punto activo, no el historial). */}
      {points.slice(1, lastIdx).map((p, i) => (
        <Circle
          key={`m${i}`}
          cx={sx(i + 1)}
          cy={sy(p.weight)}
          r={isArea ? 3 : 2.1}
          fill={isArea ? colors.magentaHot : colors.magenta}
          opacity={isArea ? 0.85 : 1}
        />
      ))}

      {/* Origin — a faint star marking where the trajectory began. */}
      <Path
        d={STAR_PATH}
        transform={[
          { translateX: ox - 12 * originK },
          { translateY: oy - 12 * originK },
          { scale: originK },
        ]}
        fill={colors.magentaDeep}
      />

      {/* The trajectory — a comet, drawing itself in on mount (más fina:
          la línea sugiere, el punto activo brilla). */}
      <AnimatedPath
        d={linePath}
        fill="none"
        stroke="url(#comet)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={lineLen}
        animatedProps={lineProps}
      />

      {/* Comet head + forward projection — revealed once the line lands. */}
      <AnimatedG animatedProps={revealProps}>
        {hasProjection && projectedWeight != null ? (
          <>
            <Path
              d={`M ${hx} ${hy} L ${W - padX} ${sy(projectedWeight)}`}
              stroke={colors.magentaDeep}
              strokeWidth={1.8}
              strokeDasharray="3 5"
              strokeLinecap="round"
            />
            <Circle
              cx={W - padX}
              cy={sy(projectedWeight)}
              r={4.5}
              fill="none"
              stroke={colors.magentaDeep}
              strokeWidth={1.6}
            />
            {/* En 'area' la proyección se NOMBRA (antes una leyenda aparte
                decía "la punteada sigue tu ritmo real" y no se entendía). */}
            {isArea ? (
              <SvgText
                x={W - padX}
                y={sy(projectedWeight) - 10}
                fill={colors.niebla}
                fontSize={10}
                fontFamily={typography.uiMedium}
                textAnchor="end"
              >
                hacia dónde vas
              </SvgText>
            ) : null}
          </>
        ) : null}
        {/* Punto activo con glow en dos capas: hoy es lo que brilla. */}
        <Circle cx={hx} cy={hy} r={20} fill={colors.magentaTint} />
        <Circle cx={hx} cy={hy} r={12} fill={colors.magentaTint2} />
        <Circle cx={hx} cy={hy} r={5} fill={colors.magentaHot} />
      </AnimatedG>
    </Svg>
  )
}
