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
import Svg, { Circle, Path } from 'react-native-svg'

import type { SeriesPoint } from '../logic'

/*
 * MetricChart (Epic 08 · F1) — la línea de UNA métrica de composición para
 * las pantallas de detalle. Eje X = tiempo REAL (la cadencia de mediciones
 * se ve honesta: un hueco de un año es un hueco). Se dibuja al entrar (mismo
 * patrón animatedProps del TrajectoryChart), puntos históricos pequeños y el
 * punto activo con glow: hoy es lo que brilla. Sin ejes, sin grid, sin
 * verde/rojo — la dirección la dicen los números de la pantalla.
 */

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export function MetricChart({
  serie,
  hue,
  height = 180,
}: {
  serie: SeriesPoint[]
  hue: string
  height?: number
}) {
  const W = 300
  const H = height
  const padX = 16
  const padY = 24

  const draw = useSharedValue(0)
  useEffect(() => {
    draw.value = 0
    draw.value = withDelay(150, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }))
  }, [serie, draw])

  // Geometría (con defaults seguros para n<2: los hooks corren SIEMPRE, el
  // early-return vive después de ellos).
  const n = serie.length
  const ts = serie.map((p) => new Date(`${p.day}T12:00:00`).getTime())
  const t0 = ts[0] ?? 0
  const tSpan = Math.max(1, (ts[n - 1] ?? 1) - t0)
  const ys = serie.map((p) => p.value)
  const minY = (ys.length ? Math.min(...ys) : 0) - 0.5
  const maxY = (ys.length ? Math.max(...ys) : 1) + 0.5

  const sx = (i: number) => padX + (((ts[i] ?? t0) - t0) / tSpan) * (W - 2 * padX)
  const sy = (v: number) => padY + ((maxY - v) / Math.max(0.001, maxY - minY)) * (H - 2 * padY)

  const linePath = serie.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(i)} ${sy(p.value)}`).join(' ')
  let lineLen = 0
  for (let i = 1; i < n; i += 1) {
    lineLen += Math.hypot(sx(i) - sx(i - 1), sy(serie[i]!.value) - sy(serie[i - 1]!.value))
  }
  lineLen = lineLen || 1

  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: lineLen * (1 - draw.value),
  }))
  // El glow y el punto activo se revelan cuando la línea aterriza; cada capa
  // con su propio rango de opacidad (animatedProps pisa el prop estático).
  const glowHeadProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.65, 1], [0, 0.14], Extrapolation.CLAMP),
  }))
  const headProps = useAnimatedProps(() => ({
    opacity: interpolate(draw.value, [0.65, 1], [0, 1], Extrapolation.CLAMP),
  }))

  if (n < 2) return null

  const hx = sx(n - 1)
  const hy = sy(serie[n - 1]!.value)

  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {serie.slice(0, n - 1).map((p, i) => (
        <Circle key={p.day} cx={sx(i)} cy={sy(p.value)} r={2.4} fill={hue} opacity={0.7} />
      ))}
      <AnimatedPath
        d={linePath}
        fill="none"
        stroke={hue}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={lineLen}
        animatedProps={lineProps}
      />
      <AnimatedCircle cx={hx} cy={hy} r={14} fill={hue} animatedProps={glowHeadProps} />
      <AnimatedCircle cx={hx} cy={hy} r={4.5} fill={hue} animatedProps={headProps} />
    </Svg>
  )
}
