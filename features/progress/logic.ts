import type { BodyMeasurement } from '@/features/brief/api'
import type { DailySignals } from '@/features/orbit/api'
import { isDeficitDay } from '@/features/orbit/deficit'

import type { BodyCheckin, BodyComposition, PhotoAngle, TimelinePhoto } from './api'
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

/**
 * UNA sola serie de peso (fix de confianza · target-user: "67 arriba y 72 abajo
 * sin explicación → la tercera vez ya no le creo a nada"). Fusiona los pesos
 * marcados en la app (body_measurements) con los de los check-ins del coach:
 * una línea continua, como Apple Health. Mismo día: gana la medición propia
 * (el ritual); los check-ins anclan el histórico. El suavizado 7d existente
 * absorbe el salto entre básculas. Ascendente por t.
 */
export function mergeWeightSeries(
  measurements: readonly BodyMeasurement[],
  checkins: readonly BodyCheckin[],
): WeightPoint[] {
  const byDay = new Map<string, WeightPoint>()
  for (const c of checkins) {
    if (c.weight_kg == null) continue
    const [y, m, d] = c.measured_on.split('-').map(Number) as [number, number, number]
    byDay.set(c.measured_on, { t: new Date(y, m - 1, d, 8).getTime(), weight: c.weight_kg })
  }
  for (const m of measurements) {
    if (m.weight_kg == null) continue
    const day = m.measured_at.slice(0, 10)
    byDay.set(day, { t: new Date(m.measured_at).getTime(), weight: m.weight_kg })
  }
  return [...byDay.values()].sort((a, b) => a.t - b.t)
}

/* ─── Export CSV (propiedad de datos · decisión benchmark) ───────────────
 *
 * "El día que sienta que la tabla y las fotos son mías, le meto todo sin
 * miedo" (target-user). Modelo Apple Health: la data sale libre y gratis; el
 * valor vivo (Síntesis, patrones) es lo que te quedas. Nunca premium-gated.
 */

const CSV_COLUMNS: { header: string; key: keyof BodyCheckin }[] = [
  { header: 'peso_kg', key: 'weight_kg' },
  { header: 'imc', key: 'bmi' },
  { header: 'tmb_kcal', key: 'bmr_kcal' },
  { header: 'agua_pct', key: 'water_pct' },
  { header: 'masa_osea_kg', key: 'bone_mass_kg' },
  { header: 'edad_metabolica', key: 'metabolic_age' },
  { header: 'grasa_visceral', key: 'visceral_fat_index' },
  { header: 'musculo_kg', key: 'muscle_kg' },
  { header: 'musculo_brazo_der_kg', key: 'muscle_arm_right_kg' },
  { header: 'musculo_brazo_izq_kg', key: 'muscle_arm_left_kg' },
  { header: 'musculo_tronco_kg', key: 'muscle_trunk_kg' },
  { header: 'musculo_pierna_der_kg', key: 'muscle_leg_right_kg' },
  { header: 'musculo_pierna_izq_kg', key: 'muscle_leg_left_kg' },
  { header: 'grasa_pct', key: 'body_fat_pct' },
  { header: 'grasa_brazo_der_pct', key: 'fat_arm_right_pct' },
  { header: 'grasa_brazo_izq_pct', key: 'fat_arm_left_pct' },
  { header: 'grasa_tronco_pct', key: 'fat_trunk_pct' },
  { header: 'grasa_pierna_der_pct', key: 'fat_leg_right_pct' },
  { header: 'grasa_pierna_izq_pct', key: 'fat_leg_left_pct' },
  // Medidas de cinta AL FINAL: measurementsCsv escribe el peso de la app en
  // la primera columna de datos por índice — peso_kg debe seguir primero.
  { header: 'cuello_cm', key: 'neck_cm' },
  { header: 'pecho_cm', key: 'chest_cm' },
  { header: 'cintura_cm', key: 'waist_cm' },
  { header: 'abdomen_cm', key: 'abdomen_cm' },
  { header: 'caderas_cm', key: 'hips_cm' },
  { header: 'brazo_der_cm', key: 'arm_right_cm' },
  { header: 'brazo_izq_cm', key: 'arm_left_cm' },
  { header: 'muslo_der_cm', key: 'thigh_right_cm' },
  { header: 'muslo_izq_cm', key: 'thigh_left_cm' },
  { header: 'pantorrilla_der_cm', key: 'calf_right_cm' },
  { header: 'pantorrilla_izq_cm', key: 'calf_left_cm' },
]

