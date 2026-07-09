/*
 * Órbita Mes IA · el MOTOR DE HALLAZGOS (Finding). Puro, determinístico,
 * testeable. La promesa: "hacer visible lo invisible" — no frases genéricas,
 * sino descubrimientos ESPECÍFICOS de SUS datos, con números, confianza y
 * evidencia. La IA solo redacta; los números y la estructura salen de aquí.
 *
 * Cada detector devuelve un `Finding` estructurado (el árbol que la UI
 * renderiza sin inventar nada): título específico + confianza + métrica +
 * evidencia (gráficas mínimas) + metacognición guiada + profundizaciones.
 *
 * Voz Observadora: describe registros ("En tus registros apareció…"), nunca
 * diagnostica ni aconseja. Sin culpa, sin órdenes.
 *
 * LÍMITE conocido: daily_signals es por día (sin hora). Los patrones por hora
 * ("antes de 8:30am", "snack 23:40") requieren timestamps que aún no
 * capturamos → fuera de este motor hasta esa fase.
 */
import { isDeficitDay } from './deficit'
import { WATER_GOAL_GLASSES } from './month-built'
import type { DailySignals } from './api'
import type { PriorReflections } from './reflections'

export type FindingCategory =
  | 'deficit'
  | 'movimiento'
  | 'sueno'
  | 'agua'
  | 'proteina'
  | 'alimentacion'

/** Gráfica mínima de evidencia (no dashboard). */
export type Chart =
  | {
      kind: 'weekdayBars'
      unit: string
      bars: { label: string; value: number; highlight: boolean }[]
    }
  | { kind: 'dotTimeline'; dots: ('off' | 'on' | 'strong')[]; caption?: string }

/** Metacognición guiada (ramifica según la respuesta). */
export type Metacognition = {
  question: string
  options: { label: string; answer: string }[]
  /** answer → lo que Stelar responde. */
  replies: Record<string, string>
  /** Segunda pregunta guiada tras la primera respuesta. */
  follow?: { question: string; options: { label: string; answer: string }[] }
}

export type FollowUp =
  | { kind: 'observation'; label: string; text: string }
  | { kind: 'next'; label: string }

export type Finding = {
  id: string
  category: FindingCategory
  /** 0–100. Cuánto sostuvo el patrón (semanas/ocasiones), no una probabilidad. */
  confidence: number
  /** El hallazgo, específico y con números. */
  title: string
  /** Contexto corto de por qué vale la pena, sin recetar. */
  explanation: string
  /** Métrica de esquina ("18 de 21 entrenamientos"). */
  metric: { value: string; label: string }
  evidenceTitle: string
  charts: Chart[]
  reflectionKey: string
  /** Callback de continuidad entre meses ("En mayo no lo habías notado."). */
  priorCallback?: string
  metacognition: Metacognition
  followUps: FollowUp[]
}

export type FindingsCtx = {
  calorieTarget?: number | null
  proteinTarget?: number | null
}

