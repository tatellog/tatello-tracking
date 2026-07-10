import { buildMonthChat, monthChatInsights, monthChatReady } from '../month-chat'
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
    const signals = activeMonth(16, () => ({ calories: null, meal_count: 0 }))
    expect(monthChatReady(signals)).toBe(false)
  })
})

describe('buildMonthChat', () => {
  it('datos insuficientes → ready false, razón insufficient-data', () => {
    const chat = buildMonthChat(activeMonth(8), CTX)
    expect(chat.ready).toBe(false)
    expect(chat.reason).toBe('insufficient-data')
    expect(chat.cards).toEqual([])
    expect(chat.intro).toEqual([])
  })

  it('datos suficientes pero sin patrón → ready false, razón no-findings', () => {
    // 16 días activos (pasa el gate), pero TODO en superávit constante y sin
    // entreno/agua → ningún detector dispara → cards vacío por falta de patrón,
    // no por falta de datos.
    const flat = activeMonth(16, () => ({ calories: 2500, trained: false, water_glasses: 2 }))
    const chat = buildMonthChat(flat, CTX)
    expect(chat.ready).toBe(false)
    expect(chat.reason).toBe('no-findings')
    expect(chat.cards).toEqual([])
  })

  it('con datos y patrón → ready, razón null', () => {
    const chat = buildMonthChat(activeMonth(20), CTX)
    expect(chat.ready).toBe(true)
    expect(chat.reason).toBeNull()
  })

  it('con datos: apertura de UNA línea que ancla en sus días (sin tally)', () => {
    const chat = buildMonthChat(activeMonth(20), CTX)
    expect(chat.ready).toBe(true)
    expect(chat.intro).toHaveLength(1)
    expect(chat.intro[0]!.text).toMatch(/Esto es lo que vi en tus últimos \d+ días/)
    expect(chat.cards.length).toBeGreaterThan(0)
    for (const f of chat.cards) {
      expect(f.title.length).toBeGreaterThan(0)
      expect(f.confidence).toBeGreaterThanOrEqual(0)
      expect(f.confidence).toBeLessThanOrEqual(100)
      expect(f.metacognition.options).toHaveLength(3)
    }
  })

  it('los hallazgos vienen ordenados por confianza (el más sólido primero)', () => {
    const chat = buildMonthChat(activeMonth(20), CTX)
    const conf = chat.cards.map((f) => f.confidence)
    expect(conf).toEqual([...conf].sort((a, b) => b - a))
  })

  it('monthChatInsights devuelve los títulos de los hallazgos (para la IA)', () => {
    const chat = buildMonthChat(activeMonth(20), CTX)
    expect(monthChatInsights(chat)).toEqual(chat.cards.map((f) => f.title))
  })
})