const csvField = (v: string | number | null | undefined): string => {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Todas las mediciones (check-ins completos + pesajes de la app) como CSV,
 *  ascendente por fecha. Crudo y completo: es SU expediente saliendo. */
export function measurementsCsv(
  checkins: readonly BodyCheckin[],
  measurements: readonly BodyMeasurement[],
): string {
  const header = ['fecha', 'fuente', ...CSV_COLUMNS.map((c) => c.header), 'notas']
  type Row = { date: string; cells: string[] }
  const rows: Row[] = []
  for (const c of checkins) {
    rows.push({
      date: c.measured_on,
      cells: [
        c.measured_on,
        c.source === 'coach' ? 'coach' : 'manual',
        ...CSV_COLUMNS.map((col) => csvField(c[col.key] as number | null)),
        csvField(c.notes ?? null),
      ],
    })
  }
  for (const m of measurements) {
    if (m.weight_kg == null) continue
    const day = m.measured_at.slice(0, 10)
    const cells = [day, 'app', ...CSV_COLUMNS.map(() => ''), '']
    cells[2] = csvField(m.weight_kg) // peso_kg es la primera columna de datos
    rows.push({ date: day, cells })
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return [header.join(','), ...rows.map((r) => r.cells.join(','))].join('\n')
}

/* ─── IMC y TMB calculados (Epic 08 · rediseño Nueva medición) ───────────
 *
 * "Calculado por Stelar": cuando el perfil tiene los datos, la app llena
 * estos campos sola (la usuaria puede sobreescribirlos). Fórmulas estándar:
 * IMC = kg / m²; TMB = Mifflin-St Jeor (la de básculas InBody/consultorio).
 * Puros y redondeados a lo que la métrica sostiene.
 */

export function computeBmi(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm <= 0) return null
  const m = heightCm / 100
  return Number((weightKg / (m * m)).toFixed(1))
}

export function computeTmb(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: 'female' | 'male',
): number | null {
  if (weightKg <= 0 || heightCm <= 0 || ageYears <= 0) return null
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears
  return Math.round(base + (sex === 'male' ? 5 : -161))
}

/* ─── Recuperación desde el pico (decisión benchmark + target-user) ──────
 *
 * El hecho que la usuaria pidió con sus propios datos: "llegaste a subir a
 * 72.1 y ya bajaste 5 de eso". Determinístico, sobre la serie SUAVIZADA (el
 * relato no retrocede con un pesaje ruidoso). Límites duros del manifiesto:
 * narra la dirección recorrida, NUNCA la distancia restante (cero countdown,
 * cero "te faltan X kg"). Solo existe si hubo pico DESPUÉS del inicio (subiste
 * y ya bajaste); quien viene bajando desde el día uno ya tiene su historia en
 * el hero. Si la tendencia se invierte, el hecho simplemente desaparece (el
 * drop cae bajo el umbral) — nunca se convierte en regaño.
 */

export type RecoveryFact = { peakKg: number; droppedKg: number }

export function recoveryFact(points: readonly WeightPoint[]): RecoveryFact | null {
  if (points.length < 3) return null
  let peakIdx = 0
  for (let i = 1; i < points.length; i += 1) {
    if ((points[i]?.weight ?? -Infinity) > (points[peakIdx]?.weight ?? -Infinity)) peakIdx = i
  }
  const peak = points[peakIdx]
  const last = points[points.length - 1]
  if (!peak || !last) return null
  // Pico en el arranque = no hay rebote que contar; pico al final = está en
  // el pico, no hay recuperación aún.
  if (peakIdx === 0 || peakIdx === points.length - 1) return null
  const droppedKg = Number((peak.weight - last.weight).toFixed(1))
  if (droppedKg < 1) return null
  return { peakKg: Number(peak.weight.toFixed(1)), droppedKg }
}

/** La foto del ángulo MÁS CERCANA a un día (±tolDays): una sesión de fotos al
 *  día siguiente del check-in no desaparece del comparador. */
export function photoNear(
  photos: readonly TimelinePhoto[],
  angle: PhotoAngle,
  day: string,
  tolDays = 3,
): TimelinePhoto | null {
  let best: TimelinePhoto | null = null
  let bestDist = Infinity
  for (const p of photos) {
    if (p.angle !== angle || p.signed_url == null) continue
    const dist = Math.abs(daysBetween(p.taken_at.slice(0, 10), day))
    if (dist < bestDist) {
      bestDist = dist
      best = p
    }
  }
  return best && bestDist <= tolDays ? best : null
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
 * Series semanales para las mini-sparklines de Historia (F1 · mockup dueña):
 * el arco de ~9 semanas de cada hábito como conteo de días/semana. Identidad
 * visual por métrica, nunca juicio — la sparkline muestra forma, no calificación.
 * Puro: cubos de 7 días que TERMINAN en `today`, del más viejo al más nuevo.
 */
export function historySparklines(
  signals: readonly DailySignals[],
  ctx: HistoryCtx,
): Record<'workouts' | 'protein' | 'deficit' | 'logging', number[]> {
  const win = ctx.windowDays ?? 30
  const weeks = Math.ceil((2 * win) / 7)
  const preds: Record<
    'workouts' | 'protein' | 'deficit' | 'logging',
    (s: DailySignals) => boolean
  > = {
    workouts: (s) => s.trained === true,
    protein: (s) =>
      ctx.proteinTarget != null && s.protein_g != null && s.protein_g >= ctx.proteinTarget,
    deficit: (s) => isDeficitDay(s.calories, ctx.calorieTarget),
    logging: (s) => (s.meal_count ?? 0) > 0,
  }
  const out = {
    workouts: new Array(weeks).fill(0) as number[],
    protein: new Array(weeks).fill(0) as number[],
    deficit: new Array(weeks).fill(0) as number[],
    logging: new Array(weeks).fill(0) as number[],
  }
  for (const s of signals) {
    if (s.day == null) continue
    const back = daysBetween(s.day, ctx.today)
    if (back < 0 || back >= weeks * 7) continue
    const bucket = weeks - 1 - Math.floor(back / 7) // más nuevo al final
    for (const key of Object.keys(preds) as (keyof typeof preds)[]) {
      if (preds[key](s)) out[key][bucket] = (out[key][bucket] ?? 0) + 1
    }
  }
  return out
}

/** Proteína PROMEDIO (g/día con registro) de la ventana actual vs la previa —
 *  el lenguaje del registro del coach (el mockup usa gramos, no días-en-meta).
 *  null si una ventana no tiene días con proteína registrada. */
export function proteinAverageComparison(
  signals: readonly DailySignals[],
  ctx: HistoryCtx,
): { current: number; previous: number } | null {
  const win = ctx.windowDays ?? 30
  const curStart = shiftIso(ctx.today, -win)
  const prevStart = shiftIso(ctx.today, -2 * win)
  const avg = (rows: DailySignals[]): number | null => {
    const withP = rows.filter((s) => s.protein_g != null)
    if (withP.length === 0) return null
    return Math.round(withP.reduce((a, s) => a + (s.protein_g as number), 0) / withP.length)
  }
  const cur = avg(signals.filter((s) => s.day != null && s.day > curStart && s.day <= ctx.today))
  const prev = avg(signals.filter((s) => s.day != null && s.day > prevStart && s.day <= curStart))
  if (cur == null || prev == null) return null
  return { current: cur, previous: prev }
}

/** Días entre dos YYYY-MM-DD sin parsear Date en caliente (Hermes). */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number]
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number]
  return Math.round(
    (new Date(by, bm - 1, bd, 12).getTime() - new Date(ay, am - 1, ad, 12).getTime()) / DAY_MS,
  )
}

