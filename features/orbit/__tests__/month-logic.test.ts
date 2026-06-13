import type { DimensionKey } from '../logic'
import {
  buildEnLuzMes,
  buildMonthEvidence,
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
  test('pocos días → "se forma" + confianza baja', () => {
    const h = buildHistory(BASE, 2, () => ({ energy: 4 }))
    const v = buildVozMes(h, undefined, 2)
    const text = v.parts.map((p) => p.text).join('')
    expect(text).toContain('se forma')
    expect(v.signature.confidence).toBe('baja')
  })

  test('un mes consistente narra EVIDENCIA (días) + confianza alta', () => {
    const h = buildHistory(BASE, 20, () => ({ trained: true, energy: 4 }))
    const v = buildVozMes(h, undefined, 20)
    const text = v.parts.map((p) => p.text).join('')
    expect(text).toMatch(/movimiento apareció en \d+ días/i)
    expect(v.signature.confidence).toBe('alta')
  })

  test('nunca usa tendencia ni causa (PRD)', () => {
    const h = buildHistory(BASE, 20, () => ({ trained: true, energy: 4, sleep_minutes: 450 }))
    const text = buildVozMes(h, undefined, 20)
      .parts.map((p) => p.text)
      .join('')
    expect(text).not.toMatch(/ascenso|aflojando|creciendo|porque|debido a|causó|cuando|mejora por/i)
  })
})

describe('buildEnLuzMes', () => {
  test('el comportamiento más consistente con ≥8 días', () => {
    const h = buildHistory(BASE, 20, (_m, i) => (i < 12 ? { trained: true } : { energy: 3 }))
    const enLuz = buildEnLuzMes(h)
    expect(enLuz).not.toBeNull()
    expect(enLuz!.key).toBe('cuerpo')
    expect(enLuz!.count).toBe(12)
  })

  test('menos de 8 días con cualquier señal → null', () => {
    const h = buildHistory(BASE, 5, () => ({ trained: true }))
    expect(buildEnLuzMes(h)).toBeNull()
  })
})

describe('buildMonthEvidence', () => {
  test('cuenta acumulados: entrenos, comidas, promedios', () => {
    const h = buildHistory(BASE, 10, (_m, i) => ({
      trained: i % 2 === 0,
      meal_count: 3,
      sleep_minutes: 420,
    }))
    const ev = buildMonthEvidence(h)
    expect(ev.daysLogged).toBe(10)
    expect(ev.entrenos).toBe(5) // i par: 0,2,4,6,8
    expect(ev.comidas).toBe(30) // 3 × 10
    expect(ev.sleepAvgMin).toBe(420)
    expect(ev.waterAvg).toBeNull() // nunca se registró agua
  })
})

describe('buildMonthSatellites', () => {
  const idsOf = (h: ReturnType<typeof buildHistory>, days: number) =>
    buildMonthSatellites(buildMonthSummary(h), days).map((s) => s.id)

  test('a thin / empty month invents nothing', () => {
    expect(buildMonthSatellites(buildMonthSummary([]), 0)).toEqual([])
  })

  test('a logged month surfaces the four bodies: brillo, pausa, ancla, señal naciente', () => {
    const h = buildHistory(BASE, 20, () => STRONG)
    const ids = idsOf(h, 20)
    expect(ids).toEqual(expect.arrayContaining(['shine', 'rest', 'anchor', 'watch']))
    expect(ids).toHaveLength(4)
  })

  test('each satellite names a DISTINCT dimension', () => {
    const h = buildHistory(BASE, 20, (_m, i) => ({
      energy: i < 10 ? 2 : 5,
      sleep_minutes: 400,
      meal_count: 3,
    }))
    const captions = buildMonthSatellites(buildMonthSummary(h), 20).map((s) => s.caption)
    expect(new Set(captions).size).toBe(captions.length)
  })

  test('tu señal naciente is tentative and never claims a verdict', () => {
    const h = buildHistory(BASE, 20, () => STRONG)
    const observa = buildMonthSatellites(buildMonthSummary(h), 20).find((s) => s.id === 'watch')
    expect(observa?.kind).toBe('tentative')
    expect(observa?.tentative).toBe(true)
    expect(observa?.label).toBe('tu señal naciente')
  })

  test('a young month (< 8 days) shows brillo at most — the rest need a month', () => {
    const sats = buildMonthSatellites(buildMonthSummary(buildHistory(BASE, 6, () => STRONG)), 6)
    expect(sats.every((s) => s.id === 'shine')).toBe(true)
  })

  test('ciclo is never a pausa/ancla/observa body (it is event-based)', () => {
    const h = buildHistory(BASE, 20, () => STRONG) // no period → ciclo at floor
    const sats = buildMonthSatellites(buildMonthSummary(h), 20)
    for (const s of sats.filter((x) => x.id !== 'shine')) {
      expect(s.caption).not.toBe('tu ciclo')
    }
  })

  test('a satellite never carries a raw number in its label', () => {
    const h = buildHistory(BASE, 20, () => STRONG)
    for (const s of buildMonthSatellites(buildMonthSummary(h), 20)) {
      expect(s.label).not.toMatch(/[0-9]/)
    }
  })
})
