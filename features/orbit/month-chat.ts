/*
 * Órbita Mes IA · el motor de CONVERSACIÓN GUIADA (Release 2, puro y testeable).
 *
 * docs/orbita-mes-ia-spec.md. La usuaria descubre "qué aprendí sobre mí este
 * mes" tocando BOTONES (nunca texto libre). Los árboles son DETERMINÍSTICOS:
 * la estructura y los números salen del motor (month-built.ts); la IA (Voz del
 * Release 1) solo redacta con calidez, nunca inventa conclusiones.
 *
 * Este módulo NO renderiza ni llama IA: produce el GRAFO de la conversación
 * (nodos + botones) a partir de los datos del mes. La UI lo camina; la Voz de
 * IA (opcional, cacheada) reescribe el texto de las burbujas si el flag lo pide.
 */
import { isDeficitDay } from './deficit'
import {
  daysInDeficit,
  detectMonthPatterns,
  proteinAdherence,
  WATER_GOAL_GLASSES,
  type MonthPattern,
} from './month-built'
import type { DailySignals } from './api'

/** Sueño "suficiente": ≥ 7 h (mismo umbral honesto que el Context Engine). */
const SLEEP_ENOUGH_MINUTES = 420

/* ── El grafo ────────────────────────────────────────────────────────── */

/** Una burbuja de Stelar (reusa la forma de VozParte). */
export type ChatBubble = { text: string; tone?: 'accent' | 'strong' }

/** Qué hace un botón además de (o en vez de) navegar a otro nodo. */
export type ChatAction = { kind: 'goto'; node: string } | { kind: 'openCalendar' } | { kind: 'end' }

export type ChatChoice = {
  label: string
  action: ChatAction
  /** Si está, tocar el botón GUARDA esta respuesta de metacognición bajo la
   *  clave, antes de ejecutar la acción. El valor guardado es `answer`. */
  reflection?: { questionKey: string; answer: string }
}

export type ChatNode = {
  id: string
  /** Lo que Stelar "dice" en secuencia al llegar al nodo. */
  bubbles: ChatBubble[]
  /** La pregunta + botones. Sin choices = nodo terminal. */
  choices?: ChatChoice[]
}

export type ChatTopic =
  | 'deficit'
  | 'alimentacion'
  | 'rutina'
  | 'sueno'
  | 'entrenamiento'
  | 'agua'
  | 'sorprendeme'

export type ChatTree = {
  topic: ChatTopic
  entry: string
  nodes: Record<string, ChatNode>
}

/** El picker "Lo que aprendimos este mes": intro + botones de tema. */
export type TopicPicker = {
  intro: ChatBubble[]
  choices: { topic: ChatTopic; label: string }[]
}

/** Una tarjeta de hallazgo en la antesala: el patrón que el motor detectó,
 *  mostrado con su evidencia a 0 taps. Al tocar "Ver más" abre su conversación
 *  (el `tree`). Es lo que vuelve la antesala "3 cosas que encontré este mes",
 *  no un menú de temas abstractos. */
export type PatternCard = {
  id: string
  /** Encabezado corto ("Tu sueño", "Los viernes"). */
  label: string
  /** El hallazgo con evidencia — la frase que se lee en la tarjeta. */
  finding: string
  /** Dimensión para el ícono + tinte del avatar (sueno/agua/deficit/…). */
  colorKey: string
  /** La conversación guiada que abre la tarjeta. */
  tree: ChatTree
}

export type MonthChat = {
  /** false → estado vacío ("todavía estoy aprendiendo"): no hay datos para
   *  una conversación honesta. */
  ready: boolean
  picker: TopicPicker | null
  trees: Partial<Record<ChatTopic, ChatTree>>
  /** Los hallazgos del mes como tarjetas (top 3), cada uno abre su conversación. */
  cards: PatternCard[]
}

/** Respuestas de meses anteriores (question_key → mes + respuesta), para el
 *  "cerrar el loop": Stelar recuerda lo que dijiste la última vez. */
export type PriorReflections = Record<string, { month: string; answer: string }>

export type MonthChatCtx = {
  calorieTarget?: number | null
  proteinTarget?: number | null
}

/* ── Estado vacío (criterios mínimos de la spec) ─────────────────────── */

