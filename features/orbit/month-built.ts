/*
 * Órbita · Mes — "¿Qué estoy construyendo con lo que repito?".
 *
 * Lógica pura y DETERMINÍSTICA (sin IA) sobre ~30 días de daily_signals. Tres
 * piezas:
 *   · buildMonthBuilt   → "Esto construiste": conteos acumulados (la prueba
 *                         tangible de "lo construí yo").
 *   · detectMonthPatterns → "Lo que descubrimos": patrones REALES con su
 *                         evidencia visual (barras). No inventa correlaciones:
 *                         cada patrón nace de contar lo registrado, y solo
 *                         aparece si el dato lo sostiene (guardas de honestidad).
 *   · biggestWin        → "Tu mayor victoria": la consistencia, celebrada.
 *
 * Toda comparación de día-de-semana se parsea en UTC (como el resto del repo)
 * para no correrse de día por timezone.
 */
import {
  detectProteinConsistency,
  detectSleepConsistency,
  detectTrainingConsistency,
} from '@/features/patterns/consistency'

import type { DailySignals } from './api'

/** Vasos para considerar el agua "alcanzada" ese día (meta diaria). */
export const WATER_GOAL_GLASSES = 8

const WD_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const WD_FULL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Día de la semana 0=lunes … 6=domingo (UTC, timezone-independiente). */
function weekdayMon(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7
}

/** ¿El día trae alguna señal? (las filas existen solo para días registrados,
 *  pero lo verificamos por si acaso). */
function appeared(s: DailySignals): boolean {
  return (
    s.trained === true ||
    s.rested === true ||
    (s.meal_count ?? 0) > 0 ||
    s.sleep_minutes != null ||
    s.energy != null ||
    s.mood != null ||
    s.stress != null ||
    s.motivation != null ||
    (s.water_glasses ?? 0) > 0 ||
    s.on_period === true
  )
}

function loggedDays(signals: readonly DailySignals[]): DailySignals[] {
  return signals.filter((s) => s.day != null && appeared(s))
}

/* ── "Esto construiste" — conteos acumulados ─────────────────────────── */

export type MonthBuilt = {
  trainedDays: number
  foodDays: number
  proteinAvgG: number | null
  waterGoalDays: number
  sleepAvgH: number | null
  daysAppeared: number
}

export function buildMonthBuilt(
  signals: readonly DailySignals[],
  opts?: { waterGoalGlasses?: number },
): MonthBuilt {
  const goal = opts?.waterGoalGlasses ?? WATER_GOAL_GLASSES
  const days = loggedDays(signals)
  let trainedDays = 0
  let foodDays = 0
  let proteinSum = 0
  let proteinN = 0
  let waterGoalDays = 0
  let sleepSum = 0
  let sleepN = 0
  for (const s of days) {
    if (s.trained) trainedDays += 1
    if ((s.meal_count ?? 0) > 0) foodDays += 1
    if (s.protein_g != null) {
      proteinSum += s.protein_g
      proteinN += 1
    }
    if ((s.water_glasses ?? 0) >= goal) waterGoalDays += 1
    if (s.sleep_minutes != null) {
      sleepSum += s.sleep_minutes
      sleepN += 1
    }
  }
  return {
    trainedDays,
    foodDays,
    proteinAvgG: proteinN ? Math.round(proteinSum / proteinN) : null,
    waterGoalDays,
    sleepAvgH: sleepN ? Math.round((sleepSum / sleepN / 60) * 10) / 10 : null,
    daysAppeared: days.length,
  }
}

/* ── "Lo que descubrimos" — patrones reales + evidencia ──────────────── */

export type EvidenceBar = {
  label: string
  value: number
  /** Denominador de la barra (días de la ventana). Cuando está presente, el
   *  modal muestra "value / total" para anclar el número. Ausente en barras
   *  relativas (día-de-semana), que se comparan entre sí. */
  total?: number
  highlight?: boolean
  /** Clave de dimensión para tintar la barra (hábitos); ausente en barras de
   *  día-de-semana, que van en oro neutro. */
  colorKey?: string
}
export type MonthPattern = {
  id: string
  title: string
  evidence: { bars: EvidenceBar[]; caption: string; unit: string }
}

/** Mínimo de días registrados para arriesgar cualquier patrón — debajo de esto
 *  el mes apenas se forma y un "patrón" sería ruido. */
const PATTERN_MIN_DAYS = 8

type Habit = { key: string; label: string; has: (s: DailySignals) => boolean }
const HABITS: readonly Habit[] = [
  { key: 'comida', label: 'Comida', has: (s) => (s.meal_count ?? 0) > 0 },
  { key: 'cuerpo', label: 'Movimiento', has: (s) => s.trained === true || s.rested === true },
  { key: 'sueno', label: 'Sueño', has: (s) => s.sleep_minutes != null },
  { key: 'energia', label: 'Energía', has: (s) => s.energy != null },
  { key: 'agua', label: 'Agua', has: (s) => (s.water_glasses ?? 0) > 0 },
]

