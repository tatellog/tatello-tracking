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
import { daysInDeficit } from './month-built'
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

export type MonthChat = {
  /** false → estado vacío ("todavía estoy aprendiendo"): no hay datos para
   *  una conversación honesta. */
  ready: boolean
  picker: TopicPicker | null
  trees: Partial<Record<ChatTopic, ChatTree>>
}

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
        { text: 'Pero eso no fue lo más interesante.', tone: 'accent' },
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

/**
 * Arma la conversación del mes: el picker + los árboles disponibles (solo los
 * que tienen datos reales). Fase 1: déficit implementado; los otros temas se
 * agregan igual. `ready=false` → la UI muestra el estado vacío.
 */
export function buildMonthChat(
  signals: readonly DailySignals[],
  ctx: MonthChatCtx = {},
): MonthChat {
  if (!monthChatReady(signals)) return { ready: false, picker: null, trees: {} }

  const trees: Partial<Record<ChatTopic, ChatTree>> = {}
  const deficit = buildDeficitTree(signals, ctx)
  if (deficit) trees.deficit = deficit

  // "Sorpréndeme" siempre disponible si hay al menos un árbol real: reusa el
  // tema con más señal (fase 1: déficit). Se enriquecerá en la fase 2.
  const available = Object.keys(trees) as ChatTopic[]
  const n = available.length
  if (n === 0) return { ready: false, picker: null, trees: {} }

  const picker: TopicPicker = {
    intro: [
      {
        text:
          n === 1
            ? 'Encontré algo que no era evidente.'
            : `Encontré ${n} cosas que no eran evidentes.`,
      },
      { text: '¿Con cuál quieres empezar?', tone: 'accent' },
    ],
    choices: [
      ...available.map((topic) => ({ topic, label: TOPIC_LABEL[topic] })),
      { topic: 'sorprendeme' as ChatTopic, label: TOPIC_LABEL.sorprendeme },
    ],
  }
  // Sorpréndeme apunta (fase 1) al árbol de mayor señal disponible.
  trees.sorprendeme = deficit ? { ...deficit, topic: 'sorprendeme' } : undefined

  return { ready: true, picker, trees }
}
