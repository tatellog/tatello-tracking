import type { DimensionKey } from '../logic'
import {
  buildMonthSatellites,
  buildMonthSummary,
  buildVozMes,
  monthTheme,
  type DimensionMonth,
} from '../month-logic'
import { buildHistory, STRONG } from './signals.fixture'

const BASE = '2026-04-01'
const pick = (s: readonly DimensionMonth[], key: DimensionKey) => s.find((d) => d.key === key)!

describe('buildMonthSummary', () => {
  test('empty → six dims, all flat at the floor', () => {
    const s = buildMonthSummary([])
    expect(s).toHaveLength(6)
    for (const d of s) {
      expect(d.trend).toBe('flat')
      expect(d.avg).toBeCloseTo(0.14, 2)
    }
  })

  test('a dimension rising across the month reads as up', () => {
    const h = buildHistory(BASE, 20, (_m, i) => ({ energy: i < 10 ? 2 : 5 }))
    const e = pick(buildMonthSummary(h), 'energia')
    expect(e.trend).toBe('up')
    expect(e.delta).toBeGreaterThan(0)
  })

  test('a dimension falling across the month reads as down', () => {
    const h = buildHistory(BASE, 20, (_m, i) => ({ sleep_minutes: i < 10 ? 450 : 300 }))
    expect(pick(buildMonthSummary(h), 'sueno').trend).toBe('down')
  })

  test('a steady dimension reads as flat', () => {
    const h = buildHistory(BASE, 20, () => ({ energy: 4 }))
    expect(pick(buildMonthSummary(h), 'energia').trend).toBe('flat')
  })
})

describe('monthTheme', () => {
  test('barely any data → formación', () => {
    const h = buildHistory(BASE, 2, () => ({ energy: 4 }))
    expect(monthTheme(buildMonthSummary(h), 2)).toBe('formación')
  })

  test('several dimensions rising → ascenso', () => {
    const h = buildHistory(BASE, 20, (_m, i) =>
      i < 10
        ? { energy: 2, sleep_minutes: 300, meal_count: 1 }
        : { energy: 5, sleep_minutes: 450, meal_count: 3 },
    )
    expect(monthTheme(buildMonthSummary(h), 20)).toBe('ascenso')
  })

  test('several dimensions falling → descenso', () => {
    const h = buildHistory(BASE, 20, (_m, i) =>
      i < 10
        ? { energy: 5, sleep_minutes: 450, meal_count: 3 }
        : { energy: 2, sleep_minutes: 300, meal_count: 1 },
    )
    expect(monthTheme(buildMonthSummary(h), 20)).toBe('descenso')
  })
})

describe('buildVozMes', () => {
  test('a forming month → "se forma" + low confidence', () => {
    const h = buildHistory(BASE, 2, () => ({ energy: 4 }))
    const v = buildVozMes(buildMonthSummary(h), 2)
    const text = v.parts.map((p) => p.text).join('')
    expect(text).toContain('se forma')
    expect(v.signature.confidence).toBe('baja')
  })

  test('a full month names a movement + high confidence', () => {
    const h = buildHistory(BASE, 20, (_m, i) =>
      i < 10 ? { energy: 2 } : { energy: 5, mood: 'good', stress: 1, motivation: 5 },
    )
    const v = buildVozMes(buildMonthSummary(h), 20)
    const text = v.parts.map((p) => p.text).join('')
    expect(text).toMatch(/viene (creciendo|aflojando)/)
    expect(v.signature.confidence).toBe('alta')
  })
})

describe('buildMonthSatellites', () => {
  const idsOf = (h: ReturnType<typeof buildHistory>, days: number) =>
    buildMonthSatellites(buildMonthSummary(h), days).map((s) => s.id)

  test('a thin / empty month invents nothing', () => {
    expect(buildMonthSatellites(buildMonthSummary([]), 0)).toEqual([])
  })

  test('a bright steady month surfaces brillo (peak) + ancla (stable)', () => {
    const h = buildHistory(BASE, 20, () => STRONG)
    const sats = buildMonthSatellites(buildMonthSummary(h), 20)
    const brillo = sats.find((s) => s.id === 'brillo')
    expect(brillo?.kind).toBe('peak')
    expect(sats.some((s) => s.id === 'ancla')).toBe(true)
    // No trend, full month → no calma, no tentative observa.
    expect(sats.some((s) => s.id === 'calma' || s.id === 'observa')).toBe(false)
  })

  test('a full month with a downward dimension (separate from the brightest) surfaces a confirmed calma', () => {
    // alimento steady-high (the brillo), energía declining (the calma).
    const h = buildHistory(BASE, 20, (_m, i) => ({ meal_count: 3, energy: i < 10 ? 5 : 2 }))
    const ids = idsOf(h, 20)
    expect(ids).toContain('calma')
    expect(ids).not.toContain('observa')
  })

  test('a rising dimension (separate from the brightest) surfaces tu impulso', () => {
    // alimento steady-high (brillo), energía climbing (impulso).
    const h = buildHistory(BASE, 20, (_m, i) => ({ meal_count: 3, energy: i < 10 ? 2 : 5 }))
    const sats = buildMonthSatellites(buildMonthSummary(h), 20)
    const impulso = sats.find((s) => s.id === 'impulso')
    expect(impulso?.kind).toBe('rising')
    expect(sats.some((s) => s.id === 'calma')).toBe(false)
  })

  test('a month with both a rise and a fall surfaces impulso AND calma', () => {
    const h = buildHistory(BASE, 20, (_m, i) => ({
      meal_count: 3,
      energy: i < 10 ? 2 : 5, // up
      sleep_minutes: i < 10 ? 450 : 300, // down
    }))
    const ids = buildMonthSatellites(buildMonthSummary(h), 20).map((s) => s.id)
    expect(ids).toContain('impulso')
    expect(ids).toContain('calma')
  })

  test('low confidence makes a movement TENTATIVE (stelar observa, not calma)', () => {
    const h = buildHistory(BASE, 10, (_m, i) => ({ meal_count: 3, energy: i < 5 ? 2 : 5 }))
    const sats = buildMonthSatellites(buildMonthSummary(h), 10)
    const observa = sats.find((s) => s.id === 'observa')
    expect(observa?.kind).toBe('tentative')
    expect(observa?.tentative).toBe(true)
    expect(sats.some((s) => s.id === 'calma')).toBe(false)
  })

  test('a satellite never carries a raw number in its label', () => {
    const h = buildHistory(BASE, 20, () => STRONG)
    for (const s of buildMonthSatellites(buildMonthSummary(h), 20)) {
      expect(s.label).not.toMatch(/[0-9]/)
    }
  })
})