function habitCounts(
  days: readonly DailySignals[],
): { key: string; label: string; count: number }[] {
  return HABITS.map((h) => ({
    key: h.key,
    label: h.label,
    count: days.filter((s) => h.has(s)).length,
  }))
}

function weekdayCounts(days: readonly DailySignals[]): number[] {
  const wd = [0, 0, 0, 0, 0, 0, 0]
  for (const s of days) {
    const i = weekdayMon(s.day!)
    wd[i] = (wd[i] ?? 0) + 1
  }
  return wd
}

/* Patrones POSITIVOS del MOTOR de consistencia (features/patterns/consistency)
 * — la MISMA lógica del reveal semanal de Hoy, aquí sobre la ventana del mes.
 * "Lo que descubrimos" ya no inventa su propia constancia: la consume del motor
 * (un solo origen de verdad, testeado). Umbral mensual propio. */
const MONTH_CONSISTENT_MIN = 8
const MONTH_WINDOW_DAYS = 32

/** Fecha más reciente (medianoche local) como ms — ancla de la ventana de los
 *  detectores, derivada de los datos (no de `new Date()`) → determinística. */
function latestDayMs(days: readonly DailySignals[]): number | null {
  let max: string | null = null
  for (const s of days) if (s.day && (max == null || s.day > max)) max = s.day
  return max != null ? new Date(`${max}T00:00:00`).getTime() : null
}

export type MonthConsistency = {
  protein: { detected: boolean; count: number }
  training: { detected: boolean; count: number }
  sleep: { detected: boolean; count: number }
}

/** Corre los detectores del motor (proteína/movimiento/sueño) sobre el mes. */
export function monthConsistency(
  signals: readonly DailySignals[],
  opts?: { proteinTarget?: number | null },
): MonthConsistency {
  const days = loggedDays(signals)
  const nowMs = latestDayMs(days)
  const empty = { detected: false, count: 0 }
  if (nowMs == null) return { protein: empty, training: empty, sleep: empty }
  const win = { windowDays: MONTH_WINDOW_DAYS, minDays: MONTH_CONSISTENT_MIN }
  const targetG = opts?.proteinTarget ?? 0
  const p = detectProteinConsistency(
    days
      .filter((s) => s.protein_g != null)
      .map((s) => ({ date: s.day!, proteinG: s.protein_g!, targetG })),
    nowMs,
    win,
  )
  const t = detectTrainingConsistency(
    days.filter((s) => s.trained === true).map((s) => s.day!),
    nowMs,
    win,
  )
  const sl = detectSleepConsistency(
    days
      .filter((s) => s.sleep_minutes != null)
      .map((s) => ({ date: s.day!, minutes: s.sleep_minutes! })),
    nowMs,
    win,
  )
  return {
    protein: { detected: p.detected, count: p.count },
    training: { detected: t.detected, count: t.count },
    sleep: { detected: sl.detected, count: sl.count },
  }
}

