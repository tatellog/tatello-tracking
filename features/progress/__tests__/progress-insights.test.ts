import type { DailySignals } from '@/features/orbit/api'

import {
  generateProgressInsights,
  hashProgressInsights,
  type ProgressInsightInput,
} from '../insights'

const sig = (day: string, protein: number): DailySignals =>
  ({ day, protein_g: protein }) as DailySignals

/** Día YYYY-MM-DD, `back` días antes del today fijo (2026-07-31). */
const day = (back: number) => {
  const dt = new Date(2026, 6, 31 - back, 12)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const base: ProgressInsightInput = {
  today: '2026-07-31',
  weights: [],
  composition: [],
  signals: [],
  proteinTarget: 120,
  photoDays: [],
}

describe('generateProgressInsights — determinístico, sin IA (Epic 03)', () => {
  it('RECOMPOSICIÓN: peso estable + grasa bajando → insight con números reales', () => {
    const input: ProgressInsightInput = {
      ...base,
      weights: [
        { day: day(40), kg: 78.2 },
        { day: day(25), kg: 78.4 },
        { day: day(10), kg: 78.0 },
        { day: day(1), kg: 78.1 },
      ],
      composition: [
        { day: day(40), fatPct: 31.4, leanKg: null },
        { day: day(2), fatPct: 30.1, leanKg: null },
      ],
    }
    const out = generateProgressInsights(input)
    const r = out.find((i) => i.id === 'recomposition')!
    expect(r).toBeDefined()
    expect(r.support).toContain('31.4%')
    expect(r.support).toContain('30.1%')
    expect(r.relatedMetrics).toEqual(['weight', 'body_fat'])
  })

  it('NO inventa recomposición si la grasa no bajó lo suficiente', () => {
    const input: ProgressInsightInput = {
      ...base,
      weights: [
        { day: day(40), kg: 78.2 },
        { day: day(20), kg: 78.3 },
        { day: day(1), kg: 78.1 },
      ],
      composition: [
        { day: day(40), fatPct: 31.0, leanKg: null },
        { day: day(2), fatPct: 30.8, leanKg: null }, // −0.2pp: ruido, no cambio
      ],
    }
    expect(generateProgressInsights(input).find((i) => i.id === 'recomposition')).toBeUndefined()
  })

  it('PROTEÍNA+MÚSCULO: proteína sostenida + masa magra que se mantiene', () => {
    const signals = Array.from({ length: 14 }, (_, i) => sig(day(i + 1), i < 10 ? 130 : 90))
    const input: ProgressInsightInput = {
      ...base,
      signals,
      composition: [
        { day: day(40), fatPct: null, leanKg: 48.0 },
        { day: day(2), fatPct: null, leanKg: 48.1 },
      ],
    }
    const p = generateProgressInsights(input).find((i) => i.id === 'protein-muscle')!
    expect(p).toBeDefined()
    expect(p.support).toContain('10 de 14')
  })

  it('TENDENCIA a la baja: mejora como hecho, con northLink', () => {
    const input: ProgressInsightInput = {
      ...base,
      weights: [
        { day: day(35), kg: 80.0 },
        { day: day(25), kg: 79.2 },
        { day: day(12), kg: 78.5 },
        { day: day(1), kg: 77.8 },
      ],
    }
    const t = generateProgressInsights(input).find((i) => i.id === 'weight-trend')!
    expect(t.lead).toContain('bajando')
    expect(t.northLink).not.toBeNull()
  })

  it('TENDENCIA al alza: retroceso SIN culpa (información, no juicio)', () => {
    const input: ProgressInsightInput = {
      ...base,
      weights: [
        { day: day(35), kg: 77.0 },
        { day: day(25), kg: 77.8 },
        { day: day(12), kg: 78.6 },
        { day: day(1), kg: 79.1 },
      ],
    }
    const t = generateProgressInsights(input).find((i) => i.id === 'weight-trend')!
    expect(t.lead).toContain('información')
    expect(t.lead).not.toMatch(/culpa|fallaste|mal|retroced/i)
  })

  it('EVIDENCIA FOTOGRÁFICA: fotos que abarcan un cambio ≥1.5 kg', () => {
    const input: ProgressInsightInput = {
      ...base,
      weights: [
        { day: day(42), kg: 80.5 },
        { day: day(30), kg: 79.6 },
        { day: day(12), kg: 78.9 },
        { day: day(1), kg: 78.2 },
      ],
      photoDays: [day(42), day(1)],
    }
    const f = generateProgressInsights(input).find((i) => i.id === 'photo-evidence')!
    expect(f).toBeDefined()
    expect(f.support).toContain('−2.3 kg')
  })

  it('sin datos → sin insights (silencio honesto)', () => {
    expect(generateProgressInsights(base)).toEqual([])
  })
})

describe('hashProgressInsights — llave de caché (Epic 04)', () => {
  const mk = (kg: number): ProgressInsightInput => ({
    ...base,
    weights: [
      { day: day(35), kg: 80.0 },
      { day: day(25), kg: 79.2 },
      { day: day(12), kg: 78.5 },
      { day: day(1), kg },
    ],
  })

  it('estable para los mismos insights; cambia cuando cambia lo mostrado', () => {
    const a = hashProgressInsights(generateProgressInsights(mk(77.8)))
    const b = hashProgressInsights(generateProgressInsights(mk(77.8)))
    const c = hashProgressInsights(generateProgressInsights(mk(77.2)))
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })
})
