/*
 * Órbita Mes IA · el DETALLE DE INSIGHT como LECTURA GUIADA (no chat).
 *
 * Convierte un patrón del motor (MonthPattern) en una experiencia estructurada
 * de descubrimiento: "Lo que apareció" (headline + evidencia + métrica), la
 * evidencia visual (línea de días), la reflexión guiada, y el siguiente paso.
 * Puro y testeable: no renderiza ni llama IA. Copy Observadora (describe los
 * registros, nunca diagnostica ni aconseja).
 */
import { isDeficitDay } from './deficit'
import { WATER_GOAL_GLASSES, type MonthPattern } from './month-built'
import type { DailySignals } from './api'
import type { PriorReflections } from './reflections'

export type ReflectionOption = { label: string; answer: string }

export type NextStep =
  | { kind: 'explore-other'; label: string }
  | { kind: 'observation'; label: string; observation: string }

export type InsightDetail = {
  id: string
  /** Título del header ("Movimiento"). */
  title: string
  /** Dimensión, para el tinte (deficit/sueno/agua/…). */
  colorKey: string
  /** El hallazgo (headline). */
  headline: string
  /** Explicación corta con el número ("Te moviste 19 de 31 días este mes."). */
  explanation: string
  /** Métrica secundaria ("Continuidad más larga: 11 días"). */
  secondary?: string
  progress: { value: number; total: number }
  /** Encendido = día con la señal presente; apagado = sin ella. */
  evidenceDays: boolean[]
  evidenceCaption: string
  /** "Cerrar el loop": lo que respondió en un mes anterior, si aplica. */
  priorCallback?: string
  reflectionKey: string
  reflectionOptions: ReflectionOption[]
  nextSteps: NextStep[]
}

export type InsightCtx = {
  calorieTarget?: number | null
  proteinTarget?: number | null
}

const SLEEP_ENOUGH_MINUTES = 420
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** ¿Ese día tuvo presente la señal de la dimensión? */
function presenceFor(colorKey: string, ctx: InsightCtx): (s: DailySignals) => boolean {
  switch (colorKey) {
    case 'cuerpo':
      return (s) => s.trained === true
    case 'sueno':
      return (s) => (s.sleep_minutes ?? 0) >= SLEEP_ENOUGH_MINUTES
    case 'agua':
      return (s) => (s.water_glasses ?? 0) >= WATER_GOAL_GLASSES
    case 'proteina':
      return (s) => ctx.proteinTarget != null && (s.protein_g ?? 0) >= ctx.proteinTarget
    case 'deficit':
      return (s) => isDeficitDay(s.calories, ctx.calorieTarget)
    case 'comida':
      return (s) => (s.meal_count ?? 0) > 0
    default:
      return () => false
  }
}

function explanationFor(colorKey: string, value: number, total: number): string {
  switch (colorKey) {
    case 'cuerpo':
      return `Te moviste ${value} de ${total} días este mes.`
    case 'sueno':
      return `Dormiste 7 horas o más ${value} de ${total} noches.`
    case 'agua':
      return `Llegaste a tu meta de agua ${value} de ${total} días.`
    case 'proteina':
      return `Tu proteína estuvo en objetivo ${value} de ${total} días.`
    case 'deficit':
      return `Estuviste en déficit ${value} de ${total} días.`
    case 'comida':
      return `Registraste comida ${value} de ${total} días.`
    default:
      return `Apareció ${value} de ${total} días.`
  }
}

function captionFor(colorKey: string): string {
  const noun =
    colorKey === 'sueno'
      ? 'una noche con buen descanso'
      : colorKey === 'agua'
        ? 'un día que llegaste a tu meta de agua'
        : colorKey === 'proteina'
          ? 'un día que alcanzaste tu proteína'
          : colorKey === 'deficit'
            ? 'un día en déficit'
            : colorKey === 'comida'
              ? 'un día con comida registrada'
              : 'un día con movimiento registrado'
  return `Cada punto encendido representa ${noun}.`
}

