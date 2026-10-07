import {
  describeWeightChange,
  mergeWeightSeries,
  weighInsForTrend,
  weightAxisTicks,
} from '../logic'

const day = (d: number, w: number) => ({ t: Date.UTC(2026, 6, d, 8), weight: w })

describe('describeWeightChange · dice desde cuándo y con cuántas', () => {
  test('con menos de 4 mediciones es medición a medición', () => {
    const c = describeWeightChange([day(2, 70.2), day(14, 71.4)])!
    expect(c).toMatchObject({ abs: 1.2, n: 2, mode: 'raw' })
    expect(c.fromT).toBe(day(2, 0).t)
  })
  test('con 4 o más compara promedios de 7 días (un pesaje suelto no manda)', () => {
    const c = describeWeightChange([day(1, 70), day(10, 70.4), day(25, 70.6), day(30, 72.4)])!
    expect(c.mode).toBe('avg')
    expect(c.n).toBe(4)
    expect(c.abs).toBeCloseTo(1.5, 1) // promedio(70.6, 72.4) − 70
  })
  test('con una sola medición no hay cambio', () => {
    expect(describeWeightChange([day(1, 70)])).toBeNull()
  })
})

test('weighInsForTrend', () => {
  expect(weighInsForTrend(2)).toBe(2)
  expect(weighInsForTrend(6)).toBe(0)
})

test('weightAxisTicks: kilos redondos que cubren todo', () => {
  const t = weightAxisTicks([day(1, 69.9), day(2, 71.4)])
  expect(t[0]).toBeLessThanOrEqual(69.9)
  expect(t[2]).toBeGreaterThanOrEqual(71.4)
  expect(t[1] - t[0]).toBe(t[2] - t[1])
  expect(t.every(Number.isInteger)).toBe(true)
})

test('mergeWeightSeries marca la fuente de cada punto', () => {
  const pts = mergeWeightSeries(
    [{ measured_at: '2026-07-14T09:00:00Z', weight_kg: 71.4 } as never],
    [{ measured_on: '2026-07-10', weight_kg: 71 } as never],
    [{ day_date: '2026-07-12', measured_at: '2026-07-12T07:00:00Z', weight_kg: 71.2 } as never],
  )
  expect(pts.map((p) => p.source)).toEqual(['coach', 'scale', 'app'])
})