export function detectMonthPatterns(
  signals: readonly DailySignals[],
  opts?: { proteinTarget?: number | null },
): MonthPattern[] {
  const days = loggedDays(signals)
  if (days.length < PATTERN_MIN_DAYS) return []
  const out: MonthPattern[] = []

  // 1 · Patrones del MOTOR — la constancia positiva (proteína/movimiento/sueño)
  // viene de features/patterns/consistency, no de un cálculo paralelo. Evidencia
  // = los conteos del motor (el conteo "va al frente" en los positivos, ok).
  const c = monthConsistency(signals, { proteinTarget: opts?.proteinTarget })
  // El motor cuenta días presentes en una ventana de MONTH_WINDOW_DAYS (~mes),
  // así que ese es el denominador correcto para anclar el número ("18 / 32").
  const consistencyBars = (highlight: string): EvidenceBar[] => [
    {
      label: 'Proteína',
      value: c.protein.count,
      total: MONTH_WINDOW_DAYS,
      colorKey: 'proteina',
      highlight: highlight === 'proteina',
    },
    {
      label: 'Movimiento',
      value: c.training.count,
      total: MONTH_WINDOW_DAYS,
      colorKey: 'cuerpo',
      highlight: highlight === 'cuerpo',
    },
    {
      label: 'Sueño',
      value: c.sleep.count,
      total: MONTH_WINDOW_DAYS,
      colorKey: 'sueno',
      highlight: highlight === 'sueno',
    },
  ]
  const consistencyCaption = 'Días en que cada señal estuvo presente.'
  if (c.protein.detected) {
    out.push({
      id: 'consistent-protein',
      title: 'Tu proteína se mantuvo consistente este mes.',
      evidence: { bars: consistencyBars('proteina'), caption: consistencyCaption, unit: 'días' },
    })
  }
  if (c.training.detected) {
    out.push({
      id: 'consistent-training',
      title: 'El movimiento fue una de tus constantes este mes.',
      evidence: { bars: consistencyBars('cuerpo'), caption: consistencyCaption, unit: 'días' },
    })
  }
  if (c.sleep.detected) {
    out.push({
      id: 'consistent-sleep',
      title: 'Tu sueño se mantuvo estable este mes.',
      evidence: { bars: consistencyBars('sueno'), caption: consistencyCaption, unit: 'días' },
    })
  }

  // 2 · "Lo que menos apareció" — observación local de Mes (el motor no tiene
  // un patrón de "menos constante"; lo mantenemos como nota de crecimiento).
  const habits = habitCounts(days).filter((h) => h.count > 0)
  if (habits.length >= 3) {
    const sorted = [...habits].sort((a, b) => b.count - a.count)
    const top = sorted[0]!
    const low = sorted[sorted.length - 1]!
    const habitBars = (highlight: string): EvidenceBar[] =>
      [...habits]
        .sort((a, b) => b.count - a.count)
        .map((h) => ({
          label: h.label,
          value: h.count,
          highlight: h.label === highlight,
          colorKey: h.key,
        }))
    if (low.count < top.count) {
      out.push({
        id: 'habit-low',
        // Sujeto = la señal, no la usuaria; "silenciosa" observa el espacio sin
        // señalar carencia (manifesto-reviewer + voice-and-copy).
        title: `${low.label} fue tu señal más silenciosa este mes.`,
        evidence: {
          bars: habitBars(low.label),
          caption: 'Días en que cada señal estuvo presente.',
          unit: 'días',
        },
      })
    }
  }

  // 3 · Entre semana vs fin de semana.
  const wd = weekdayCounts(days)
  const weekdaySum = wd[0]! + wd[1]! + wd[2]! + wd[3]! + wd[4]!
  const weekendSum = wd[5]! + wd[6]!
  const avgWeekday = weekdaySum / 5
  const avgWeekend = weekendSum / 2
  const wdBars = (highlights: number[]): EvidenceBar[] =>
    wd.map((v, i) => ({ label: WD_SHORT[i]!, value: v, highlight: highlights.includes(i) }))
  if (avgWeekday >= avgWeekend * 1.3 && weekdaySum >= 4) {
    out.push({
      id: 'weekday',
      title: 'Apareces más entre semana.',
      evidence: {
        bars: wdBars([0, 1, 2, 3, 4]),
        caption: 'Días que apareciste, por día de la semana.',
        unit: 'días',
      },
    })
  } else if (avgWeekend >= avgWeekday * 1.3 && weekendSum >= 2) {
    out.push({
      id: 'weekend',
      title: 'Apareces más en fin de semana.',
      evidence: {
        bars: wdBars([5, 6]),
        caption: 'Días que apareciste, por día de la semana.',
        unit: 'días',
      },
    })
  }

  // 4 · Tus mejores días — los días de la semana en que más apareces.
  const max = Math.max(...wd)
  if (max >= 2) {
    const tops = wd
      .map((v, i) => ({ i, v }))
      .filter((x) => x.v === max)
      .map((x) => x.i)
      .slice(0, 2)
    // Solo si no es un empate masivo (≤ 2 días pico) y destaca sobre el resto.
    const rest = wd.filter((_, i) => !tops.includes(i))
    const avgRest = rest.length ? rest.reduce((a, b) => a + b, 0) / rest.length : 0
    if (tops.length <= 2 && max > avgRest) {
      const names = tops.map((i) => WD_FULL[i]!)
      const title =
        names.length === 2
          ? `Tus mejores días suelen ser ${names[0]} y ${names[1]}.`
          : `Tu mejor día suele ser ${names[0]}.`
      out.push({
        id: 'best-days',
        title,
        evidence: {
          bars: wdBars(tops),
          caption: 'Días que apareciste, por día de la semana.',
          unit: 'días',
        },
      })
    }
  }

  // El tono abre en positivo: "lo que menos apareció" (habit-low) nunca va
  // primero. Orden estable que solo lo empuja al final (manifiesto: aspiracional,
  // sin que la primera lectura sobre ti sea una carencia).
  return out.sort((a, b) => (a.id === 'habit-low' ? 1 : 0) - (b.id === 'habit-low' ? 1 : 0))
}

/* ── "Tu mayor victoria" — la consistencia, celebrada ────────────────── */

export type MonthWin = { headline: string; line: string }

export function biggestWin(signals: readonly DailySignals[]): MonthWin | null {
  const days = loggedDays(signals).length
  if (days === 0) return null
  // Voz Stelar: observa, no etiqueta. "Superpoder" sonaba a autoayuda; "ritmo
  // real" validaba de más. Constancia > consistencia (manifiesto).
  const line =
    days >= 20
      ? 'Tu constancia habló este mes.'
      : days >= 12
        ? 'Un ritmo empieza a aparecer.'
        : 'Cada día que registras, suma.'
  // "Estuviste presente" en vez de "Apareciste": cálido y claro a la vez (qué
  // = registraste alguna señal ese día). voice-and-copy.
  return {
    headline: `Estuviste presente ${days} ${days === 1 ? 'día' : 'días'} este mes.`,
    line,
  }
}
