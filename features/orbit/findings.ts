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
  | { kind: 'days'; label: string; dates: string[] }
  | { kind: 'next'; label: string }

export type Finding = {
  id: string
  category: FindingCategory
  /** 0–100. Cuánto sostuvo el patrón (semanas/ocasiones), no una probabilidad. */
  confidence: number
  /** El hallazgo, específico y con números. */
  title: string
  /** El contenido de la card-constelación en 3 niveles: `lead` = la LECTURA /
   *  palanca (Cormorant italic, voz del coach · el VALOR, no la coincidencia),
   *  `support` = la evidencia con números (Hanken), `caption` = la
   *  metacognición ("día a día no se ve; junto sí" · el diferenciador de Stelar,
   *  hoy visible en la card, no escondido tras "Entender"). El italic jamás es
   *  número crudo ni culpa. */
  phrase: { lead: string; support: string; caption: string }
  /** Muestra chica (pocas ocurrencias): se muestra como "Señal naciente" —
   *  tentativa, sin sello de consistencia lleno. Honestidad sobre el N. */
  emerging?: boolean
  /** Contexto corto de por qué vale la pena, sin recetar. */
  explanation: string
  /** Conexión con su norte (déficit → objetivo), sin presión. undefined si el
   *  hallazgo no acerca al objetivo (ej. comer más un día). */
  northLink?: string
  /** La HIPÓTESIS de Stelar: otra dimensión que coincidió en esos días
   *  (determinística, tentativa, sin causalidad). undefined si no hay cruce. */
  hypothesis?: string
  /** Métrica de esquina ("18 de 21 entrenamientos"). */
  metric: { value: string; label: string }
  /** Las fechas reales relevantes del hallazgo (para "Ver esos días"). */
  evidenceDates: string[]
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

/** La metacognición estándar. Pregunta cálida (no de examen) y respuestas
 *  centradas en ELLA, no en el producto. Los `answer` se mantienen si/no/nunca
 *  para no romper el callback de continuidad (month_reflections).
 *  `distributed` = el hallazgo se reparte en el mes. */
function standardMetacognition(distributed: boolean): Metacognition {
  return {
    question: '¿Esto ya lo sabías?',
    options: [
      { label: 'Sí', answer: 'si' },
      { label: 'No', answer: 'no' },
      { label: 'Nunca lo había visto', answer: 'nunca' },
    ],
    replies: {
      si: 'Entonces ya lo venías leyendo. Aquí queda con tus propios días.',
      no: distributed
        ? 'Se ve mejor con el mes junto: día a día pasa desapercibido, pero al sumar los días aparece.'
        : 'Se nota más con los días juntos, como aquí.',
      nunca:
        'Tú ya lo estabas haciendo. Solo que mirando un día no se veía; se notó al juntar el mes.',
    },
    // Sin `follow`: la encuesta "¿qué crees que influye?" le pasaba el trabajo a
    // la usuaria. Ahora la hipótesis la arriesga Stelar (ver `hypothesis`).
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
    if (occ.length < 3) continue // muestra real: ≥3 de ese día
    const delta = mean(occ) - overall
    if (delta > bestDelta) {
      bestDelta = delta
      bestWd = wd
    }
  }
  if (bestWd < 0 || bestDelta < 200) return null // delta con peso

  const occ = byWd[bestWd]!
  const above = occ.filter((c) => c > overall).length
  const confidence = Math.round((above / occ.length) * 100)
  const bars = WD_SHORT.map((label, wd) => ({
    label,
    value: byWd[wd]!.length ? Math.round(mean(byWd[wd]!)) : 0,
    highlight: wd === bestWd,
  }))
  const evidenceDates = rows
    .filter((r) => weekday(r.day) === bestWd && r.calories > overall)
    .map((r) => r.day)

  return {
    id: 'weekday-calories',
    category: 'alimentacion',
    confidence,
    title: `Los ${WD_PLURAL[bestWd]} consumiste ${Math.round(bestDelta)} kcal más que tu promedio.`,
    phrase: {
      lead: `Los ${WD_PLURAL[bestWd]}, tu cuerpo pidió un poco más.`,
      support: `${Math.round(bestDelta)} kcal por encima de tu promedio.`,
      caption: 'No es un problema; es un ritmo tuyo que ahora ves.',
    },
    explanation:
      'Un día de la semana se repitió por encima del resto. No siempre se ve de un vistazo.',
    // Sin northLink: comer más un día no acerca al objetivo (no lo maquillamos).
    metric: { value: `${above} de ${occ.length}`, label: `${WD_PLURAL[bestWd]} por encima` },
    evidenceDates,
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
  const evidenceDates = deficitTrained.map((s) => s.day).filter((d): d is string => !!d)
  const emerging = trained.length < 5 // pocas ocurrencias → señal naciente, no sello

  return {
    id: 'training-deficit',
    category: 'movimiento',
    confidence: pct,
    emerging,
    title: `Los días que entrenaste, entraste en déficit el ${pct}% de las veces.`,
    phrase: {
      lead: 'Moverte y tu déficit fueron casi siempre juntos.',
      support: emerging
        ? `Pasó en ${deficitTrained.length} de tus ${trained.length} entrenamientos, pero son pocos días.`
        : `${deficitTrained.length} de tus ${trained.length} entrenamientos cayeron en déficit.`,
      caption: emerging
        ? 'Lo sigo mirando. Con más días se confirma o se cae.'
        : 'Tú ya lo hacías; en un solo día no se veía.',
    },
    explanation: 'Moverte y tus días en déficit coincidieron seguido. Esto llamó mi atención.',
    northLink: 'Y esos fueron días que te acercaron a tu objetivo.',
    metric: { value: `${deficitTrained.length} de ${trained.length}`, label: 'entrenamientos' },
    evidenceDates,
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
  const evidenceDates = overlap.map((s) => s.day).filter((d): d is string => !!d)
  const emerging = goalDays.length < 5 // pocas ocurrencias → señal naciente, no sello

  return {
    id: 'water-deficit',
    category: 'agua',
    confidence: pct,
    emerging,
    title: `Cuando llegaste a tu meta de agua, estuviste en déficit ${overlap.length} de ${goalDays.length} días.`,
    phrase: {
      lead: 'Los días que llegaste a tu agua, sostuviste el déficit.',
      support: emerging
        ? `Pasó en ${overlap.length} de esos ${goalDays.length} días, pero son pocos días.`
        : `Pasó en ${overlap.length} de esos ${goalDays.length} días.`,
      caption: emerging
        ? 'Lo sigo mirando. Con más días se confirma o se cae.'
        : 'Día a día no se nota; al juntar el mes, aparece.',
    },
    explanation: 'Tu hidratación y tus días en déficit coincidieron seguido.',
    northLink: 'Varios de esos días también te acercaron a tu objetivo.',
    metric: { value: `${overlap.length} de ${goalDays.length}`, label: 'días con tu meta de agua' },
    evidenceDates,
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
  const pct = Math.round((count / withCal.length) * 100)
  const evidenceDates = withCal
    .filter((s, i) => flags[i])
    .map((s) => s.day)
    .filter((d): d is string => !!d)

  // Veredicto de dirección (responde "¿voy bien?" de una mirada), sin culpa: con
  // pocos días en déficit no regaña, dice que apenas toma forma.
  const lead =
    pct >= 60
      ? 'Vas en buena dirección.'
      : pct >= 40
        ? 'Vas sumando tus días.'
        : 'Tu mes apenas toma forma.'

  return {
    id: 'deficit-summary',
    category: 'deficit',
    confidence: pct,
    title: `Estuviste en déficit ${count} de ${withCal.length} días con comida registrada.`,
    phrase: {
      lead,
      support: `Déficit ${count} de ${withCal.length} días con comida registrada.`,
      caption: 'Un día no lo dice; el mes junto sí.',
    },
    explanation: 'Tu norte del mes. Aquí está sin adornos.',
    northLink: 'Cada uno de esos días te acercó a tu objetivo.',
    metric: { value: `${count} de ${withCal.length}`, label: 'días en déficit' },
    evidenceDates,
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

/** La HIPÓTESIS de Stelar: entre las fechas del hallazgo, qué OTRA dimensión
 *  coincidió más. Determinística (cuenta coincidencias REALES, nunca inventa) y
 *  TENTATIVA (nota los dos hechos juntos, NUNCA afirma causa · manifiesto). La
 *  arriesga Stelar en vez de pasarle a la usuaria un cuestionario. */
function crossHypothesis(
  dates: readonly string[],
  signals: readonly DailySignals[],
  category: FindingCategory,
): string | null {
  if (dates.length < 2) return null
  const set = new Set(dates)
  const rows = signals.filter((s) => s.day && set.has(s.day))
  const options: { count: number; text: string }[] = []
  if (category !== 'movimiento') {
    const trained = rows.filter((s) => s.trained === true).length
    options.push({ count: trained, text: `en ${trained} de esos días también entrenaste` })
  }
  if (category !== 'sueno') {
    const slept = rows.filter((s) => (s.sleep_minutes ?? 0) >= SLEEP_ENOUGH).length
    options.push({ count: slept, text: `en ${slept} de esos días también dormiste 7 horas o más` })
  }
  const best = options.filter((o) => o.count >= 2).sort((a, b) => b.count - a.count)[0]
  return best ? `Me llamó algo más: ${best.text}. No sé si va junto, pero ahí están los dos.` : null
}

/** Cierre del chat: ver esos días (fechas → abre el Día) + siguiente hallazgo. */
function buildFollowUps(f: Finding): FollowUp[] {
  const ups: FollowUp[] = []
  if (f.evidenceDates.length > 0) {
    ups.push({ kind: 'days', label: 'Ver esos días', dates: f.evidenceDates })
  }
  ups.push({ kind: 'next', label: 'Ver otro hallazgo' })
  return ups
}

/* ── Ensamblado ──────────────────────────────────────────────────────── */

/** Score: confianza + bonus si acerca al norte (déficit→objetivo). */
const scoreOf = (f: Finding): number => f.confidence + (f.northLink ? 15 : 0)

/**
 * Los hallazgos del mes: SOLO 2-3 que TENGAN SENTIDO (no un listado). El de
 * déficit (el norte) es ancla si existe; el resto se filtra por confianza ≥ 60
 * y se rankea por score; máx 1 hallazgo "sin norte" (ej. comer más un día).
 * Cap 3, ordenados por score (el mejor es el hero).
 */
export function buildFindings(
  signals: readonly DailySignals[],
  ctx: FindingsCtx = {},
  prior: PriorReflections = {},
): Finding[] {
  const all = [
    detectWeekdayCalories(signals),
    detectTrainingDeficit(signals, ctx),
    detectWaterDeficit(signals, ctx),
    detectDeficitSummary(signals, ctx),
  ].filter((f): f is Finding => f != null)

  const anchor = all.find((f) => f.id === 'deficit-summary')
  const rest = all
    .filter((f) => f.id !== 'deficit-summary' && f.confidence >= 60)
    .sort((a, b) => scoreOf(b) - scoreOf(a))

  const picked: Finding[] = anchor ? [anchor] : []
  let noNorth = 0
  for (const f of rest) {
    if (picked.length >= 3) break
    if (!f.northLink) {
      if (noNorth >= 1) continue // máx un hallazgo sin norte
      noNorth++
    }
    picked.push(f)
  }
  // NO re-ordenar: el ancla (déficit = el norte) queda en índice 0 como hero, y
  // el resto conserva su orden por score. El re-sort anterior dejaba que una
  // coincidencia de N chico con 100% (falso-preciso) robara el titular al norte.

  return picked.map((f) => ({
    ...f,
    priorCallback: priorCallback(f.reflectionKey, prior),
    hypothesis: crossHypothesis(f.evidenceDates, signals, f.category) ?? undefined,
    followUps: buildFollowUps(f),
  }))
}
