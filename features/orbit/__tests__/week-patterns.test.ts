import { detectWeekPatterns } from '../week-patterns'
import { buildHistory, LOW, MODERATE, STRONG } from './signals.fixture'

const BASE = '2026-04-01'

describe('detectWeekPatterns — guards', () => {
  test('empty history → no patterns', () => {
    expect(detectWeekPatterns([])).toEqual([])
  })

  test('fewer than 7 days → no patterns', () => {
    const h = buildHistory(BASE, 5, () => MODERATE)
    expect(detectWeekPatterns(h)).toEqual([])
  })

  test('a uniform 5-week history → no weekday pattern (false-positive guard)', () => {
    const h = buildHistory(BASE, 35, () => MODERATE)
    const res = detectWeekPatterns(h)
    expect(res.some((p) => p.id.startsWith('weekday-'))).toBe(false)
  })
})

describe('weekday dip', () => {
  test('a consistently low Thursday surfaces a low pattern, no spurious high', () => {
    const h = buildHistory(BASE, 35, (mon) => (mon === 3 ? LOW : MODERATE))
    const res = detectWeekPatterns(h)

    const low = res.find((p) => p.id === 'weekday-low-3')
    expect(low).toBeDefined()
    expect(low!.category).toBe('recurrencia')
    expect(low!.title).toMatch(/pesan más/)
    expect(low!.data.kind).toBe('weekday')
    if (low!.data.kind === 'weekday') expect(low!.data.focus).toBe(3)
    expect(low!.confidence).toBe('alta') // 5 Thursdays

    expect(res.some((p) => p.id.startsWith('weekday-high'))).toBe(false)
  })
})

describe('weekday peak', () => {
  test('a consistently bright Monday surfaces a high pattern', () => {
    const h = buildHistory(BASE, 35, (mon) => (mon === 0 ? STRONG : MODERATE))
    const res = detectWeekPatterns(h)

    const high = res.find((p) => p.id === 'weekday-high-0')
    expect(high).toBeDefined()
    expect(high!.category).toBe('comparacion')
    expect(high!.title).toMatch(/brillan/)
    if (high!.data.kind === 'weekday') expect(high!.data.focus).toBe(0)

    expect(res.some((p) => p.id.startsWith('weekday-low'))).toBe(false)
  })
})

describe('train ↔ sleep', () => {
  test('trained days sleeping more surface a paired pattern, in hours', () => {
    const h = buildHistory(BASE, 28, (_mon, i) =>
      i % 2 === 0 ? { trained: true, sleep_minutes: 480 } : { trained: false, sleep_minutes: 420 },
    )
    const res = detectWeekPatterns(h)

    const ts = res.find((p) => p.id === 'train-sleep')
    expect(ts).toBeDefined()
    expect(ts!.category).toBe('correlacion')
    expect(ts!.data.kind).toBe('paired')
    if (ts!.data.kind === 'paired') {
      expect(ts!.data.groups[0]!.avg).toBeCloseTo(8.0, 1)
      expect(ts!.data.groups[1]!.avg).toBeCloseTo(7.0, 1)
    }
  })

  test('a negligible sleep gap → no paired pattern', () => {
    const h = buildHistory(BASE, 28, (_mon, i) =>
      i % 2 === 0 ? { trained: true, sleep_minutes: 450 } : { trained: false, sleep_minutes: 445 },
    )
    expect(detectWeekPatterns(h).some((p) => p.id === 'train-sleep')).toBe(false)
  })

  test('too few trained days → no paired pattern', () => {
    const h = buildHistory(BASE, 28, (_mon, i) =>
      i < 2 ? { trained: true, sleep_minutes: 480 } : { trained: false, sleep_minutes: 420 },
    )
    expect(detectWeekPatterns(h).some((p) => p.id === 'train-sleep')).toBe(false)
  })
})