const MIN_ACTIVE_DAYS = 14
const MIN_MEALS = 10
const MIN_SLEEP_OR_ACTIVITY = 5

function hasAnySignal(s: DailySignals): boolean {
  return (
    s.sleep_minutes != null ||
    (s.meal_count ?? 0) > 0 ||
    s.calories != null ||
    s.trained === true ||
    (s.water_glasses ?? 0) > 0 ||
    s.mood != null ||
    s.energy != null ||
    s.weight_kg != null
  )
}

/** ¿Hay datos suficientes para una conversación honesta? (spec: estados vacíos.) */
export function monthChatReady(signals: readonly DailySignals[]): boolean {
  const activeDays = signals.filter(hasAnySignal).length
  const meals = signals.filter((s) => (s.meal_count ?? 0) > 0).length
  const sleepOrActivity = signals.filter(
    (s) => s.sleep_minutes != null || s.trained === true,
  ).length
  return (
    activeDays >= MIN_ACTIVE_DAYS && meals >= MIN_MEALS && sleepOrActivity >= MIN_SLEEP_OR_ACTIVITY
  )
}

/* ── Árbol: DÉFICIT (el de referencia) ───────────────────────────────── */

/** Días en déficit que ADEMÁS durmieron ≥7h — el cruce que hace "interesante"
 *  el déficit (coincidencia, no causa). */
function deficitDaysWithSleep(
  signals: readonly DailySignals[],
  target: number | null | undefined,
): number {
  return signals.filter(
    (s) => isDeficitDay(s.calories, target) && (s.sleep_minutes ?? 0) >= SLEEP_ENOUGH_MINUTES,
  ).length
}

function buildDeficitTree(signals: readonly DailySignals[], ctx: MonthChatCtx): ChatTree | null {
  const summary = daysInDeficit(signals, { calorieTarget: ctx.calorieTarget })
  if (summary == null || summary.deficitDays === 0) return null
  const withSleep = deficitDaysWithSleep(signals, ctx.calorieTarget)

  const nodes: Record<string, ChatNode> = {
    intro: {
      id: 'intro',
      bubbles: [
        { text: 'Elegiste déficit.' },
        { text: `Tuviste déficit ${summary.deficitDays} días este mes.`, tone: 'strong' },
      ],
      choices:
        withSleep >= 3
          ? [{ label: 'Sigue', action: { kind: 'goto', node: 'sleepCross' } }]
          : [{ label: 'Ver el calendario', action: { kind: 'openCalendar' } }],
    },
    sleepCross: {
      id: 'sleepCross',
      bubbles: [
        { text: 'Crucé esos días con tu sueño.' },
        { text: `Dormiste más de 7 horas en ${withSleep} de esos días.`, tone: 'strong' },
      ],
      choices: [
        {
          label: 'Sí',
          action: { kind: 'openCalendar' },
          reflection: { questionKey: 'deficit_sleep_cross', answer: 'si' },
        },
        {
          label: 'No',
          action: { kind: 'end' },
          reflection: { questionKey: 'deficit_sleep_cross', answer: 'no' },
        },
        { label: 'Ver calendario', action: { kind: 'openCalendar' } },
      ],
    },
  }
  return { topic: 'deficit', entry: 'intro', nodes }
}

/* ── Árboles genéricos (un hallazgo + metacognición) ─────────────────── */

/** Una pregunta de metacognición reutilizable: guarda sí/no/nunca bajo su
 *  clave. "Ver calendario" no guarda (es evidencia, no respuesta). */
function metacognitionChoices(questionKey: string): ChatChoice[] {
  return [
    { label: 'Sí', action: { kind: 'end' }, reflection: { questionKey, answer: 'si' } },
    { label: 'No', action: { kind: 'end' }, reflection: { questionKey, answer: 'no' } },
    {
      label: 'Nunca me había dado cuenta',
      action: { kind: 'end' },
      reflection: { questionKey, answer: 'nunca' },
    },
  ]
}

/**
 * Árbol estándar de un tema: nodo `intro` con el hallazgo (burbujas del motor)
 * → nodo `notice` con la pregunta de metacognición. Si `question` es null, el
 * intro cierra ofreciendo el calendario como evidencia.
 */
