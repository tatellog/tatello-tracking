/*
 * Progress Insight Engine (Epic 03 · docs/progress-3.0/) — el gemelo del motor
 * de Órbita, pero responde QUÉ CAMBIÓ, nunca por qué (el porqué es Órbita).
 * TODO determinístico, cero IA: la IA de Epic 04 solo EXPLICA estos insights.
 *
 * Detecta cruces que la usuaria no ve mirando una métrica a la vez:
 *   · recomposición (peso estable + grasa bajando)
 *   · proteína sostenida + masa magra que se mantiene
 *   · tendencia de peso sostenida (mejora O retroceso — como HECHO, sin culpa)
 *   · evidencia fotográfica que abarca un cambio real
 *
 * PURO (regla de _shared/intelligence/): sin React Native, sin Supabase-client,
 * sin globals de Deno. Corre en Metro y en Deno. Los números de `support` son
 * la ÚNICA fuente que la IA podrá citar (backstop anti-alucinación de Epic 04).
 * Sin culpa: un retroceso se nombra como información, jamás como falla.
 */
import type { DailySignals } from './types.ts'

/* ── Contratos ─────────────────────────────────────────────────────── */

/** Peso de un día (de body_measurements, ya suavizado o crudo — el caller
 *  decide; el motor solo exige orden ascendente por día). */
export type WeightSample = { day: string; kg: number }

/** Composición de un día (de la ingesta wearable). */
export type CompositionSample = {
  day: string
  fatPct: number | null
  leanKg: number | null
}

export type ProgressInsightInput = {
  /** Hoy YYYY-MM-DD (el motor no usa Date.now → determinístico). */
  today: string
  /** Ascendentes por día. */
  weights: readonly WeightSample[]
  composition: readonly CompositionSample[]
  signals: readonly DailySignals[]
  proteinTarget: number | null
  /** Días (YYYY-MM-DD, únicos ascendentes) con foto de progreso. */
  photoDays: readonly string[]
}

/** Un cambio importante detectado. Espeja al `Finding` de Órbita en lo que el
 *  chat guiado necesita (Epic 04): lead/support/contrast/confidence. */
export type ProgressInsight = {
  id: string
  subject: string
  /** La lectura en voz del coach — QUÉ cambió. */
  lead: string
  /** La evidencia con números — lo único que la IA puede citar. */
  support: string
  contrast: string | null
  confidence: number
  relatedMetrics: string[]
  northLink: string | null
}

/* ── Helpers puros ─────────────────────────────────────────────────── */

/** Días entre dos YYYY-MM-DD (positivo si b > a). Mediodía evita DST. */
function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number]
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number]
  const ta = new Date(ay, am - 1, ad, 12).getTime()
  const tb = new Date(by, bm - 1, bd, 12).getTime()
  return Math.round((tb - ta) / 86400000)
}

/** Muestras dentro de los últimos `win` días (por día, string-compare). */
function inWindow<T extends { day: string }>(rows: readonly T[], today: string, win: number): T[] {
  return rows.filter((r) => daysBetween(r.day, today) >= 0 && daysBetween(r.day, today) <= win)
}

/** El peso más cercano a un día (para anclar fotos a la báscula). */
function weightNear(weights: readonly WeightSample[], day: string): WeightSample | null {
  let best: WeightSample | null = null
  let bestDist = Infinity
  for (const w of weights) {
    const d = Math.abs(daysBetween(w.day, day))
    if (d < bestDist) {
      bestDist = d
      best = w
    }
  }
  return best && bestDist <= 7 ? best : null
}

const fmtKg = (n: number): string => `${n.toFixed(1)} kg`
const fmtDelta = (n: number, unit: string): string =>
  `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(1)}${unit}`
const weeksOf = (days: number): number => Math.max(1, Math.round(days / 7))

/* ── Detectores ────────────────────────────────────────────────────── */

const WINDOW_DAYS = 45
/** Peso "estable": el arco completo se movió menos que esto. */
const STABLE_KG = 1.0
/** Grasa "bajó de verdad": al menos esto en puntos porcentuales. */
const FAT_DROP_PP = 0.8
/** Tendencia de peso que vale nombrar (arco total). */
const TREND_KG = 1.0
/** Evidencia mínima temporal para hablar de cambio (no de ruido). */
const MIN_SPAN_DAYS = 21