/**
 * Compara los hábitos de las últimas `windowDays` vs las `windowDays` previas.
 * Métricas de conteo (días): entrenos, proteína-en-meta, déficit, registro
 * (días con comida). Más el delta de peso. Las que dependen de una meta
 * (proteína/déficit) se omiten si no hay target — la UI las muestra como
 * invitación, nunca inventa.
 */
/* ─── Body Engine (Epic 02) · composición + comparador de fotos ────────── */

export type CompositionMetricKey = 'body_fat_pct' | 'lean_body_mass_kg' | 'bmi'

/** Una card de composición: valor actual + delta vs la primera medición de la
 *  ventana. Solo se emite si la métrica tiene AL MENOS un valor (sin cascarones
 *  vacíos: la ingesta wearable es opcional). */
export type CompositionMetric = {
  key: CompositionMetricKey
  current: number
  /** null con una sola medición (no hay contra qué comparar). */
  delta: number | null
  lastDate: string
}

/** Resume la serie de composición en cards (grasa / masa magra / IMC).
 *  Puro: el orden de entrada es ascendente por día (como lo da la api). */
export function compositionSummary(rows: readonly BodyComposition[]): CompositionMetric[] {
  const keys: CompositionMetricKey[] = ['body_fat_pct', 'lean_body_mass_kg', 'bmi']
  const out: CompositionMetric[] = []
  for (const key of keys) {
    const serie = rows.filter((r) => r[key] != null)
    const last = serie[serie.length - 1]
    if (!last) continue
    const first = serie[0]
    const current = last[key] as number
    const delta =
      first && first !== last ? Number((current - (first[key] as number)).toFixed(1)) : null
    out.push({ key, current: Number(current.toFixed(1)), delta, lastDate: last.day_date })
  }
  return out
}

