/*
 * Órbita Mes IA · ensamblado de la experiencia de descubrimiento del mes.
 *
 * La promesa: "hacer visible lo invisible". La antesala abre con un gancho
 * corto (título + subtítulo) y muestra los HALLAZGOS (findings.ts) como tarjetas
 * que abren su detalle guiado (FindingView). Todo determinístico: los números y
 * la estructura salen del motor; la IA solo redacta.
 *
 * (Rediseño jul 2026: se retiró el modelo de chat/árboles + topic picker; la
 * experiencia es descubrimiento guiado sobre `Finding`, no conversación.)
 */
import { buildFindings, type Finding } from './findings'
import type { DailySignals } from './api'
import type { PriorReflections } from './reflections'

/** Una burbuja de la apertura (título/subtítulo de la antesala). */
export type ChatBubble = { text: string; tone?: 'accent' | 'strong' }

export type MonthChatCtx = {
  calorieTarget?: number | null
  proteinTarget?: number | null
}

export type MonthChat = {
  /** false → estado vacío ("todavía estoy aprendiendo"): sin datos para una
   *  lectura honesta. */
  ready: boolean
  /** Apertura de la antesala: gancho corto (no un chat). */
  intro: ChatBubble[]
  /** Los hallazgos del mes (ordenados por confianza). */
  cards: Finding[]
}

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

/** ¿Hay datos suficientes para una lectura honesta? (spec: estados vacíos.) */
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

/**
 * Arma la experiencia del mes: la apertura + los hallazgos. Si no hay datos
 * suficientes o el motor no encontró nada, `ready=false` → estado vacío.
 */
export function buildMonthChat(
  signals: readonly DailySignals[],
  ctx: MonthChatCtx = {},
  prior: PriorReflections = {},
): MonthChat {
  if (!monthChatReady(signals)) return { ready: false, intro: [], cards: [] }
  const cards = buildFindings(signals, ctx, prior)
  if (cards.length === 0) return { ready: false, intro: [], cards: [] }
  // Copy de PRIORIDAD (no "encontré 6 patrones"): 1 hallazgo principal + N
  // observaciones. Comunica que la IA eligió lo importante, no listó todo.
  const secondary = cards.length - 1
  const secText =
    secondary <= 0 ? '' : ` · ${secondary} ${secondary === 1 ? 'observación' : 'observaciones'}`
  return {
    ready: true,
    intro: [
      { text: `Analicé tus últimos ${signals.length} días.`, tone: 'accent' },
      { text: `1 hallazgo principal${secText}`, tone: 'strong' },
    ],
    cards,
  }
}

/** Los hallazgos como frases planas — lo que la Voz de IA EXPLICA (nunca
 *  inventa). Para la edge function stelar-insight como `insights`. */
export function monthChatInsights(chat: MonthChat): string[] {
  return chat.cards.map((f) => f.title)
}