const SLEEP_ENOUGH = 420
const WD_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']
const WD_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const MONTHS = [
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

const weekday = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay()
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function priorCallback(key: string, prior: PriorReflections): string | undefined {
  const p = prior[key]
  if (!p) return undefined
  const mes = MONTHS[Number(p.month.slice(5, 7)) - 1] ?? p.month
  if (p.answer === 'nunca') return `En ${mes} esto no lo habías notado.`
  if (p.answer === 'no') return `En ${mes} me dijiste que no lo habías notado.`
  if (p.answer === 'si') return `En ${mes} ya lo sabías.`
  return undefined
}

/** La metacognición estándar: "¿Lo habías notado?" con respuestas guiadas y una
 *  segunda pregunta según categoría. `distributed` = el patrón se reparte en el
 *  mes (justifica el "no lo notaste"). */
function standardMetacognition(distributed: boolean): Metacognition {
  return {
    question: '¿Lo habías notado?',
    options: [
      { label: 'Sí', answer: 'si' },
      { label: 'No', answer: 'no' },
      { label: 'Nunca me había dado cuenta', answer: 'nunca' },
    ],
    replies: {
      si: 'Entonces ya venías leyéndolo. Aquí queda con números.',
      no: distributed
        ? 'Tiene sentido. Es un patrón difícil de ver porque ocurre repartido a lo largo del mes.'
        : 'Tiene sentido. A veces se nota mejor con los días juntos, como aquí.',
      nunca:
        'Tiene sentido. Es un patrón difícil de notar porque ocurre distribuido a lo largo del mes.',
    },
    follow: {
      question: '¿Qué crees que influye?',
      options: [
        { label: 'Mis horarios', answer: 'horarios' },
        { label: 'Mi trabajo', answer: 'trabajo' },
        { label: 'No estoy segura', answer: 'no-segura' },
      ],
    },
  }
}

/* ── Detectores ──────────────────────────────────────────────────────── */

/** A · Un día de la semana en que comes notablemente más. */
function detectWeekdayCalories(signals: readonly DailySignals[]): Finding | null {
  const rows = signals.filter(
    (s): s is DailySignals & { day: string; calories: number } =>
      !!s.day && s.calories != null && s.calories > 0,
  )
  if (rows.length < 10) return null
  const overall = mean(rows.map((r) => r.calories))
  const byWd: number[][] = Array.from({ length: 7 }, () => [])
  for (const r of rows) byWd[weekday(r.day)]!.push(r.calories)

  let bestWd = -1
  let bestDelta = 0
  for (let wd = 0; wd < 7; wd++) {
    const occ = byWd[wd]!
    if (occ.length < 2) continue
    const delta = mean(occ) - overall
    if (delta > bestDelta) {
      bestDelta = delta
      bestWd = wd
    }
  }
  if (bestWd < 0 || bestDelta < 150) return null

  const occ = byWd[bestWd]!
  const above = occ.filter((c) => c > overall).length
  const confidence = Math.round((above / occ.length) * 100)
  const bars = WD_SHORT.map((label, wd) => ({
    label,
    value: byWd[wd]!.length ? Math.round(mean(byWd[wd]!)) : 0,
    highlight: wd === bestWd,
  }))

  return {
    id: 'weekday-calories',
    category: 'alimentacion',
    confidence,
    title: `Los ${WD_PLURAL[bestWd]} consumiste ${Math.round(bestDelta)} kcal más que tu promedio.`,
    explanation:
      'Un día de la semana se repitió por encima del resto. No siempre se ve de un vistazo.',
    metric: { value: `${above} de ${occ.length}`, label: `${WD_PLURAL[bestWd]} por encima` },
    evidenceTitle: '¿Por qué encontré esto?',
    charts: [{ kind: 'weekdayBars', unit: 'kcal promedio', bars }],
    reflectionKey: 'weekday-calories',
    metacognition: standardMetacognition(true),
    followUps: [],
  }
}

/** B · Correlación entrenaste → déficit. */
function detectTrainingDeficit(signals: readonly DailySignals[], ctx: FindingsCtx): Finding | null {
  const trained = signals.filter((s) => s.trained === true)
  if (trained.length < 3) return null
  const deficitTrained = trained.filter((s) => isDeficitDay(s.calories, ctx.calorieTarget))
  if (deficitTrained.length === 0) return null
  const pct = Math.round((deficitTrained.length / trained.length) * 100)
  if (pct < 55) return null

  const dots = signals
    .filter((s) => s.trained === true)
    .map((s): 'on' | 'strong' => (isDeficitDay(s.calories, ctx.calorieTarget) ? 'strong' : 'on'))

  return {
    id: 'training-deficit',
    category: 'movimiento',
    confidence: pct,
    title: `Los días que entrenaste, entraste en déficit el ${pct}% de las veces.`,
    explanation:
      'Moverte y tus días en déficit aparecieron juntos más de lo esperado. Esto llamó mi atención.',
    metric: { value: `${deficitTrained.length} de ${trained.length}`, label: 'entrenamientos' },
    evidenceTitle: '¿Por qué encontré esto?',
    charts: [
      {
        kind: 'dotTimeline',
        dots,
        caption: 'Cada punto es un día que entrenaste; encendido fuerte = también en déficit.',
      },
    ],
    reflectionKey: 'training-deficit',
    metacognition: standardMetacognition(false),
    followUps: [],
  }
}

/** C · Umbral de agua → días en déficit. */
function detectWaterDeficit(signals: readonly DailySignals[], ctx: FindingsCtx): Finding | null {
  const goalDays = signals.filter((s) => (s.water_glasses ?? 0) >= WATER_GOAL_GLASSES)
  if (goalDays.length < 3) return null
  const overlap = goalDays.filter((s) => isDeficitDay(s.calories, ctx.calorieTarget))
  if (overlap.length < 2) return null
  const pct = Math.round((overlap.length / goalDays.length) * 100)

  const dots = goalDays.map((s): 'on' | 'strong' =>
    isDeficitDay(s.calories, ctx.calorieTarget) ? 'strong' : 'on',
  )

  return {
    id: 'water-deficit',
    category: 'agua',
    confidence: pct,
    title: `Cuando llegaste a tu meta de agua, estuviste en déficit ${overlap.length} de ${goalDays.length} días.`,
    explanation: 'Tu hidratación y tus días en déficit aparecieron juntos más de lo esperado.',
    metric: { value: `${overlap.length} de ${goalDays.length}`, label: 'días con tu meta de agua' },
    evidenceTitle: '¿Por qué encontré esto?',
    charts: [
      {
        kind: 'dotTimeline',
        dots,
        caption:
          'Cada punto es un día que llegaste a tu meta de agua; fuerte = también en déficit.',
      },
    ],
    reflectionKey: 'water-deficit',
    metacognition: standardMetacognition(true),
    followUps: [],
  }
}

/** D · Resumen de déficit (el norte). Siempre disponible con datos. */
function detectDeficitSummary(signals: readonly DailySignals[], ctx: FindingsCtx): Finding | null {
  const withCal = signals.filter((s) => s.calories != null && s.calories > 0)
  if (withCal.length < 8) return null
  const flags = withCal.map((s) => isDeficitDay(s.calories, ctx.calorieTarget))
  const count = flags.filter(Boolean).length
  if (count === 0) return null
  let streak = 0
  let run = 0
  for (const on of flags) {
    run = on ? run + 1 : 0
    if (run > streak) streak = run
  }
  const pct = Math.round((count / withCal.length) * 100)

  return {
    id: 'deficit-summary',
    category: 'deficit',
    confidence: pct,
    title: `Estuviste en déficit ${count} de ${withCal.length} días con comida registrada.`,
    explanation: 'Tu norte del mes. Aquí está sin adornos.',
    metric: { value: `${streak} días`, label: 'tu tramo seguido más largo' },
    evidenceTitle: '¿Por qué encontré esto?',
    charts: [
      {
        kind: 'dotTimeline',
        dots: flags.map((on): 'off' | 'strong' => (on ? 'strong' : 'off')),
        caption: 'Cada punto encendido es un día en déficit.',
      },
    ],
    reflectionKey: 'deficit-summary',
    metacognition: standardMetacognition(false),
    followUps: [],
  }
}

/* ── Profundizaciones (followUps) compartidas ────────────────────────── */

function buildFollowUps(
  f: Finding,
  signals: readonly DailySignals[],
  ctx: FindingsCtx,
): FollowUp[] {
  const ups: FollowUp[] = []

  // ¿Cuándo ocurrió? — el día de la semana dominante de la categoría.
  const pred = presenceFor(f.category, ctx)
  const byWd = new Array(7).fill(0)
  for (const s of signals) if (s.day && pred(s)) byWd[weekday(s.day)]++
  const topWd = byWd.indexOf(Math.max(...byWd))
  if (byWd[topWd] > 0) {
    ups.push({
      kind: 'observation',
      label: '¿Cuándo ocurrió?',
      text: `En tus registros, esto apareció más los ${WD_PLURAL[topWd]}.`,
    })
  }

  // ¿Con qué se relaciona? — cruce con déficit (si no es el hallazgo de déficit).
  if (f.category !== 'deficit') {
    let overlap = 0
    let base = 0
    for (const s of signals) {
      if (s.day && pred(s)) {
        base++
        if (isDeficitDay(s.calories, ctx.calorieTarget)) overlap++
      }
    }
    if (overlap > 0) {
      ups.push({
        kind: 'observation',
        label: '¿Con qué se relaciona?',
        text: `En ${overlap} de esos ${base} días también estuviste en déficit. Esto llamó mi atención.`,
      })
    }
  }

  ups.push({ kind: 'next', label: 'Muéstrame otro patrón' })
  return ups
}

function presenceFor(category: FindingCategory, ctx: FindingsCtx): (s: DailySignals) => boolean {
  switch (category) {
    case 'movimiento':
      return (s) => s.trained === true
    case 'sueno':
      return (s) => (s.sleep_minutes ?? 0) >= SLEEP_ENOUGH
    case 'agua':
      return (s) => (s.water_glasses ?? 0) >= WATER_GOAL_GLASSES
    case 'proteina':
      return (s) => ctx.proteinTarget != null && (s.protein_g ?? 0) >= ctx.proteinTarget
    case 'deficit':
      return (s) => isDeficitDay(s.calories, ctx.calorieTarget)
    case 'alimentacion':
      return (s) => s.calories != null && s.calories > 0
  }
}

/* ── Ensamblado ──────────────────────────────────────────────────────── */

/** Todos los hallazgos del mes, ordenados por confianza (el más sólido primero). */
export function buildFindings(
  signals: readonly DailySignals[],
  ctx: FindingsCtx = {},
  prior: PriorReflections = {},
): Finding[] {
  const raw = [
    detectWeekdayCalories(signals),
    detectTrainingDeficit(signals, ctx),
    detectWaterDeficit(signals, ctx),
    detectDeficitSummary(signals, ctx),
  ].filter((f): f is Finding => f != null)

  raw.sort((a, b) => b.confidence - a.confidence)

  return raw.map((f) => ({
    ...f,
    priorCallback: priorCallback(f.reflectionKey, prior),
    followUps: buildFollowUps(f, signals, ctx),
  }))
}
