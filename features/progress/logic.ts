import type { BodyMeasurement } from '@/features/brief/api'

export type WeightPoint = {
  /** Epoch ms — timestamp de la medida. */
  t: number
  /** Peso en kg, garantizado no-null. */
  weight: number
}

/*
 * Conversión BodyMeasurement[] → WeightPoint[] descartando filas sin
 * peso. Las medidas con sólo cintura/pecho/etc no aportan al chart de
 * peso pero existen en DB; las filtramos acá para que los componentes
 * de abajo asuman peso siempre presente.
 */
export function toWeightPoints(measurements: BodyMeasurement[]): WeightPoint[] {
  return measurements
    .filter((m): m is BodyMeasurement & { weight_kg: number } => m.weight_kg != null)
    .map((m) => ({ t: new Date(m.measured_at).getTime(), weight: m.weight_kg }))
    .sort((a, b) => a.t - b.t)
}

export type WeightDelta = {
  /** Diferencia en kg entre la última y la primera medida del rango. */
  abs: number
  /** Misma diferencia como % del peso inicial. */
  pct: number
  /** Días transcurridos entre primera y última medida. */
  days: number
}

/*
 * Delta entre el primer y último punto del rango. Devuelve null si
 * hay menos de 2 puntos — la UI muestra empty/single-point states en
 * ese caso.
 */
export function computeDelta(points: WeightPoint[]): WeightDelta | null {
  const first = points[0]
  const last = points[points.length - 1]
  if (!first || !last || first === last) return null
  const abs = Number((last.weight - first.weight).toFixed(2))
  const pct = Number(((abs / first.weight) * 100).toFixed(1))
  const days = Math.max(1, Math.round((last.t - first.t) / (24 * 60 * 60 * 1000)))
  return { abs, pct, days }
}

/*
 * Y-domain auto-fit: rango ajustado al mín/máx con un buffer
 * proporcional para que la curva no toque los bordes. Evitamos `min=0`
 * porque comprimiría la variación real de 76→78kg en una línea casi
 * plana — la queja clásica de las apps de fitness.
 */
export function computeYDomain(points: WeightPoint[]): [number, number] {
  if (points.length === 0) return [0, 1]
  const weights = points.map((p) => p.weight)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  if (min === max) return [min - 0.5, max + 0.5]
  const buffer = Math.max(0.3, (max - min) * 0.15)
  return [min - buffer, max + buffer]
}

export type Trend = {
  /** Cambio promedio en kg por semana, derivado por regresión lineal. */
  weeklyChange: number
  /** 'down' | 'up' | 'flat' — bucketed por umbral de relevancia. */
  direction: 'down' | 'up' | 'flat'
}

/*
 * Regresión lineal simple por mínimos cuadrados sobre (días, peso).
 * Devuelve null si hay menos de 3 puntos (la pendiente con 2 puntos
 * es siempre exacta y no representa una "tendencia" en el sentido
 * estadístico).
 *
 * El umbral de 0.05 kg/semana clasifica el cambio como "estable" —
 * por debajo de eso es ruido de báscula (agua, comida, hora del día).
 */
export function computeTrend(points: WeightPoint[]): Trend | null {
  const head = points[0]
  if (!head || points.length < 3) return null
  // Convertimos t a días-desde-el-primer-punto para que la pendiente
  // tenga unidades de kg/día y el cómputo no sufra precisión por
  // trabajar con epochs grandes.
  const t0 = head.t
  const xs = points.map((p) => (p.t - t0) / (24 * 60 * 60 * 1000))
  const ys = points.map((p) => p.weight)
  const n = points.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * (ys[i] ?? 0), 0)
  const sumXX = xs.reduce((a, x) => a + x * x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null // todos los puntos al mismo tiempo
  const slopePerDay = (n * sumXY - sumX * sumY) / denom
  const weeklyChange = Number((slopePerDay * 7).toFixed(2))

  let direction: Trend['direction'] = 'flat'
  if (weeklyChange < -0.05) direction = 'down'
  else if (weeklyChange > 0.05) direction = 'up'

  return { weeklyChange, direction }
}

/*
 * Convierte un Trend en una línea editorial corta. Calmo y
 * descriptivo — sin verbos imperativos ni juicios morales sobre el
 * progreso. Acompaña la gráfica como "lo que un coach te diría
 * mirando estos puntos".
 */
export function formatTrendCopy(trend: Trend): string {
  const abs = Math.abs(trend.weeklyChange)
  if (trend.direction === 'flat') return 'Estable. Sin cambios significativos esta vuelta.'

  const verb = trend.direction === 'down' ? 'Bajando' : 'Subiendo'
  const tail =
    abs > 0.5
      ? trend.direction === 'down'
        ? 'Ritmo agresivo — cuidado con la masa muscular.'
        : 'Ritmo agresivo.'
      : abs >= 0.2
        ? 'Ritmo sostenible.'
        : 'Movimiento lento, pero movimiento.'
  return `${verb} ~${abs.toFixed(1)} kg/semana. ${tail}`
}