/** A · RECOMPOSICIÓN — peso estable + grasa bajando. El cambio que la báscula
 *  esconde y que más motiva ver. */
function detectRecomposition(input: ProgressInsightInput): ProgressInsight | null {
  const w = inWindow(input.weights, input.today, WINDOW_DAYS)
  const fat = inWindow(input.composition, input.today, WINDOW_DAYS).filter(
    (c): c is CompositionSample & { fatPct: number } => c.fatPct != null,
  )
  const wFirst = w[0]
  const wLast = w[w.length - 1]
  const fFirst = fat[0]
  const fLast = fat[fat.length - 1]
  if (!wFirst || !wLast || w.length < 3 || daysBetween(wFirst.day, wLast.day) < MIN_SPAN_DAYS)
    return null
  if (!fFirst || !fLast || fat.length < 2 || daysBetween(fFirst.day, fLast.day) < MIN_SPAN_DAYS)
    return null

  const wDelta = wLast.kg - wFirst.kg
  const fatDelta = fLast.fatPct - fFirst.fatPct
  if (Math.abs(wDelta) > STABLE_KG || fatDelta > -FAT_DROP_PP) return null

  const weeks = weeksOf(daysBetween(fFirst.day, fLast.day))
  // Más muestras + más caída = más confianza (cap 90).
  const confidence = Math.min(90, 60 + fat.length * 5 + Math.round(Math.abs(fatDelta) * 5))
  return {
    id: 'recomposition',
    subject: 'tu composición',
    lead: 'Tu peso casi no se movió, pero tu grasa sí bajó. Ese cambio la báscula sola no lo cuenta.',
    support: `Peso ${fmtKg(wFirst.kg)} → ${fmtKg(wLast.kg)} · grasa ${fFirst.fatPct.toFixed(1)}% → ${fLast.fatPct.toFixed(1)}% en ${weeks} semanas.`,
    contrast: null,
    confidence,
    relatedMetrics: ['weight', 'body_fat'],
    northLink: 'Recomponer es avanzar aunque el número se quede quieto.',
  }
}

/** B · PROTEÍNA + MASA MAGRA — sostuviste la proteína y el músculo se quedó
 *  (o subió). La métrica más cuidada del producto, con su evidencia. */
function detectProteinMuscle(input: ProgressInsightInput): ProgressInsight | null {
  if (input.proteinTarget == null || input.proteinTarget <= 0) return null
  const days = input.signals.filter(
    (s) =>
      s.day != null &&
      daysBetween(s.day, input.today) >= 0 &&
      daysBetween(s.day, input.today) <= 30 &&
      s.protein_g != null,
  )
  const met = days.filter((s) => (s.protein_g as number) >= (input.proteinTarget as number))
  if (days.length < 10 || met.length / days.length < 0.5) return null

  const lean = inWindow(input.composition, input.today, WINDOW_DAYS).filter(
    (c): c is CompositionSample & { leanKg: number } => c.leanKg != null,
  )
  const lFirst = lean[0]
  const lLast = lean[lean.length - 1]
  if (!lFirst || !lLast || lean.length < 2 || daysBetween(lFirst.day, lLast.day) < MIN_SPAN_DAYS)
    return null
  const leanDelta = lLast.leanKg - lFirst.leanKg
  if (leanDelta < -0.3) return null // el músculo NO se sostuvo — no hay insight

  const held = leanDelta >= 0.3 ? 'subió' : 'se mantuvo'
  return {
    id: 'protein-muscle',
    subject: 'tu proteína y tu masa magra',
    lead: `Sostuviste tu proteína, y tu masa magra ${held}. Eso es lo que protege el músculo mientras bajas.`,
    support: `Proteína en meta ${met.length} de ${days.length} días · masa magra ${fmtKg(lFirst.leanKg)} → ${fmtKg(lLast.leanKg)}.`,
    contrast: null,
    confidence: Math.min(88, 55 + met.length * 2),
    relatedMetrics: ['protein', 'lean_mass'],
    northLink: 'Perder peso cuidando el músculo es la versión sostenible.',
  }
}