/** Racha más larga de días consecutivos con la señal presente. */
export function longestStreak(days: readonly boolean[]): number {
  let best = 0
  let run = 0
  for (const on of days) {
    run = on ? run + 1 : 0
    if (run > best) best = run
  }
  return best
}

const priorCallbackText = (key: string, prior: PriorReflections): string | undefined => {
  const p = prior[key]
  if (!p) return undefined
  const mes = MONTH_NAMES[Number(p.month.slice(5, 7)) - 1] ?? p.month
  if (p.answer === 'nunca') return `En ${mes} esto no lo habías notado.`
  if (p.answer === 'no') return `En ${mes} me dijiste que no lo habías notado.`
  if (p.answer === 'si') return `En ${mes} ya lo sabías.`
  return undefined
}
const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay()
}

/** El siguiente paso: observaciones que la usuaria puede pedir + explorar otro.
 *  Todo con voz Observadora ("En tus registros…"), nunca consejo. */
function buildNextSteps(
  signals: readonly DailySignals[],
  evidenceDays: readonly boolean[],
  colorKey: string,
  ctx: InsightCtx,
): NextStep[] {
  const steps: NextStep[] = []

  // Cuándo pasó — el día de la semana donde más apareció.
  const byWeekday = new Array(7).fill(0)
  signals.forEach((s, i) => {
    if (evidenceDays[i] && s.day) byWeekday[weekdayOf(s.day)]++
  })
  const topWeekday = byWeekday.indexOf(Math.max(...byWeekday))
  if (byWeekday[topWeekday] > 0) {
    steps.push({
      kind: 'observation',
      label: 'Cuándo pasó',
      observation: `En tus registros, esto apareció más los ${WEEKDAYS[topWeekday]}.`,
    })
  }

  // Qué días fueron más constantes — la racha más larga.
  const streak = longestStreak(evidenceDays)
  if (streak >= 2) {
    steps.push({
      kind: 'observation',
      label: 'Qué días fueron más constantes',
      observation: `Esto se repitió ${streak} días seguidos, el tramo más largo que encontré.`,
    })
  }

  // Cómo se relaciona con el déficit — el cruce (omitido si el insight ES déficit).
  if (colorKey !== 'deficit') {
    let overlap = 0
    signals.forEach((s, i) => {
      if (evidenceDays[i] && isDeficitDay(s.calories, ctx.calorieTarget)) overlap++
    })
    if (overlap > 0) {
      steps.push({
        kind: 'observation',
        label: 'Cómo se relaciona con mi déficit',
        observation: `En ${overlap} de esos días también estuviste en déficit. Esto llamó mi atención.`,
      })
    }
  }

  steps.push({ kind: 'explore-other', label: 'Explorar otro hallazgo' })
  return steps
}

/**
 * Construye el detalle estructurado de un patrón. `signals` da la evidencia por
 * día; `prior` cierra el loop (lo que respondió la última vez).
 */
export function buildInsightDetail(
  pattern: MonthPattern,
  signals: readonly DailySignals[],
  ctx: InsightCtx = {},
  prior: PriorReflections = {},
): InsightDetail {
  const colorKey = pattern.evidence.bars[0]?.colorKey ?? 'deficit'
  const pred = presenceFor(colorKey, ctx)
  const evidenceDays = signals.map(pred)
  const value = evidenceDays.filter(Boolean).length
  const total = evidenceDays.length
  const streak = longestStreak(evidenceDays)
  const reflectionKey = `pattern_${pattern.id}`

  return {
    id: pattern.id,
    title: pattern.label,
    colorKey,
    headline: pattern.title,
    explanation: explanationFor(colorKey, value, total),
    secondary: streak >= 2 ? `Continuidad más larga: ${streak} días` : undefined,
    progress: { value, total },
    evidenceDays,
    evidenceCaption: captionFor(colorKey),
    priorCallback: priorCallbackText(reflectionKey, prior),
    reflectionKey,
    reflectionOptions: [
      { label: 'Sí', answer: 'si' },
      { label: 'No', answer: 'no' },
      { label: 'Nunca me había dado cuenta', answer: 'nunca' },
    ],
    nextSteps: buildNextSteps(signals, evidenceDays, colorKey, ctx),
  }
}
