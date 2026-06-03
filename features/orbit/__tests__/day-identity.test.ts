import { buildDayIdentity, deriveDimensions } from '../logic'
import { mkSig, STRONG } from './signals.fixture'

const identity = (o = {}) => buildDayIdentity(deriveDimensions(mkSig('2026-06-02', o)))

describe('buildDayIdentity — the real Día header', () => {
  test('no signal → "por encender", nothing lit, never a grade', () => {
    const id = buildDayIdentity(deriveDimensions(null))
    expect(id).toEqual({ name: 'Tu día por encender', emphasis: 'por encender', enLuz: 0 })
  })

  test('emphasis is always a substring of name (EmText can italicize it)', () => {
    for (const o of [{}, { trained: true }, STRONG, { energy: 3, meal_count: 2 }]) {
      const id = identity(o)
      expect(id.name).toContain(id.emphasis)
    }
  })

  test('a broadly-lit day reads "encendido" with several en luz', () => {
    const id = identity(STRONG)
    expect(id.emphasis).toBe('encendido')
    expect(id.enLuz).toBeGreaterThanOrEqual(4)
  })

  test('a faintly-lit day names a soft state, not failure', () => {
    // One mild signal — lit enough to count, low enough to stay "naciente".
    const id = identity({ energy: 2 })
    expect(id.enLuz).toBeGreaterThan(0)
    expect(['naciente', 'en marcha']).toContain(id.emphasis)
  })

  test('word reads the LIT dims, never dragged down by floored ones', () => {
    // Two solidly-lit dims (energía media + comida) with the other four at
    // floor. Averaging all six would sink to "naciente" and contradict the
    // "2 en luz" the meta line shows; the word must reflect the lit pair.
    const id = identity({ energy: 3, meal_count: 2 })
    expect(id.enLuz).toBe(2)
    expect(id.emphasis).not.toBe('naciente')
  })
})