/** C · TENDENCIA DE PESO — el arco sostenido, hacia abajo (mejora) o hacia
 *  arriba (retroceso COMO HECHO: información, jamás culpa). */
function detectWeightTrend(input: ProgressInsightInput): ProgressInsight | null {
  const w = inWindow(input.weights, input.today, WINDOW_DAYS)
  const first = w[0]
  const last = w[w.length - 1]
  if (!first || !last || w.length < 4) return null
  const span = daysBetween(first.day, last.day)
  if (span < MIN_SPAN_DAYS) return null
  const delta = last.kg - first.kg
  if (Math.abs(delta) < TREND_KG) return null

  const weeks = weeksOf(span)
  const down = delta < 0
  return {
    id: 'weight-trend',
    subject: 'tu peso',
    lead: down
      ? `Tu peso lleva ${weeks} semanas bajando de forma sostenida.`
      : `Tu peso subió en estas ${weeks} semanas. Es información, no un juicio.`,
    support: `${fmtKg(first.kg)} → ${fmtKg(last.kg)} (${fmtDelta(delta, ' kg')}) en ${weeks} semanas · ${w.length} mediciones.`,
    contrast: null,
    confidence: Math.min(92, 60 + w.length * 3),
    relatedMetrics: ['weight'],
    northLink: down ? 'Ese ritmo sostenido es exactamente el camino.' : null,
  }
}

/** D · EVIDENCIA FOTOGRÁFICA — tus fotos abarcan un cambio real de peso: hay
 *  un antes/después que vale la pena mirar. */
function detectPhotoEvidence(input: ProgressInsightInput): ProgressInsight | null {
  const firstDay = input.photoDays[0]
  const lastDay = input.photoDays[input.photoDays.length - 1]
  if (!firstDay || !lastDay || daysBetween(firstDay, lastDay) < 30) return null
  const wA = weightNear(input.weights, firstDay)
  const wB = weightNear(input.weights, lastDay)
  if (!wA || !wB) return null
  const delta = wB.kg - wA.kg
  if (Math.abs(delta) < 1.5) return null

  const weeks = weeksOf(daysBetween(firstDay, lastDay))
  return {
    id: 'photo-evidence',
    subject: 'tus fotos',
    lead: 'Entre tu primera foto y la última hay un cambio que ya se puede ver.',
    support: `${fmtDelta(delta, ' kg')} entre tus fotos, con ${weeks} semanas de distancia.`,
    contrast: null,
    confidence: 75,
    relatedMetrics: ['weight', 'photos'],
    northLink: 'La evidencia visual cuenta lo que el número resume.',
  }
}

/* ── El motor ──────────────────────────────────────────────────────── */

/** Umbral de dignidad: por debajo no se muestra (borradores fuera). */
const MIN_CONFIDENCE = 55
/** Cap de insights por pasada (pocos con sentido > muchos con ruido). */
const MAX_INSIGHTS = 3

/** Corre todos los detectores y devuelve los insights dignos, ordenados por
 *  confianza. Determinístico: misma entrada → misma salida. */
export function generateProgressInsights(input: ProgressInsightInput): ProgressInsight[] {
  const all = [
    detectRecomposition(input),
    detectProteinMuscle(input),
    detectWeightTrend(input),
    detectPhotoEvidence(input),
  ].filter((x): x is ProgressInsight => x != null && x.confidence >= MIN_CONFIDENCE)
  return all.sort((a, b) => b.confidence - a.confidence).slice(0, MAX_INSIGHTS)
}

/** Llave de caché para la voz de IA (Epic 04): si lo que se muestra no cambia,
 *  no se regenera. Mismo fnv1a que hashFindings (Órbita). */
export function hashProgressInsights(insights: readonly ProgressInsight[]): string {
  const canon = insights
    .map((i) => `${i.id}|${i.confidence}|${i.subject}|${i.lead}|${i.support}|${i.contrast ?? ''}`)
    .join('~')
  let h = 0x811c9dc5
  for (let i = 0; i < canon.length; i++) {
    h ^= canon.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
