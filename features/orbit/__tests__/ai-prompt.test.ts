import { buildPeriodContext } from '../context'
import {
  buildInsightPrompt,
  fnv1aHex,
  hashContext,
  PROMPT_VERSION,
  stableStringify,
} from '../ai-prompt'
import { mkSig } from './signals.fixture'

describe('stableStringify — canónico, orden-independiente', () => {
  it('el mismo objeto con distinto orden de claves produce el mismo string', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }))
  })
  it('anida arrays y objetos', () => {
    expect(stableStringify({ x: [3, { z: 1, y: 2 }] })).toBe('{"x":[3,{"y":2,"z":1}]}')
  })
})

describe('hashContext — fingerprint estable', () => {
  it('misma entrada → mismo hash; cambio mínimo → hash distinto', () => {
    const a = { period: 'week', nutrition: { avgCalories: 1600 } }
    const b = { period: 'week', nutrition: { avgCalories: 1601 } }
    expect(hashContext(a)).toBe(hashContext(a))
    expect(hashContext(a)).not.toBe(hashContext(b))
  })
  it('es hex de 8 chars', () => {
    expect(fnv1aHex('stelar')).toMatch(/^[0-9a-f]{8}$/)
  })
  it('el orden de claves no cambia el hash (la clave del caché es estable)', () => {
    expect(hashContext({ a: 1, b: 2 })).toBe(hashContext({ b: 2, a: 1 }))
  })
})

describe('buildInsightPrompt — guardrails y contrato', () => {
  const ctx = buildPeriodContext({
    period: 'month',
    signals: [
      mkSig('2026-07-01', { calories: 1400, protein_g: 120, meal_count: 3, trained: true }),
      mkSig('2026-07-02', { calories: 1450, protein_g: 110, meal_count: 3 }),
    ],
    calorieTarget: 1600,
  })

  it('el system prompt prohíbe recetar/diagnosticar y exige el JSON de voz', () => {
    const { system } = buildInsightPrompt({ feature: 'orbita_mes', context: ctx })
    expect(system).toMatch(/NUNCA/)
    expect(system).toMatch(/debes comer/)
    expect(system).toMatch(/diagnóstico/i)
    // Contrato de salida = VozParte.
    expect(system).toContain('"voz"')
    expect(system).toMatch(/accent/)
  })

  it('el user prompt lleva el contexto agregado, NO registros raw', () => {
    const { user } = buildInsightPrompt({ feature: 'orbita_mes', context: ctx })
    expect(user).toContain('agregados')
    // No debe filtrar la estructura de una fila cruda (p. ej. meal_count por día).
    expect(user).toContain(stableStringify(ctx))
  })

  it('incluye los hallazgos determinísticos cuando se pasan', () => {
    const { user } = buildInsightPrompt({
      feature: 'orbita_mes',
      context: ctx,
      insights: ['La proteína apareció constante', 'Los viernes bajó el registro'],
    })
    expect(user).toContain('La proteína apareció constante')
    expect(user).toContain('el sistema ya detectó')
  })

  it('expone PROMPT_VERSION para el caché', () => {
    const { promptVersion } = buildInsightPrompt({ feature: 'orbita_dia', context: ctx })
    expect(promptVersion).toBe(PROMPT_VERSION)
  })
})
