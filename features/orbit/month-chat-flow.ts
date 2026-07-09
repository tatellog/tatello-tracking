/*
 * Órbita Mes IA · la MÁQUINA DE ESTADOS del chat, pura y testeable.
 *
 * Separada de la UI (MonthChatView) para respetar SRP: aquí vive el "caminar"
 * la conversación (elegir tema, ramificar en un nodo, nodos terminales, la
 * metacognición que dispara un guardado), sin React ni estilos. La UI solo
 * renderiza el hilo y despacha estas transiciones. Los efectos (guardar
 * reflexión, abrir calendario) se DEVUELVEN como datos; la UI los ejecuta.
 */
import type { ChatBubble, ChatChoice, ChatTopic, ChatTree, MonthChat } from './month-chat'

/** Un turno del hilo: lo que dijo Stelar, o lo que respondió la usuaria. */
export type Turn = { who: 'stelar'; bubbles: readonly ChatBubble[] } | { who: 'user'; text: string }

/** Dónde está la conversación. */
export type Flow =
  | { kind: 'picker' }
  | { kind: 'node'; topic: ChatTopic; nodeId: string }
  | { kind: 'done' }

/** Un botón a renderizar (label + jerarquía visual). */
export type FlowChoice = { label: string; primary: boolean }

/** El turno inicial: Stelar abre con la intro (IA si llegó, si no la
 *  determinista — lo decide el caller). */
export function initialTurns(intro: readonly ChatBubble[]): Turn[] {
  return [{ who: 'stelar', bubbles: intro }]
}

/** Los botones del picker de temas — todos primarios (avanzan a un árbol). */
export function pickerChoices(chat: MonthChat): FlowChoice[] {
  return (chat.picker?.choices ?? []).map((c) => ({ label: c.label, primary: true }))
}

/** Los botones de un nodo, o null si es terminal (sin choices → la UI ofrece
 *  "Ver otra cosa"). Primario = avanza (goto/openCalendar); secundario = las
 *  ramas de metacognición (end). */
export function nodeChoices(tree: ChatTree, nodeId: string): FlowChoice[] | null {
  const node = tree.nodes[nodeId]
  if (!node?.choices) return null
  return node.choices.map((c) => ({ label: c.label, primary: c.action.kind !== 'end' }))
}

/** Transición: la usuaria elige un tema. Devuelve los turnos a anexar (su
 *  respuesta + la apertura de Stelar del árbol) y el nuevo flujo, o null si el
 *  tema no existe. */
export function onPickTopic(
  chat: MonthChat,
  topic: ChatTopic,
  label: string,
): { append: Turn[]; flow: Flow } | null {
  const tree = chat.trees[topic]
  const entry = tree?.nodes[tree.entry]
  if (!tree || !entry) return null
  return {
    append: [
      { who: 'user', text: label },
      { who: 'stelar', bubbles: entry.bubbles },
    ],
    flow: { kind: 'node', topic, nodeId: tree.entry },
  }
}

export type NodeChoiceResult = {
  append: Turn[]
  flow: Flow
  /** Metacognición a persistir (si el botón la llevaba). */
  reflection?: { questionKey: string; answer: string }
  /** La UI debe llevar a la evidencia del calendario. */
  openCalendar?: boolean
}

/** Transición: la usuaria elige dentro de un nodo. Devuelve su respuesta +
 *  la siguiente burbuja de Stelar, el flujo, y los efectos (guardado /
 *  calendario) como DATOS para que la UI los ejecute. */
export function onNodeChoice(tree: ChatTree, choice: ChatChoice): NodeChoiceResult {
  const userTurn: Turn = { who: 'user', text: choice.label }
  const reflection = choice.reflection
  const a = choice.action
  if (a.kind === 'goto') {
    const next = tree.nodes[a.node]
    return {
      append: next ? [userTurn, { who: 'stelar', bubbles: next.bubbles }] : [userTurn],
      flow: next ? { kind: 'node', topic: tree.topic, nodeId: a.node } : { kind: 'done' },
      reflection,
    }
  }
  if (a.kind === 'openCalendar') {
    return {
      append: [
        userTurn,
        { who: 'stelar', bubbles: [{ text: 'Ahí está, en tu calendario abajo.', tone: 'accent' }] },
      ],
      flow: { kind: 'done' },
      reflection,
      openCalendar: true,
    }
  }
  return {
    append: [userTurn, { who: 'stelar', bubbles: [{ text: 'Listo, lo dejé anotado.' }] }],
    flow: { kind: 'done' },
    reflection,
  }
}
