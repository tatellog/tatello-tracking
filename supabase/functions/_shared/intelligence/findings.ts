/*
 * Findings Engine (R1 · Engine 2) — el MOTOR DE HALLAZGOS. Puro, determinístico,
 * testeable, COMPARTIDO (app + Edge Functions). La promesa: "hacer visible lo
 * invisible" — descubrimientos ESPECÍFICOS de SUS datos, con números, confianza
 * y evidencia. La IA solo redacta; los números y la estructura salen de aquí.
 *
 * Cada detector devuelve un `Finding` (contrato en engine.ts): título específico
 * + confianza + métrica + evidencia + metacognición + profundizaciones.
 *
 * Voz Observadora: describe registros, nunca diagnostica ni aconseja. Sin culpa.
 *
 * LÍMITE: daily_signals es por día (sin hora); patrones por hora quedan fuera.
 *
 * Migrado desde features/orbit/findings.ts (que ahora es un puente re-export).
 * Epic 01 · T2.2. Los tipos de dominio viven en ./engine (T0.1).
 */
import { isDeficitDay } from './deficit.ts'
import type { Finding, FindingCategory, FollowUp, Metacognition } from './engine.ts'
import type { DailySignals } from './types.ts'
import { WATER_GOAL_GLASSES } from './water.ts'

export type { Chart, Finding, FindingCategory, FollowUp, Metacognition } from './engine.ts'

export type FindingsCtx = {
  calorieTarget?: number | null
  proteinTarget?: number | null
}

/** Por cada pregunta, la respuesta más reciente de un mes ANTERIOR (para el
 *  callback de continuidad). Forma estructural (el cliente pasa la suya). */