function findingTree(
  topic: ChatTopic,
  finding: ChatBubble[],
  question: { text: string; questionKey: string } | null,
): ChatTree {
  const nodes: Record<string, ChatNode> = {
    intro: {
      id: 'intro',
      bubbles: finding,
      choices: question
        ? [{ label: 'Sigue', action: { kind: 'goto', node: 'notice' } }]
        : [{ label: 'Ver el calendario', action: { kind: 'openCalendar' } }],
    },
  }
  if (question) {
    nodes.notice = {
      id: 'notice',
      bubbles: [{ text: question.text, tone: 'accent' }],
      choices: metacognitionChoices(question.questionKey),
    }
  }
  return { topic, entry: 'intro', nodes }
}

/* ── Hallazgos por tema (del motor, deterministas) ───────────────────── */

function buildAlimentacionTree(
  signals: readonly DailySignals[],
  ctx: MonthChatCtx,
): ChatTree | null {
  const p = proteinAdherence(signals, { proteinTarget: ctx.proteinTarget })
  if (p == null || p.logged < 3) return null
  return findingTree(
    'alimentacion',
    [
      { text: 'Elegiste alimentación.' },
      {
        text: `Alcanzaste tu proteína en ${p.hit} de ${p.logged} días con comida.`,
        tone: 'strong',
      },
    ],
    { text: '¿Ya lo sabías, o te sorprende?', questionKey: 'protein_adherence' },
  )
}

function buildSuenoTree(signals: readonly DailySignals[]): ChatTree | null {
  const nights = signals.filter((s) => s.sleep_minutes != null)
  if (nights.length < 5) return null
  const above7 = nights.filter((s) => (s.sleep_minutes ?? 0) >= SLEEP_ENOUGH_MINUTES).length
  return findingTree(
    'sueno',
    [
      { text: 'Elegiste sueño.' },
      {
        text: `Dormiste 7 horas o más en ${above7} de ${nights.length} noches registradas.`,
        tone: 'strong',
      },
    ],
    { text: '¿Lo habías notado?', questionKey: 'sleep_variation' },
  )
}

function buildEntrenamientoTree(signals: readonly DailySignals[]): ChatTree | null {
  const trained = signals.filter((s) => s.trained === true).length
  if (trained < 3) return null
  return findingTree(
    'entrenamiento',
    [
      { text: 'Elegiste entrenamiento.' },
      { text: `Te moviste ${trained} días este mes.`, tone: 'strong' },
    ],
    { text: '¿Lo habías notado?', questionKey: 'training_feel' },
  )
}

function buildAguaTree(signals: readonly DailySignals[]): ChatTree | null {
  const daysWithWater = signals.filter((s) => (s.water_glasses ?? 0) > 0)
  if (daysWithWater.length < 5) return null
  const metGoal = daysWithWater.filter((s) => (s.water_glasses ?? 0) >= WATER_GOAL_GLASSES).length
  return findingTree(
    'agua',
    [
      { text: 'Elegiste agua.' },
      {
        text: `Llegaste a tu meta de agua en ${metGoal} de ${daysWithWater.length} días.`,
        tone: 'strong',
      },
    ],
    { text: '¿Ya lo sabías, o te sorprende?', questionKey: 'water_awareness' },
  )
}

/* ── "Sorpréndeme" — el patrón menos obvio, con metacognición ────────── */

/** Elige el patrón más "sorprendente": un patrón TEMPORAL/correlación
 *  (kind 'pattern', lo menos obvio) antes que una constancia (kind
 *  'discovery'). null si el motor no detecta ninguno. */
/**
 * Cualquier patrón del motor → una conversación con metacognición: el hallazgo
 * (title, evidencia) → "¿lo habías notado?" (sí/no/nunca) → el `why` del motor
 * (la palanca observacional, ya validada) como cierre. Lo reusan las TARJETAS
 * de la antesala y "Sorpréndeme". `lead` = burbuja opcional antes del hallazgo.
 */