/**
 * Fusiona las DOS fuentes de composición (F0 · Progress 3.0): check-ins
 * manuales/del coach + ingesta wearable, en una serie por día con el shape que
 * ya consumen las cards y el insight engine. El CHECK-IN GANA el día en los
 * campos que trae (es la medición deliberada); el wearable rellena lo que el
 * manual no midió. Puro y testeable.
 */
export function mergeComposition(
  checkins: readonly BodyCheckin[],
  wearable: readonly BodyComposition[],
): BodyComposition[] {
  const byDay = new Map<string, BodyComposition>()
  for (const w of wearable) byDay.set(w.day_date, { ...w })
  for (const c of checkins) {
    const base = byDay.get(c.measured_on) ?? {
      day_date: c.measured_on,
      body_fat_pct: null,
      lean_body_mass_kg: null,
      bmi: null,
    }
    byDay.set(c.measured_on, {
      ...base,
      body_fat_pct: c.body_fat_pct ?? base.body_fat_pct,
      bmi: c.bmi ?? base.bmi,
      // lean_body_mass_kg es métrica del wearable; el músculo del check-in
      // (muscle_kg, escala InBody) es OTRA métrica — no se equiparan (honestidad).
    })
  }
  return [...byDay.values()].sort((a, b) => (a.day_date < b.day_date ? -1 : 1))
}

/** Punto de una serie de composición: día + valor. */
export type SeriesPoint = { day: string; value: number }

export type CompositionSeriesKey = 'body_fat_pct' | 'muscle_kg' | 'water_pct' | 'bmi' | 'lean_kg'

/**
 * Series por métrica de composición (F2 · Cuerpo): fusiona check-ins (ganan el
 * día) + wearable en una serie ascendente POR MÉTRICA, para cards con sparkline
 * y delta primera→última. `muscle_kg` (InBody, check-ins) y `lean_kg` (HealthKit,
 * wearable) se mantienen como series SEPARADAS — no son la misma métrica. Puro.
 */
export function compositionSeries(
  checkins: readonly BodyCheckin[],
  wearable: readonly BodyComposition[],
): Record<CompositionSeriesKey, SeriesPoint[]> {
  const out: Record<CompositionSeriesKey, Map<string, number>> = {
    body_fat_pct: new Map(),
    muscle_kg: new Map(),
    water_pct: new Map(),
    bmi: new Map(),
    lean_kg: new Map(),
  }
  for (const w of wearable) {
    if (w.body_fat_pct != null) out.body_fat_pct.set(w.day_date, w.body_fat_pct)
    if (w.lean_body_mass_kg != null) out.lean_kg.set(w.day_date, w.lean_body_mass_kg)
    if (w.bmi != null) out.bmi.set(w.day_date, w.bmi)
  }
  for (const c of checkins) {
    // El check-in GANA el día (medición deliberada).
    if (c.body_fat_pct != null) out.body_fat_pct.set(c.measured_on, c.body_fat_pct)
    if (c.muscle_kg != null) out.muscle_kg.set(c.measured_on, c.muscle_kg)
    if (c.water_pct != null) out.water_pct.set(c.measured_on, c.water_pct)
    if (c.bmi != null) out.bmi.set(c.measured_on, c.bmi)
  }
  const toSeries = (m: Map<string, number>): SeriesPoint[] =>
    [...m.entries()]
      .map(([day, value]) => ({ day, value }))
      .sort((a, b) => (a.day < b.day ? -1 : 1))
  return {
    body_fat_pct: toSeries(out.body_fat_pct),
    muscle_kg: toSeries(out.muscle_kg),
    water_pct: toSeries(out.water_pct),
    bmi: toSeries(out.bmi),
    lean_kg: toSeries(out.lean_kg),
  }
}