export type PriorReflections = Record<string, { month: string; answer: string }>

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
    subject: `los ${WD_PLURAL[bestWd]}`,
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

  // Contrapunto (el gym como ancla de la dieta): los días que NO entrenó.
  const notTrained = signals.filter(
    (s) => s.trained !== true && s.calories != null && s.calories > 0,
  )
  const notTrainedDef = notTrained.filter((s) => isDeficitDay(s.calories, ctx.calorieTarget)).length
  const contrast =
    notTrained.length >= 3
      ? `Los días que no entrenaste, ${notTrainedDef} de ${notTrained.length} en déficit.`
      : undefined

  return {
    id: 'training-deficit',
    category: 'movimiento',
    confidence: pct,
    emerging,
    lever: emerging ? undefined : 'mantén tus entrenos',
    contrast,
    title: `Los días que entrenaste, entraste en déficit el ${pct}% de las veces.`,
    subject: 'tus días de entrenamiento',
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
    // Palanca del motor (no de la IA). Muestra chica → sin palanca (no se receta
    // desde 3 días · manifiesto).
    lever: emerging ? undefined : 'cuida tu agua',
    title: `Cuando llegaste a tu meta de agua, estuviste en déficit ${overlap.length} de ${goalDays.length} días.`,
    subject: 'tus días con tu meta de agua',
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

  // Veredicto de dirección (responde "¿voy bien?" de una mirada), CLARO y sin
  // culpa: dice explícito "en déficit" (no un poético vago tipo "vas sumando tus
  // días") y afirma que es constancia, no casualidad. Con pocos días no regaña.
  const lead =
    pct >= 60
      ? 'Estuviste en déficit la mayoría de tus días. Vas en buena dirección.'
      : pct >= 40
        ? 'Estuviste en déficit buena parte de tus días. Eso ya es constancia.'
        : 'Tu déficit apenas toma forma este mes. Ya diste los primeros pasos.'

  return {
    id: 'deficit-summary',
    category: 'deficit',
    confidence: pct,
    title: `Estuviste en déficit ${count} de ${withCal.length} días con comida registrada.`,
    subject: 'tu déficit del mes',
    phrase: {
      lead,
      support: `Déficit ${count} de ${withCal.length} días con comida registrada.`,
      caption: 'Un día no lo dice; el mes junto sí.',
    },
    contrast: `Los otros ${withCal.length - count} días con comida no llegaron a déficit.`,
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

/** E · OBSTÁCULO — el día de la semana donde más se te rompe la dieta. Lo
 *  invisible que tu memoria no ve: la DB sí. Hecho, no culpa. Sin northLink
 *  (romper no acerca al objetivo). */
function detectWeekdayDietBreak(
  signals: readonly DailySignals[],
  ctx: FindingsCtx,
): Finding | null {
  if (ctx.calorieTarget == null) return null
  const rows = signals.filter(
    (s): s is DailySignals & { day: string; calories: number } =>
      !!s.day && s.calories != null && s.calories > 0,
  )
  if (rows.length < 12) return null

  const total: number[] = new Array(7).fill(0)
  const deficit: number[] = new Array(7).fill(0)
  for (const r of rows) {
    const wd = weekday(r.day)
    total[wd]!++
    if (isDeficitDay(r.calories, ctx.calorieTarget)) deficit[wd]!++
  }
  const overallDef = rows.filter((r) => isDeficitDay(r.calories, ctx.calorieTarget)).length
  const overallRate = overallDef / rows.length

  let worst = -1
  let worstRate = 1
  for (let wd = 0; wd < 7; wd++) {
    if (total[wd]! < 3) continue // muestra real de ese día
    const rate = deficit[wd]! / total[wd]!
    if (rate < worstRate) {
      worstRate = rate
      worst = wd
    }
  }
  if (worst < 0) return null
  if (overallRate - worstRate < 0.25) return null // la caída debe ser notable
  if (worstRate > 0.5) return null // si aun el peor día suele estar en déficit, no hay ruptura

  const occ = total[worst]!
  const broke = occ - deficit[worst]!
  const restTotal = rows.length - occ
  const restDef = overallDef - deficit[worst]!
  const wd = WD_PLURAL[worst]!
  const evidenceDates = rows
    .filter((r) => weekday(r.day) === worst && !isDeficitDay(r.calories, ctx.calorieTarget))
    .map((r) => r.day)
  const bars = WD_SHORT.map((label, i) => ({
    label,
    value: total[i]! ? Math.round((deficit[i]! / total[i]!) * 100) : 0,
    highlight: i === worst,
  }))

  return {
    id: 'weekday-diet-break',
    category: 'deficit',
    isObstacle: true,
    confidence: Math.round((broke / occ) * 100),
    emerging: occ < 4,
    // La palanca más específica: el día donde se te rompe → "cuida los viernes".
    lever: occ < 4 ? undefined : `cuida los ${wd}`,
    title: `Los ${wd} no llegaste a déficit ${broke} de ${occ} veces.`,
    subject: `los ${wd}`,
    phrase: {
      lead: `Los ${wd} son distintos en tu semana.`,
      support: `Los ${wd} no llegaste a déficit ${broke} de ${occ} veces.`,
      caption: 'Un día suelto no se ve; el mes junto, sí.',
    },
    contrast: `El resto de la semana lo sostuviste ${restDef} de ${restTotal} días.`,
    explanation: 'Un día de la semana concentró las roturas de tu déficit.',
    metric: { value: `${broke} de ${occ}`, label: `${wd} fuera de déficit` },
    evidenceDates,
    evidenceTitle: '¿Por qué encontré esto?',
    charts: [{ kind: 'weekdayBars', unit: '% en déficit', bars }],
    reflectionKey: 'weekday-diet-break',
    metacognition: standardMetacognition(true),
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
  // Sin el hedge "no sé si va junto" (le restaba: "si tú no estás segura, ¿por qué
  // te creo?"). Nombra los dos hechos juntos, sin afirmar causa (manifiesto).
  return best ? `Me llamó algo más: ${best.text}. Ahí se dieron los dos, juntos.` : null
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

/* ── Ensamblado + Ranking ─────────────────────────────────────────────── */

/** Score: confianza + bonus si acerca al norte (déficit→objetivo). */
const scoreOf = (f: Finding): number => f.confidence + (f.northLink ? 15 : 0)

/** La PALANCA del mes para el veredicto (el hero): la del OBSTÁCULO (el día donde
 *  se te rompe · la más específica) antes que la de una DIMENSIÓN que ayuda.
 *  Determinística, del motor. Sin palanca si solo hay muestras chicas. */
function monthLever(findings: readonly Finding[]): string | undefined {
  const obstacle = findings.find((f) => f.id === 'weekday-diet-break' && f.lever)
  if (obstacle?.lever) return obstacle.lever
  const dimension = findings.find(
    (f) => (f.id === 'water-deficit' || f.id === 'training-deficit') && f.lever,
  )
  return dimension?.lever
}

/**
 * Ranking Engine (R1 · Engine 4) — ordena y capa los hallazgos del reporte.
 * Modelo v1: el VEREDICTO (déficit) es el ancla; luego los OBSTÁCULOS ("dónde se
 * te va") por confianza; luego las PALANCAS por score (confianza + bonus si
 * acerca al norte); cap 4; máx 1 palanca "sin norte" (ej. comer más un día).
 *
 * Mapa al Engine 4 del PRD: `confianza` [usada], `impacto` [proxy: bonus de
 * norte]. `frecuencia`/`repetición`/`cantidad de evidencia` quedan para una v2
 * (pesar `evidenceDates.length`) — no se tocan ahora para no mover el orden.
 */
export function rankFindings(findings: readonly Finding[]): Finding[] {
  // Los NACIENTES (muestra chica) nunca lideran a un hallazgo robusto: van
  // después, aunque su % sea alto (3/3 = 100% no debe ganarle a un patrón sólido).
  const byEmergingThen = (rank: (f: Finding) => number) => (a: Finding, b: Finding) => {
    if (!!a.emerging !== !!b.emerging) return a.emerging ? 1 : -1
    return rank(b) - rank(a)
  }
  const verdict = findings.find((f) => f.id === 'deficit-summary')
  const obstacles = findings
    .filter((f) => f.isObstacle && f.confidence >= 55)
    .sort(byEmergingThen((f) => f.confidence))
  const levers = findings
    .filter((f) => !f.isObstacle && f.id !== 'deficit-summary' && f.confidence >= 60)
    .sort(byEmergingThen(scoreOf))

  const picked: Finding[] = verdict ? [verdict] : []
  for (const f of obstacles) {
    if (picked.length >= 4) break
    picked.push(f)
  }
  let noNorth = 0
  for (const f of levers) {
    if (picked.length >= 4) break
    if (!f.northLink) {
      if (noNorth >= 1) continue // máx una palanca "sin norte"
      noNorth++
    }
    picked.push(f)
  }
  return picked
}

/**
 * Los hallazgos del mes para el REPORTE: corre los detectores, los rankea
 * (rankFindings) y los enriquece (callback de continuidad + hipótesis de cruce
 * + followUps). El orden final: veredicto arriba, obstáculos en medio, palancas.
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
    detectWeekdayDietBreak(signals, ctx),
    detectDeficitSummary(signals, ctx),
  ].filter((f): f is Finding => f != null)

  // El veredicto (el hero) toma la palanca del mes: el motor la arma desde el
  // obstáculo (cuándo se rompe) o la dimensión que ayuda. Así "Tu foco" es una
  // acción concreta, no una observación.
  const lever = monthLever(all)

  // "¿Y los días que no?" no debe responder el complemento obvio ("los otros 12
  // no llegaron" · lo calcula ella sola). Si hay un DÍA donde se te va el déficit
  // (obstáculo sólido), el veredicto lo dice: "sobre todo los viernes" → el ajá.
  const breakDay = all.find((f) => f.id === 'weekday-diet-break' && f.lever)
  const verdictContrast = breakDay
    ? `Los que más se te escaparon fueron ${breakDay.subject}.`
    : undefined

  return rankFindings(all).map((f) => ({
    ...f,
    lever: f.id === 'deficit-summary' ? (lever ?? f.lever) : f.lever,
    contrast: f.id === 'deficit-summary' && verdictContrast ? verdictContrast : f.contrast,
    priorCallback: priorCallback(f.reflectionKey, prior),
    hypothesis: crossHypothesis(f.evidenceDates, signals, f.category) ?? undefined,
    followUps: buildFollowUps(f),
  }))
}

/**
 * Huella estable de un set de hallazgos, para cachear la voz de IA POR
 * HALLAZGO: mientras los hallazgos visibles no cambien (id + confianza +
 * naciente + subject + el texto con números + contrapunto), el hash no cambia y
 * la IA NO se regenera. Determinística (sin Date/random): mismo motor, mismo
 * hash en cliente y edge.
 */
export function hashFindings(findings: readonly Finding[]): string {
  const canon = findings
    .map(
      (f) =>
        `${f.id}|${f.confidence}|${f.emerging ? 1 : 0}|${f.subject}|${f.phrase.lead}|${f.phrase.support}|${f.contrast ?? ''}|${f.lever ?? ''}`,
    )
    .join('~')
  let h = 0x811c9dc5
  for (let i = 0; i < canon.length; i++) {
    h ^= canon.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
