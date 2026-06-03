import type { DailySignals } from '../api'
import { detectMonthPatterns } from '../month-patterns'

function makeSignals(perDay: (wd: number) => Partial<DailySignals>): DailySignals[] {
  const base = new Date('2026-05-04T00:00:00Z') // Monday
  const out: DailySignals[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(base.getTime())
    d.setUTCDate(d.getUTCDate() + i)
    const date = d.toISOString().slice(0, 10)
    const wd = (d.getUTCDay() + 6) % 7
    out.push({ day: date, ...perDay(wd) } as unknown as DailySignals)
  }
  return out
}

describe('detectMonthPatterns', () => {
  test('too little month → nothing', () => {
    expect(detectMonthPatterns([])).toEqual([])
  })

  test('training cadence — trains on weekdays, rests weekends', () => {
    const sigs = makeSignals((wd) => ({ trained: wd < 5 }))
    const p = detectMonthPatterns(sigs).find((x) => x.id === 'training-cadence')
    expect(p).toBeDefined()
    expect(p!.title).toBe('Tu semana de movimiento')
    expect(p!.legend).toContain('entre semana')
  })

  test('no training → no cadence pattern', () => {
    const p = detectMonthPatterns(makeSignals(() => ({ trained: false }))).find(
      (x) => x.id === 'training-cadence',
    )
    expect(p).toBeUndefined()
  })

  test('weekly shape — weekdays brighter than weekends', () => {
    // Energy + sleep + mood drive brightness; weekdays high, weekends low.
    const sigs = makeSignals((wd) =>
      wd < 5
        ? {
            energy: 5,
            motivation: 5,
            sleep_minutes: 480,
            sleep_quality: 5,
            mood: 'good',
            meal_count: 3,
          }
        : {
            energy: 1,
            motivation: 1,
            sleep_minutes: 360,
            sleep_quality: 2,
            mood: 'struggle',
            meal_count: 1,
          },
    )
    const p = detectMonthPatterns(sigs).find((x) => x.id === 'weekly-shape')
    expect(p).toBeDefined()
    expect(p!.title).toBe('Tu semana tiene una forma')
    expect(p!.legend).toContain('afloja')
  })

  test('flat week (no weekday/weekend difference) → no shape pattern', () => {
    const sigs = makeSignals(() => ({
      energy: 3,
      motivation: 3,
      sleep_minutes: 420,
      mood: 'neutral',
      meal_count: 2,
    }))
    expect(detectMonthPatterns(sigs).find((x) => x.id === 'weekly-shape')).toBeUndefined()
  })

  test('copy — no clinical / guilt words anywhere', () => {
    const sigs = makeSignals((wd) => ({
      trained: wd < 5,
      energy: wd < 5 ? 5 : 1,
      sleep_minutes: wd < 5 ? 480 : 360,
      mood: wd < 5 ? 'good' : 'struggle',
      meal_count: 2,
    }))
    for (const p of detectMonthPatterns(sigs)) {
      const blob =
        `${p.title} ${p.detail} ${p.legend} ${p.voz} ${p.correlacion} ${p.experimento.hint}`.toLowerCase()
      for (const banned of [
        'atracón',
        'atracon',
        'trastorno',
        'culpa',
        'debes',
        'tienes que',
        'te pasaste',
      ]) {
        expect(blob).not.toContain(banned)
      }
    }
  })
})