/* ─── Comparador rápido de mediciones (F3 · mockup dueña) ──────────────── */

export type CheckinDeltaKey =
  | 'weight_kg'
  | 'body_fat_pct'
  | 'muscle_kg'
  | 'water_pct'
  | 'visceral_fat_index'
  | 'bmi'

export type CheckinDelta = {
  key: CheckinDeltaKey
  a: number
  b: number
  delta: number
}

/** Los "cambios principales" entre dos check-ins (A = antes, B = después):
 *  solo métricas presentes en AMBOS (no se compara contra un hueco). Puro.
 *  Sin edad metabólica (decisión producto: duele más de lo que informa). */
export function compareCheckins(a: BodyCheckin, b: BodyCheckin): CheckinDelta[] {
  const keys: CheckinDeltaKey[] = [
    'weight_kg',
    'body_fat_pct',
    'muscle_kg',
    'water_pct',
    'visceral_fat_index',
    'bmi',
  ]
  const out: CheckinDelta[] = []
  for (const key of keys) {
    const va = a[key]
    const vb = b[key]
    if (va == null || vb == null) continue
    out.push({ key, a: va, b: vb, delta: Number((vb - va).toFixed(1)) })
  }
  return out
}

/**
 * La SÍNTESIS del comparador (feedback usuaria: "no necesito seis flechas para
 * saber que recaí; necesito saber qué rescato"). Separa los hechos duros de los
 * rescates y los nombra en UNA frase honesta, de su lado. Determinística.
 *
 * Dirección "a favor": músculo/agua subiendo, grasa/visceral/peso/IMC bajando.
 * Las seis flechas ↑ idénticas hacían que la ganancia de músculo se leyera
 * igual que la subida de grasa ("subió×6 = fallaste×6").
 */
/** ¿Este cambio se movió A FAVOR? (músculo/agua subiendo; grasa/visceral/
 *  peso/IMC bajando). La MISMA regla alimenta la síntesis y el análisis. */
export function isFavorableDelta(key: CheckinDeltaKey, delta: number): boolean {
  if (delta === 0) return false
  const upIsGood = key === 'muscle_kg' || key === 'water_pct'
  return upIsGood ? delta > 0 : delta < 0
}

/** Separa los cambios en rescates (a favor) y hechos duros. */
export function compareBuckets(rows: readonly CheckinDelta[]): {
  gains: CheckinDelta[]
  hard: CheckinDelta[]
} {
  const gains: CheckinDelta[] = []
  const hard: CheckinDelta[] = []
  for (const r of rows) {
    if (r.delta === 0) continue
    ;(isFavorableDelta(r.key, r.delta) ? gains : hard).push(r)
  }
  return { gains, hard }
}

/** La frase honesta (hechos duros + rescates). `rescueCloser: false` deja los
 *  hechos sin el cierre "no empiezas de cero" — la frase-rescate vive UNA vez
 *  por scroll (en el comparador); repetida sonaba a plantilla (uxui). */
