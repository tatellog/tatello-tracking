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

const SMOOTH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/*
 * Trailing 7-day moving average. Each point's weight is replaced by
 * the mean of every measurement within the 7 days up to and
 * including it.
 *
 * Body weight swings ±1–2 kg a day from water, food and cycle phase;
 * a raw line (or a raw "today's number") turns that noise into
 * emotional signal. The smoothed series is what the Progreso tab
 * shows as the trend and the delta — what changed, not what the
 * scale happened to say this morning.
 *
 * Input must be sorted ascending by `t` (toWeightPoints already is).
 */
export function smoothWeightPoints(points: WeightPoint[]): WeightPoint[] {
  return points.map((p, i) => {
    let sum = 0
    let n = 0
    for (let j = i; j >= 0; j -= 1) {
      const q = points[j]
      if (!q) continue
      if (p.t - q.t > SMOOTH_WINDOW_MS) break
      sum += q.weight
      n += 1
    }
    return { t: p.t, weight: n > 0 ? sum / n : p.weight }
  })
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
 * Una línea corta — la voz que comparte rumbo con el eyebrow "Rumbo a
 * tu Andrómeda". Sin cifras (el número está arriba) y sin juzgar el
 * sentido del cambio: Stelar nombra la trayectoria, no la regaña.
 *
 * El vocabulario es cósmico — órbita, rumbo, gravedad — para que el
 * coach line se sienta parte del mismo cielo que el resto de Progreso.
 */
export function formatTrendCopy(trend: Trend): string {
  if (trend.direction === 'flat') return 'Tu órbita está en pausa: el cielo sostiene tu ritmo.'

  const abs = Math.abs(trend.weeklyChange)
  if (trend.direction === 'down') {
    if (abs > 0.5) return 'Vas bajando con fuerza: cuida tu combustible para no perder brillo.'
    if (abs >= 0.2) return 'Tu trayectoria desciende con calma, sin prisa.'
    return 'Bajas poco a poco: gravedad amable.'
  }

  if (abs > 0.5) return 'Tu rumbo sube rápido estas semanas.'
  if (abs >= 0.2) return 'Tu órbita asciende, paso a paso.'
  return 'Subes apenas un grado: luz tibia.'
}
