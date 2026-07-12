import type { BodyMeasurement } from '@/features/brief/api'
import type { DailySignals } from '@/features/orbit/api'
import { isDeficitDay } from '@/features/orbit/deficit'

import type { HistorySummary, MetricComparison } from './types'

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

/** "~200 g" o "~1.2 kg" — el ritmo semanal literal, redondeado a lo que
 *  la báscula puede sostener (50 g). */
function weeklyRateLabel(absKg: number): string {
  if (absKg >= 1) return `~${absKg.toFixed(1)} kg`
  const g = Math.max(50, Math.round((absKg * 1000) / 50) * 50)
  return `~${g} g`
}

/*
 * Una línea corta — la voz que comparte rumbo con el eyebrow "Rumbo a
 * tu Andrómeda". Número literal PRIMERO, cariño después: la fórmula que
 * ya ganó en el cierre del día, aplicada a LA pregunta de Progreso
 * ("¿estoy bajando?"). La poesía sola escondía la respuesta (feedback
 * beta: "me dan gravedad amable cuando pregunto cuánto bajé").
 * Sin juzgar el sentido del cambio: se nombra la trayectoria, jamás se
 * regaña.
 */
export function formatTrendCopy(trend: Trend): string {
  if (trend.direction === 'flat') return 'Tu peso se sostiene estable. El cielo sostiene tu ritmo.'

  const abs = Math.abs(trend.weeklyChange)
  const rate = weeklyRateLabel(abs)
  if (trend.direction === 'down') {
    if (abs > 0.5)
      return `Bajas ${rate} por semana, un ritmo fuerte. Cuida tu combustible para no perder brillo.`
    if (abs >= 0.2) return `Bajas ${rate} por semana, con calma y sin prisa.`
    return `Bajas ${rate} por semana. Gravedad amable.`
  }

  if (abs > 0.5) return `Tu rumbo sube ${rate} por semana. Míralo sin juicio: es información.`
  if (abs >= 0.2) return `Subes ${rate} por semana, paso a paso.`
  return `Subes apenas ${rate} por semana: luz tibia.`
}

/* ─── Comparison Engine · Historia 30v30 (Epic 01) ─────────────────────
 *
 * Puro y testeable: compara los HÁBITOS de la ventana actual (últimos N días)
 * contra la ventana anterior (los N previos). Responde "¿cómo cambiaron mis
 * hábitos?" — QUÉ cambió, sin por qué (eso es Órbita). Reusa la regla canónica
 * `isDeficitDay` para que "día en déficit" sea idéntico en toda la app.
 *
 * Recibe `today` (YYYY-MM-DD) como parámetro → determinístico (sin Date.now en la
 * función pura, tests reproducibles). Las fechas de `daily_signals.day` son
 * YYYY-MM-DD y se comparan como strings (orden lexicográfico = cronológico), sin
 * parseo de Date (Hermes no parsea 'YYYY-MM-DD' confiable).
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** Corre una fecha YYYY-MM-DD `days` días (mediodía evita bordes de DST). */
function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const dt = new Date(y, m - 1, d + days, 12)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export type HistoryCtx = {
  /** Hoy en YYYY-MM-DD (zona del usuario). */
  today: string
  calorieTarget: number | null
  proteinTarget: number | null
  /** Tamaño de cada ventana en días (default 30). */
  windowDays?: number
}

function mkComparison(
  key: MetricComparison['key'],
  current: number,
  previous: number,
): MetricComparison {
  const delta = Number((current - previous).toFixed(2))
  const direction: MetricComparison['direction'] = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  return { key, current, previous, delta, direction }
}

/** Delta de peso: última medición vs la más cercana a hace `win` días. */
function weightComparison(
  measurements: readonly BodyMeasurement[],
  today: string,
  win: number,
): MetricComparison | null {
  const withW = measurements
    .filter((m): m is BodyMeasurement & { weight_kg: number } => m.weight_kg != null)
    .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
  const latest = withW[withW.length - 1]
  if (!latest || withW.length < 2) return null
  const [y, m, d] = today.split('-').map(Number) as [number, number, number]
  const targetTs = new Date(y, m - 1, d, 12).getTime() - win * DAY_MS
  let prev: number | null = null
  let best = Infinity
  for (const row of withW) {
    const dist = Math.abs(new Date(row.measured_at).getTime() - targetTs)
    if (dist < best) {
      best = dist
      prev = row.weight_kg
    }
  }
  if (prev == null) return null
  return mkComparison('weight', Number(latest.weight_kg.toFixed(1)), Number(prev.toFixed(1)))
}

/**
 * Compara los hábitos de las últimas `windowDays` vs las `windowDays` previas.
 * Métricas de conteo (días): entrenos, proteína-en-meta, déficit, registro
 * (días con comida). Más el delta de peso. Las que dependen de una meta
 * (proteína/déficit) se omiten si no hay target — la UI las muestra como
 * invitación, nunca inventa.
 */
export function compareHistory(
  signals: readonly DailySignals[],
  measurements: readonly BodyMeasurement[],
  ctx: HistoryCtx,
): HistorySummary {
  const win = ctx.windowDays ?? 30
  const curStart = shiftIso(ctx.today, -win)
  const prevStart = shiftIso(ctx.today, -2 * win)
  const inCur = (s: DailySignals) => s.day != null && s.day > curStart && s.day <= ctx.today
  const inPrev = (s: DailySignals) => s.day != null && s.day > prevStart && s.day <= curStart
  const cur = signals.filter(inCur)
  const prev = signals.filter(inPrev)
  const count = (rows: DailySignals[], pred: (s: DailySignals) => boolean) =>
    rows.filter(pred).length

  const trained = (s: DailySignals) => s.trained === true
  const logged = (s: DailySignals) => (s.meal_count ?? 0) > 0
  const inDeficit = (s: DailySignals) => isDeficitDay(s.calories, ctx.calorieTarget)
  const proteinMet = (s: DailySignals) =>
    ctx.proteinTarget != null && s.protein_g != null && s.protein_g >= ctx.proteinTarget

  const metrics: (MetricComparison | null)[] = [
    mkComparison('workouts', count(cur, trained), count(prev, trained)),
    ctx.proteinTarget != null
      ? mkComparison('protein', count(cur, proteinMet), count(prev, proteinMet))
      : null,
    ctx.calorieTarget != null
      ? mkComparison('deficit', count(cur, inDeficit), count(prev, inDeficit))
      : null,
    mkComparison('logging', count(cur, logged), count(prev, logged)),
    weightComparison(measurements, ctx.today, win),
  ]

  return { windowDays: win, metrics: metrics.filter((x): x is MetricComparison => x != null) }
}