export function compareSynthesis(
  rows: readonly CheckinDelta[],
  opts: { rescueCloser?: boolean } = {},
): string | null {
  const rescueCloser = opts.rescueCloser ?? true
  if (rows.length === 0) return null
  // Cada hecho lleva su tipo EXPLÍCITO: los sustantivos se listan tras
  // "Subió" ("tu peso, tu grasa"); las frases con verbo propio van aparte.
  // (Antes se adivinaba por prefijo "tu " y "tu músculo bajó" se colaba en
  // medio de la lista: "Subió tu peso, tu músculo bajó, tu visceral…")
  type Fact = { kind: 'noun' | 'phrase'; text: string }
  const rose: Fact[] = [] // hechos duros (en la dirección difícil)
  const gains: string[] = [] // rescates (a su favor)
  for (const r of rows) {
    if (r.delta === 0) continue
    switch (r.key) {
      case 'weight_kg':
        if (r.delta > 0) rose.push({ kind: 'noun', text: 'tu peso' })
        else gains.push('bajaste peso')
        break
      case 'body_fat_pct':
        if (r.delta > 0) rose.push({ kind: 'noun', text: 'tu grasa' })
        else gains.push('bajaste grasa')
        break
      case 'visceral_fat_index':
        if (r.delta > 0) rose.push({ kind: 'noun', text: 'tu visceral' })
        else gains.push('bajó tu visceral')
        break
      case 'bmi':
        if (r.delta > 0) rose.push({ kind: 'noun', text: 'tu IMC' })
        else gains.push('bajó tu IMC')
        break
      case 'muscle_kg':
        if (r.delta > 0) gains.push('ganaste músculo')
        else rose.push({ kind: 'phrase', text: 'tu músculo bajó' })
        break
      case 'water_pct':
        if (r.delta > 0) gains.push('subió tu agua')
        else rose.push({ kind: 'phrase', text: 'tu agua bajó' })
        break
    }
  }
  const list = (xs: string[]) =>
    xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`
  const roseNouns = rose.filter((x) => x.kind === 'noun').map((x) => x.text)
  const roseVerbs = rose.filter((x) => x.kind === 'phrase').map((x) => x.text)
  const roseSentence =
    roseNouns.length > 0
      ? `Subió ${list(roseNouns)}${roseVerbs.length ? `; ${list(roseVerbs)}` : ''}`
      : roseVerbs.length > 0
        ? list(roseVerbs).charAt(0).toUpperCase() + list(roseVerbs).slice(1)
        : ''

  if (rose.length > 0 && gains.length > 0) {
    return rescueCloser
      ? `${roseSentence}. También ${list(gains)}: no empiezas de cero.`
      : `${roseSentence}. También ${list(gains)}.`
  }
  if (gains.length > 0) {
    return `Entre estas fechas, todo se movió a tu favor: ${list(gains)}.`
  }
  if (rose.length > 0) {
    return `${roseSentence}. Es tu punto de partida, en números reales.`
  }
  return null
}

/**
 * La lectura de las cards de composición (target-user: "cuatro flechas hacia
 * arriba y yo adivinando cuáles celebrar"). Convierte las series primera→última
 * en deltas y REUSA compareSynthesis: la misma frase honesta del comparador
 * (hechos duros + rescates), una sola voz en todo Cuerpo.
 */
export function compositionSynthesis(
  series: Record<CompositionSeriesKey, SeriesPoint[]>,
): string | null {
  // Sin IMC: salió de las cards (vive solo en la Tabla completa, su hogar
  // natural) y la frase no menciona lo que la sección no muestra.
  const keys: { from: CompositionSeriesKey; to: CheckinDeltaKey }[] = [
    { from: 'body_fat_pct', to: 'body_fat_pct' },
    { from: 'muscle_kg', to: 'muscle_kg' },
    { from: 'water_pct', to: 'water_pct' },
  ]
  const rows: CheckinDelta[] = []
  for (const k of keys) {
    const s = series[k.from]
    const first = s[0]
    const last = s[s.length - 1]
    if (!first || !last || s.length < 2) continue
    rows.push({
      key: k.to,
      a: first.value,
      b: last.value,
      delta: Number((last.value - first.value).toFixed(1)),
    })
  }
  // Sin cierre-rescate: aquí solo hechos; "no empiezas de cero" vive en el
  // comparador (una vez por scroll).
  return compareSynthesis(rows, { rescueCloser: false })
}

/* ─── Serie genérica de una métrica de check-in (Epic 08 · F1) ───────────
 *
 * Para los detalles por métrica que compositionSeries no cubre (visceral,
 * IMC como serie propia): la columna numérica de body_checkins como
 * {day, value}, ascendente, sin nulls.
 */
export function checkinSeries(
  checkins: readonly BodyCheckin[],
  key: keyof BodyCheckin,
): SeriesPoint[] {
  return checkins
    .filter((c) => typeof c[key] === 'number')
    .map((c) => ({ day: c.measured_on, value: c[key] as number }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
}

/* ─── Tabla completa de mediciones (la tabla del coach, decisión dueña) ──
 *
 * El expediente crudo: filas = métricas, columnas = fechas. Sin semáforo (el
 * rojo ×4 dolía: "reprobada, reprobada..."), sin frases, sin score. La única
 * mejora vs el Excel: la mini-tendencia por fila ("que la fila me deje ver
 * hacia dónde va — mi 66.8 de en medio es mi prueba de que puedo volver").
 */

export type TableRow = {
  key: string
  label: string
  unit: string
  /** Un valor por fecha (null = no medido ese día). */
  values: (number | null)[]
  /** La serie sin nulls, para la mini-tendencia. */
  spark: number[]
}

export type TableGroup = { title: string; rows: TableRow[] }

/** Una columna = un check-in; day+source lo identifican para editarlo. */
export type TableCol = { day: string; source: BodyCheckin['source'] }

export type CheckinTable = { cols: TableCol[]; groups: TableGroup[] }

const TABLE_METRICS: { group: string; key: keyof BodyCheckin; label: string; unit: string }[] = [
  { group: 'Básicos', key: 'weight_kg', label: 'Peso', unit: 'kg' },
  { group: 'Básicos', key: 'bmi', label: 'IMC', unit: '' },
  { group: 'Básicos', key: 'bmr_kcal', label: 'TMB', unit: 'kcal' },
  { group: 'Básicos', key: 'water_pct', label: 'Agua', unit: '%' },
  { group: 'Básicos', key: 'bone_mass_kg', label: 'M. ósea', unit: 'kg' },
  { group: 'Básicos', key: 'metabolic_age', label: 'Edad metab.', unit: 'años' },
  { group: 'Básicos', key: 'visceral_fat_index', label: 'Visceral', unit: '' },
  { group: 'Músculo', key: 'muscle_kg', label: 'Total', unit: 'kg' },
  { group: 'Músculo', key: 'muscle_arm_right_kg', label: 'Brazo der', unit: 'kg' },
  { group: 'Músculo', key: 'muscle_arm_left_kg', label: 'Brazo izq', unit: 'kg' },
  { group: 'Músculo', key: 'muscle_trunk_kg', label: 'Tronco', unit: 'kg' },
  { group: 'Músculo', key: 'muscle_leg_right_kg', label: 'Pierna der', unit: 'kg' },
  { group: 'Músculo', key: 'muscle_leg_left_kg', label: 'Pierna izq', unit: 'kg' },
  { group: 'Grasa', key: 'body_fat_pct', label: 'Total', unit: '%' },
  { group: 'Grasa', key: 'fat_arm_right_pct', label: 'Brazo der', unit: '%' },
  { group: 'Grasa', key: 'fat_arm_left_pct', label: 'Brazo izq', unit: '%' },
  { group: 'Grasa', key: 'fat_trunk_pct', label: 'Tronco', unit: '%' },
  { group: 'Grasa', key: 'fat_leg_right_pct', label: 'Pierna der', unit: '%' },
  { group: 'Grasa', key: 'fat_leg_left_pct', label: 'Pierna izq', unit: '%' },
  { group: 'Medidas', key: 'neck_cm', label: 'Cuello', unit: 'cm' },
  { group: 'Medidas', key: 'chest_cm', label: 'Pecho', unit: 'cm' },
  { group: 'Medidas', key: 'waist_cm', label: 'Cintura', unit: 'cm' },
  { group: 'Medidas', key: 'abdomen_cm', label: 'Abdomen', unit: 'cm' },
  { group: 'Medidas', key: 'hips_cm', label: 'Caderas', unit: 'cm' },
  { group: 'Medidas', key: 'arm_right_cm', label: 'Brazo der', unit: 'cm' },
  { group: 'Medidas', key: 'arm_left_cm', label: 'Brazo izq', unit: 'cm' },
  { group: 'Medidas', key: 'thigh_right_cm', label: 'Muslo der', unit: 'cm' },
  { group: 'Medidas', key: 'thigh_left_cm', label: 'Muslo izq', unit: 'cm' },
  { group: 'Medidas', key: 'calf_right_cm', label: 'Pantorrilla der', unit: 'cm' },
  { group: 'Medidas', key: 'calf_left_cm', label: 'Pantorrilla izq', unit: 'cm' },
]

/** Arma la tabla desde los check-ins (ascendentes). Solo filas con ≥1 valor y
 *  grupos con ≥1 fila — el expediente muestra lo medido, no cascarones. */
export function checkinTable(checkins: readonly BodyCheckin[]): CheckinTable {
  const sorted = [...checkins].sort((x, y) => (x.measured_on < y.measured_on ? -1 : 1))
  const cols = sorted.map((c) => ({ day: c.measured_on, source: c.source }))
  const groups: TableGroup[] = []
  for (const m of TABLE_METRICS) {
    const values = sorted.map((c) => (c[m.key] as number | null | undefined) ?? null)
    if (values.every((v) => v == null)) continue
    const row: TableRow = {
      key: m.key,
      label: m.label,
      unit: m.unit,
      values,
      spark: values.filter((v): v is number => v != null),
    }
    const g = groups.find((x) => x.title === m.group)
    if (g) g.rows.push(row)
    else groups.push({ title: m.group, rows: [row] })
  }
  return { cols, groups }
}

/* ─── Evolución por zona (F4 · mockup dueña) ───────────────────────────── */

export type ZoneKey = 'arms' | 'trunk' | 'legs'

export type ZoneEvolution = {
  key: ZoneKey
  /** % de grasa de la zona en el primer y último check-in con dato. */
  first: number
  last: number
  delta: number
}

/** Promedio de los lados presentes (izq/der); null si ninguno. */
function sideAvg(a: number | null | undefined, b: number | null | undefined): number | null {
  const vals = [a, b].filter((v): v is number => v != null)
  if (vals.length === 0) return null
  return Number((vals.reduce((x, y) => x + y, 0) / vals.length).toFixed(1))
}

/**
 * Evolución del % de grasa POR ZONA (brazos = promedio izq/der, tronco,
 * piernas = promedio izq/der) entre el primer y el último check-in que traen
 * la zona. Puro. La zona de mayor |cambio| es la observación — un HECHO
 * ("tu tronco fue donde más cambió"), nunca un elogio direccional
 * ('excelente trabajo' = juicio simétrico implícito · benchmark).
 */
export function zoneEvolution(checkins: readonly BodyCheckin[]): {
  zones: ZoneEvolution[]
  highlight: ZoneKey | null
} {
  const zoneOf = (c: BodyCheckin): Partial<Record<ZoneKey, number>> => {
    const out: Partial<Record<ZoneKey, number>> = {}
    const arms = sideAvg(c.fat_arm_right_pct, c.fat_arm_left_pct)
    const legs = sideAvg(c.fat_leg_right_pct, c.fat_leg_left_pct)
    if (arms != null) out.arms = arms
    if (c.fat_trunk_pct != null) out.trunk = c.fat_trunk_pct
    if (legs != null) out.legs = legs
    return out
  }
  const zones: ZoneEvolution[] = []
  for (const key of ['arms', 'trunk', 'legs'] as ZoneKey[]) {
    const serie = checkins
      .map((c) => ({ day: c.measured_on, v: zoneOf(c)[key] }))
      .filter((p): p is { day: string; v: number } => p.v != null)
      .sort((a, b) => (a.day < b.day ? -1 : 1))
    const first = serie[0]
    const last = serie[serie.length - 1]
    if (!first || !last || serie.length < 2) continue
    zones.push({ key, first: first.v, last: last.v, delta: Number((last.v - first.v).toFixed(1)) })
  }
  let highlight: ZoneKey | null = null
  let best = 0
  for (const z of zones) {
    if (Math.abs(z.delta) > best) {
      best = Math.abs(z.delta)
      highlight = z.key
    }
  }
  return { zones, highlight }
}

/** Las fechas (YYYY-MM-DD, ascendentes, únicas) con foto de un ángulo. */
export function photoDatesFor(photos: readonly TimelinePhoto[], angle: PhotoAngle): string[] {
  const days = photos.filter((p) => p.angle === angle).map((p) => p.taken_at.slice(0, 10))
  return [...new Set(days)].sort()
}

/** La foto de un ángulo en una fecha dada (la última del día si hay varias). */
export function photoAt(
  photos: readonly TimelinePhoto[],
  angle: PhotoAngle,
  day: string,
): TimelinePhoto | null {
  const match = photos.filter((p) => p.angle === angle && p.taken_at.slice(0, 10) === day)
  return match[match.length - 1] ?? null
}

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
