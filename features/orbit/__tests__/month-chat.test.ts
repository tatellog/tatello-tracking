import { buildMonthChat, monthChatReady } from '../month-chat'
import { mkSig } from './signals.fixture'

const CTX = { calorieTarget: 1500, proteinTarget: 120 }

/** N días activos consecutivos desde base, con overrides por día. */
function activeMonth(count: number, override: (i: number) => Record<string, unknown> = () => ({})) {
  const out = []
  for (let i = 0; i < count; i++) {
    const day = `2026-07-${String(i + 1).padStart(2, '0')}`
    out.push(mkSig(day, { calories: 1300, meal_count: 3, sleep_minutes: 450, ...override(i) }))
  }
  return out
}

describe('monthChatReady — estados vacíos (criterios mínimos)', () => {
  it('mes rico (≥14 activos, ≥10 comidas, ≥5 sueño/actividad) → ready', () => {
    expect(monthChatReady(activeMonth(20))).toBe(true)
  })

  it('pocos días activos → NO ready', () => {
    expect(monthChatReady(activeMonth(10))).toBe(false)
  })

  it('días activos pero sin comidas suficientes → NO ready', () => {
    // 16 días solo con sueño, sin comida.
    const signals = activeMonth(16, () => ({ calories: null, meal_count: 0 }))
    expect(monthChatReady(signals)).toBe(false)
  })
})

describe('buildMonthChat — estado vacío', () => {
  it('datos insuficientes → ready false, sin picker ni trees', () => {
    const chat = buildMonthChat(activeMonth(8), CTX)
    expect(chat.ready).toBe(false)
    expect(chat.picker).toBeNull()
    expect(chat.trees).toEqual({})
  })
})

describe('buildMonthChat — picker', () => {
  it('con datos: picker con intro + botón de déficit + sorpréndeme', () => {
    const chat = buildMonthChat(activeMonth(20), CTX)
    expect(chat.ready).toBe(true)
    expect(chat.picker).not.toBeNull()
    const labels = chat.picker!.choices.map((c) => c.label)
    expect(labels).toContain('Mi déficit')
    expect(labels).toContain('Sorpréndeme')
    // La intro nombra cuántas cosas encontró (sin exclamación ni hype).
    expect(chat.picker!.intro[0]!.text).toMatch(/[Ee]ncontré/)
  })
})

describe('buildMonthChat — árbol de déficit', () => {
  it('cuenta los días en déficit y cruza con sueño', () => {
    // 20 días déficit (1300<1500 y ≥900) todos con 450 min de sueño (≥420).
    const chat = buildMonthChat(activeMonth(20), CTX)
    const tree = chat.trees.deficit!
    expect(tree.topic).toBe('deficit')
    expect(tree.nodes.intro!.bubbles[1]!.text).toContain('20 días')
    // El cruce sueño se nombra en el nodo sleepCross.
    expect(tree.nodes.sleepCross!.bubbles[1]!.text).toContain('20 de esos días')
  })

  it('los botones de metacognición guardan una respuesta bajo su clave', () => {
    const chat = buildMonthChat(activeMonth(20), CTX)
    const sleepCross = chat.trees.deficit!.nodes.sleepCross!
    const si = sleepCross.choices!.find((c) => c.label === 'Sí')!
    expect(si.reflection).toEqual({ questionKey: 'deficit_sleep_cross', answer: 'si' })
    const no = sleepCross.choices!.find((c) => c.label === 'No')!
    expect(no.reflection).toEqual({ questionKey: 'deficit_sleep_cross', answer: 'no' })
  })

  it('sin días en déficit → no hay árbol de déficit', () => {
    // Todos superávit (1800 > 1500).
    const signals = activeMonth(20, () => ({ calories: 1800 }))
    const chat = buildMonthChat(signals, CTX)
    expect(chat.trees.deficit).toBeUndefined()
  })

  it('el botón "Ver calendario" abre el calendario como evidencia', () => {
    const chat = buildMonthChat(activeMonth(20), CTX)
    const verCal = chat.trees.deficit!.nodes.sleepCross!.choices!.find(
      (c) => c.label === 'Ver calendario',
    )!
    expect(verCal.action).toEqual({ kind: 'openCalendar' })
  })
})

describe('buildMonthChat — otros temas', () => {
  it('alimentación: proteína en X de Y días con meta', () => {
    // 20 días con proteína 130 (≥120 meta) → hit=20, logged=20.
    const signals = activeMonth(20, () => ({ protein_g: 130 }))
    const chat = buildMonthChat(signals, CTX)
    expect(chat.trees.alimentacion).toBeDefined()
    expect(chat.trees.alimentacion!.nodes.intro!.bubbles[1]!.text).toContain('20 de 20')
  })

  it('sueño y entrenamiento aparecen con datos suficientes', () => {
    const signals = activeMonth(20, () => ({ trained: true, sleep_minutes: 450 }))
    const chat = buildMonthChat(signals, CTX)
    expect(chat.trees.sueno).toBeDefined()
    expect(chat.trees.entrenamiento).toBeDefined()
    expect(chat.trees.entrenamiento!.nodes.intro!.bubbles[1]!.text).toContain('20 días')
  })

  it('la metacognición estándar guarda si/no/nunca', () => {
    const signals = activeMonth(20, () => ({ protein_g: 130 }))
    const notice = buildMonthChat(signals, CTX).trees.alimentacion!.nodes.notice!
    expect(notice.choices!.map((c) => c.reflection?.answer)).toEqual(['si', 'no', 'nunca'])
    expect(notice.choices!.every((c) => c.reflection?.questionKey === 'protein_adherence')).toBe(
      true,
    )
  })

  it('sorpréndeme reusa el tema más rico disponible', () => {
    const chat = buildMonthChat(activeMonth(20), CTX)
    expect(chat.trees.sorprendeme).toBeDefined()
    expect(chat.trees.sorprendeme!.topic).toBe('sorprendeme')
  })

  it('el picker solo lista temas con datos reales (nunca relleno)', () => {
    // Mes con déficit + sueño (para pasar readiness), pero SIN agua ni
    // entreno → esos botones no aparecen.
    const signals = activeMonth(20, () => ({ trained: false, water_glasses: 0 }))
    const chat = buildMonthChat(signals, CTX)
    const topics = chat.picker!.choices.map((c) => c.topic)
    expect(topics).toContain('deficit')
    expect(topics).toContain('sueno')
    expect(topics).not.toContain('entrenamiento')
    expect(topics).not.toContain('agua')
  })
})
