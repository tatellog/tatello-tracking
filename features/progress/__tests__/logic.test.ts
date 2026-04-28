import {
  computeDelta,
  computeTrend,
  computeYDomain,
  formatTrendCopy,
  toWeightPoints,
} from '@/features/progress/logic'

import type { BodyMeasurement } from '@/features/brief/api'

const DAY_MS = 24 * 60 * 60 * 1000
const T0 = new Date('2026-04-01T09:00:00Z').getTime()

function buildMeasurement(overrides: Partial<BodyMeasurement>): BodyMeasurement {
  return {
    id: overrides.id ?? Math.random().toString(),
    user_id: 'mock-user',
    measured_at: overrides.measured_at ?? new Date(T0).toISOString(),
    weight_kg: overrides.weight_kg ?? null,
    waist_cm: null,
    chest_cm: null,
    hip_cm: null,
    thigh_cm: null,
    arm_cm: null,
    created_at: overrides.measured_at ?? new Date(T0).toISOString(),
    ...overrides,
  }
}

describe('toWeightPoints', () => {
  it('drops measurements without a weight reading', () => {
    const list = [
      buildMeasurement({ weight_kg: 78 }),
      buildMeasurement({ weight_kg: null }),
      buildMeasurement({ weight_kg: 76 }),
    ]
    expect(toWeightPoints(list).map((p) => p.weight)).toEqual([78, 76])
  })

  it('sorts ascending by timestamp regardless of input order', () => {
    const later = new Date(T0 + 5 * DAY_MS).toISOString()
    const list = [
      buildMeasurement({ weight_kg: 76, measured_at: later }),
      buildMeasurement({ weight_kg: 78, measured_at: new Date(T0).toISOString() }),
    ]
    const points = toWeightPoints(list)
    expect(points[0]?.weight).toBe(78)
    expect(points[1]?.weight).toBe(76)
  })
})

describe('computeDelta', () => {
  it('returns null with fewer than two points', () => {
    expect(computeDelta([])).toBeNull()
    expect(computeDelta([{ t: T0, weight: 78 }])).toBeNull()
  })

  it('computes signed delta and percentage relative to the first weight', () => {
    const delta = computeDelta([
      { t: T0, weight: 78 },
      { t: T0 + 30 * DAY_MS, weight: 76.2 },
    ])
    expect(delta).toEqual({ abs: -1.8, pct: -2.3, days: 30 })
  })

  it('rounds days to whole numbers', () => {
    const delta = computeDelta([
      { t: T0, weight: 78 },
      { t: T0 + 7 * DAY_MS + 12 * 60 * 60 * 1000, weight: 77 },
    ])
    expect(delta?.days).toBe(8)
  })
})

describe('computeYDomain', () => {
  it('adds a buffer above and below the data range', () => {
    const [lo, hi] = computeYDomain([
      { t: T0, weight: 76 },
      { t: T0 + DAY_MS, weight: 78 },
    ])
    expect(lo).toBeLessThan(76)
    expect(hi).toBeGreaterThan(78)
  })

  it('handles a single-value series with a fixed buffer', () => {
    const [lo, hi] = computeYDomain([{ t: T0, weight: 76 }])
    expect(hi - lo).toBeCloseTo(1)
  })

  it('does not anchor to zero', () => {
    const [lo] = computeYDomain([
      { t: T0, weight: 76 },
      { t: T0 + DAY_MS, weight: 78 },
    ])
    expect(lo).toBeGreaterThan(70)
  })
})

describe('computeTrend', () => {
  it('returns null with fewer than three points', () => {
    expect(computeTrend([])).toBeNull()
    expect(computeTrend([{ t: T0, weight: 78 }])).toBeNull()
    expect(
      computeTrend([
        { t: T0, weight: 78 },
        { t: T0 + DAY_MS, weight: 77 },
      ]),
    ).toBeNull()
  })

  it('detects a clear downward trend', () => {
    const trend = computeTrend([
      { t: T0 + 0 * DAY_MS, weight: 78.0 },
      { t: T0 + 7 * DAY_MS, weight: 77.6 },
      { t: T0 + 14 * DAY_MS, weight: 77.2 },
      { t: T0 + 21 * DAY_MS, weight: 76.8 },
    ])
    expect(trend?.direction).toBe('down')
    expect(trend?.weeklyChange).toBeCloseTo(-0.4, 1)
  })

  it('detects flat when noise is below threshold', () => {
    const trend = computeTrend([
      { t: T0 + 0 * DAY_MS, weight: 76.0 },
      { t: T0 + 7 * DAY_MS, weight: 76.05 },
      { t: T0 + 14 * DAY_MS, weight: 76.0 },
      { t: T0 + 21 * DAY_MS, weight: 76.02 },
    ])
    expect(trend?.direction).toBe('flat')
  })
})

describe('formatTrendCopy', () => {
  it('describes a sustainable down trend', () => {
    const copy = formatTrendCopy({ direction: 'down', weeklyChange: -0.3 })
    expect(copy).toMatch(/bajando/i)
    expect(copy).toMatch(/0\.3 kg\/semana/)
    expect(copy).toMatch(/sostenible/i)
  })

  it('warns when descent is aggressive', () => {
    const copy = formatTrendCopy({ direction: 'down', weeklyChange: -0.7 })
    expect(copy).toMatch(/agresivo/i)
    expect(copy).toMatch(/masa muscular/i)
  })

  it('describes a slow up trend without alarming language', () => {
    const copy = formatTrendCopy({ direction: 'up', weeklyChange: 0.1 })
    expect(copy).toMatch(/subiendo/i)
    expect(copy).toMatch(/lento/i)
  })

  it('describes flat trend as estable', () => {
    const copy = formatTrendCopy({ direction: 'flat', weeklyChange: 0.02 })
    expect(copy).toMatch(/estable/i)
  })
})