function buildPatternTree(pattern: MonthPattern, lead?: string): ChatTree {
  const bubbles: ChatBubble[] = lead
    ? [{ text: lead }, { text: pattern.title, tone: 'strong' }]
    : [{ text: pattern.title, tone: 'strong' }]
  const nodes: Record<string, ChatNode> = {
    intro: {
      id: 'intro',
      bubbles,
      choices: [{ label: 'Sigue', action: { kind: 'goto', node: 'notice' } }],
    },
    notice: {
      id: 'notice',
      bubbles: [{ text: '¿Lo habías notado?' }],
      choices: metacognitionChoices(`pattern_${pattern.id}`),
    },
  }
  if (pattern.why) {
    // El "por qué importa" del motor, como cierre con evidencia tras responder.
    nodes.why = { id: 'why', bubbles: [{ text: pattern.why, tone: 'strong' }] }
    for (const c of nodes.notice!.choices!) c.action = { kind: 'goto', node: 'why' }
  }
  return { topic: 'sorprendeme', entry: 'intro', nodes }
}

/* ── Ensamblado ──────────────────────────────────────────────────────── */

const TOPIC_LABEL: Record<ChatTopic, string> = {
  deficit: 'Mi déficit',
  alimentacion: 'Mi alimentación',
  rutina: 'Mi rutina',
  sueno: 'Mi sueño',
  entrenamiento: 'Mi entrenamiento',
  agua: 'Mi agua',
  sorprendeme: 'Sorpréndeme',
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
const monthName = (m: string): string => MONTH_NAMES[Number(m.slice(5, 7)) - 1] ?? m

/** El "cerrar el loop": si esta pregunta ya se contestó en un mes anterior,
 *  Stelar lo recuerda antes de volver a preguntar. Continuidad, sin culpa. */
function callbackBubble(questionKey: string, prior: PriorReflections): ChatBubble | null {
  const p = prior[questionKey]
  if (!p) return null
  const mes = monthName(p.month)
  if (p.answer === 'nunca') return { text: `En ${mes} esto no lo habías notado.` }
  if (p.answer === 'no') return { text: `En ${mes} me dijiste que no lo habías notado.` }
  if (p.answer === 'si') return { text: `En ${mes} ya lo sabías.` }
  return null
}

/** Antepone el callback de continuidad a cada nodo con metacognición cuya
 *  pregunta ya se respondió antes. Un Set evita procesar dos veces un nodo
 *  compartido (p. ej. sorpréndeme reusa el árbol de otro tema). */
function applyPriorCallbacks(trees: (ChatTree | undefined)[], prior: PriorReflections): void {
  if (Object.keys(prior).length === 0) return
  const seen = new Set<ChatNode>()
  for (const tree of trees) {
    if (!tree) continue
    for (const node of Object.values(tree.nodes)) {
      if (seen.has(node)) continue
      seen.add(node)
      const qk = node.choices?.find((c) => c.reflection)?.reflection?.questionKey
      if (!qk) continue
      const cb = callbackBubble(qk, prior)
      if (cb) node.bubbles = [cb, ...node.bubbles]
    }
  }
}

/**
 * Arma la conversación del mes: el picker + los árboles disponibles (solo los
 * que tienen datos reales). Fase 1: déficit implementado; los otros temas se
 * agregan igual. `ready=false` → la UI muestra el estado vacío.
 */
export function buildMonthChat(
  signals: readonly DailySignals[],
  ctx: MonthChatCtx = {},
  prior: PriorReflections = {},
): MonthChat {
  if (!monthChatReady(signals)) return { ready: false, picker: null, trees: {}, cards: [] }

  const trees: Partial<Record<ChatTopic, ChatTree>> = {}
  // Orden de aparición en el picker = orden de relevancia (déficit = norte).
  const deficit = buildDeficitTree(signals, ctx)
  if (deficit) trees.deficit = deficit
  const alimentacion = buildAlimentacionTree(signals, ctx)
  if (alimentacion) trees.alimentacion = alimentacion
  const entrenamiento = buildEntrenamientoTree(signals)
  if (entrenamiento) trees.entrenamiento = entrenamiento
  const sueno = buildSuenoTree(signals)
  if (sueno) trees.sueno = sueno
  const agua = buildAguaTree(signals)
  if (agua) trees.agua = agua

  // Solo los temas con datos reales entran (nunca un tema vacío de relleno).
  const available = (Object.keys(trees) as ChatTopic[]).filter((t) => t !== 'sorprendeme')
  if (available.length === 0) return { ready: false, picker: null, trees: {}, cards: [] }

  // Los HALLAZGOS del mes → tarjetas (top 3). Cada patrón que el motor detecta
  // se muestra con su evidencia y abre su propia conversación. Esto es lo que
  // varía mes a mes (el cruce de sueño, los viernes, la hidratación), no un
  // guion fijo por tema.
  const patterns = detectMonthPatterns(signals, {
    calorieTarget: ctx.calorieTarget,
    proteinTarget: ctx.proteinTarget,
  })
  // Prioriza PATRONES (correlaciones no obvias: "los viernes son distintos",
  // "el finde te sostiene") sobre DESCUBRIMIENTOS (constancias que solo repiten
  // lo que ya sabe: "fuiste constante" → no le dice nada). Dentro, el déficit
  // (el norte) primero. Si hay ≥1 patrón real, se OCULTAN las constancias (no
  // aportan). Fallback: si solo hay constancias, se muestran (mejor que vacío).
  const rankOf = (p: MonthPattern) =>
    (p.kind === 'pattern' ? 0 : 10) + (p.evidence.bars[0]?.colorKey === 'deficit' ? 0 : 1)
  const ranked = [...patterns].sort((a, b) => rankOf(a) - rankOf(b))
  const source = ranked.some((p) => p.kind === 'pattern')
    ? ranked.filter((p) => p.kind === 'pattern')
    : ranked
  const cards: PatternCard[] = source.slice(0, 3).map((p) => ({
    id: p.id,
    label: p.label,
    finding: p.title,
    colorKey: p.evidence.bars[0]?.colorKey ?? 'deficit',
    tree: buildPatternTree(p),
  }))

  // "Sorpréndeme" = el patrón menos obvio (temporal antes que constancia) como
  // conversación; si no hay patrón, reusa el tema más rico disponible.
  const surprisePattern = patterns.find((p) => p.kind === 'pattern') ?? patterns[0] ?? null
  const surprise = surprisePattern
    ? buildPatternTree(surprisePattern, 'Este es el que menos se ve.')
    : trees[available[0]!]
      ? { ...trees[available[0]!]!, topic: 'sorprendeme' as ChatTopic }
      : undefined
  if (surprise) trees.sorprendeme = surprise

  // Apertura de la antesala: gancho CORTO (no un resumen). "Una sola cosa
  // clara" para no abrumar a una usuaria nueva — el detalle vive dentro de la
  // conversación, no aquí. Nunca cuenta "N cosas" (invita al muro).
  const picker: TopicPicker = {
    intro: [
      { text: 'Vi tu mes.', tone: 'accent' },
      { text: 'Encontré algo que no era evidente.', tone: 'strong' },
    ],
    choices: [
      ...available.map((topic) => ({ topic, label: TOPIC_LABEL[topic] })),
      { topic: 'sorprendeme' as ChatTopic, label: TOPIC_LABEL.sorprendeme },
    ],
  }

  // Cerrar el loop: Stelar recuerda lo que dijiste la última vez, en temas y
  // tarjetas por igual. Vacío en el primer mes (no hay pasado → sin callbacks).
  applyPriorCallbacks([...Object.values(trees), ...cards.map((c) => c.tree)], prior)

  return { ready: true, picker, trees, cards }
}

/**
 * Los hallazgos deterministas del mes como frases planas — lo que la Voz de IA
 * EXPLICA (nunca inventa: solo redacta estos hechos con calidez). Se pasan a la
 * edge function stelar-insight como `insights`.
 */
export function monthChatInsights(chat: MonthChat): string[] {
  const out: string[] = []
  // Los hallazgos de las tarjetas primero (son los patrones destacados del mes).
  for (const card of chat.cards) out.push(card.finding)
  for (const topic of Object.keys(chat.trees) as ChatTopic[]) {
    if (topic === 'sorprendeme') continue
    const strong = chat.trees[topic]?.nodes.intro?.bubbles.find((b) => b.tone === 'strong')
    if (strong && !out.includes(strong.text)) out.push(strong.text)
  }
  return out
}
