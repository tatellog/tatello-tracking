import { buildMonthChat } from '../month-chat'
import {
  initialTurns,
  nodeChoices,
  onNodeChoice,
  onPickTopic,
  pickerChoices,
} from '../month-chat-flow'
import { mkSig } from './signals.fixture'

const CTX = { calorieTarget: 1500, proteinTarget: 120 }

function activeMonth(count: number, override: (i: number) => Record<string, unknown> = () => ({})) {
  const out = []
  for (let i = 0; i < count; i++) {
    const day = `2026-07-${String(i + 1).padStart(2, '0')}`
    out.push(
      mkSig(day, {
        calories: 1300,
        protein_g: 130,
        meal_count: 3,
        sleep_minutes: 450,
        ...override(i),
      }),
    )
  }
  return out
}

const chat = buildMonthChat(activeMonth(20), CTX)

describe('initialTurns', () => {
  it('arranca con un turno de Stelar con la intro', () => {
    const t = initialTurns([{ text: 'Hola.' }])
    expect(t).toEqual([{ who: 'stelar', bubbles: [{ text: 'Hola.' }] }])
  })
})

describe('pickerChoices / nodeChoices', () => {
  it('el picker: todos los botones primarios', () => {
    const choices = pickerChoices(chat)
    expect(choices.length).toBeGreaterThan(0)
    expect(choices.every((c) => c.primary)).toBe(true)
    expect(choices.map((c) => c.label)).toContain('Mi déficit')
  })

  it('nodeChoices marca primario=avanza, secundario=metacognición (end)', () => {
    // Nodo con metacognición (alimentación.notice): sí/no/nunca son 'end' → secundarios.
    const tree = chat.trees.alimentacion!
    const notice = nodeChoices(tree, 'notice')!
    expect(notice.every((c) => !c.primary)).toBe(true)
    // El intro tiene "Sigue" (goto) → primario.
    const intro = nodeChoices(tree, 'intro')!
    expect(intro[0]!.primary).toBe(true)
  })

  it('nodo terminal (sin choices) → null', () => {
    // Un patrón con "why" deja un nodo terminal. Construimos uno con forma temporal.
    const signals = activeMonth(28, (i) => {
      const wd = new Date(`2026-07-${String(i + 1).padStart(2, '0')}T00:00:00Z`).getUTCDay()
      const wknd = wd === 0 || wd === 6
      return { calories: wknd ? 1800 : 1250, trained: !wknd }
    })
    const sorp = buildMonthChat(signals, CTX).trees.sorprendeme
    if (sorp?.nodes.why) expect(nodeChoices(sorp, 'why')).toBeNull()
  })
})

describe('onPickTopic', () => {
  it('anexa la respuesta de la usuaria + la apertura del árbol, y entra al nodo', () => {
    const r = onPickTopic(chat, 'deficit', 'Mi déficit')!
    expect(r.append[0]).toEqual({ who: 'user', text: 'Mi déficit' })
    expect(r.append[1]!.who).toBe('stelar')
    expect(r.flow).toEqual({ kind: 'node', topic: 'deficit', nodeId: 'intro' })
  })

  it('tema inexistente → null (no rompe)', () => {
    expect(onPickTopic(chat, 'ciclo' as never, 'x')).toBeNull()
  })
})

describe('onNodeChoice', () => {
  const tree = chat.trees.deficit!

  it('goto sin reflexión ("Sigue"): NO ecoa burbuja de usuaria, solo avanza', () => {
    const sigue = tree.nodes.intro!.choices![0]!
    const r = onNodeChoice(tree, sigue)
    // "Sigue" es avance puro → el hilo no se ensucia con un eco de la usuaria.
    expect(r.append.every((t) => t.who === 'stelar')).toBe(true)
    expect(r.flow).toEqual({ kind: 'node', topic: 'deficit', nodeId: 'sleepCross' })
    expect(r.openCalendar).toBeUndefined()
  })

  it('openCalendar: pide abrir el calendario, queda en done', () => {
    const verCal = tree.nodes.sleepCross!.choices!.find((c) => c.label === 'Ver calendario')!
    const r = onNodeChoice(tree, verCal)
    expect(r.openCalendar).toBe(true)
    expect(r.flow).toEqual({ kind: 'done' })
  })

  it('metacognición (end): devuelve la reflexión a persistir, queda en done', () => {
    const no = tree.nodes.sleepCross!.choices!.find((c) => c.label === 'No')!
    const r = onNodeChoice(tree, no)
    expect(r.reflection).toEqual({ questionKey: 'deficit_sleep_cross', answer: 'no' })
    expect(r.flow).toEqual({ kind: 'done' })
    expect(r.openCalendar).toBeUndefined()
  })
})
