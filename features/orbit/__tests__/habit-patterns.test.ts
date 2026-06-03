import type { DailySignals } from '../api'
import { detectHabitPatterns } from '../habit-patterns'

/** 35 consecutive days from a Monday; `perDay` fills fields by weekday. */
function makeSignals(perDay: (wd: number) => Partial<DailySignals>): DailySignals[] {
  const base = new Date('2026-05-04T00:00:00Z') // Monday
  const out: DailySignals[] = []
  for (let i = 0; i < 35; i++) {
    const d = new Date(base.getTime())
    d.setUTCDate(d.getUTCDate() + i)
    const date = d.toISOString().slice(0, 10)
    const wd = (d.getUTCDay() + 6) % 7
    out.push({ day: date, ...perDay(wd) } as unknown as DailySignals)
  }
  return out
}

const titles = (sigs: DailySignals[]): string[] => detectHabitPatterns(sigs).map((p) => p.title)

describe('detectHabitPatterns', () => {
  test('under a week of data → nothing', () => {
    expect(detectHabitPatterns([])).toEqual([])
  })

  test('weekday tension — a high-stress weekday surfaces, focused right', () => {
    const sigs = makeSignals((wd) => ({ stress: wd === 2 ? 5 : 2 }))
    const p = detectHabitPatterns(sigs).find((x) => x.id.startsWith('weekday-tension'))
    expect(p).toBeDefined()
    expect(p!.title).toBe('¿Los miércoles pesan distinto?')
    expect(p!.data.kind === 'weekday' && p!.data.focus).toBe(2)
  })

  test('flat stress → no tension pattern', () => {
    expect(titles(makeSignals(() => ({ stress: 3 })))).not.toContain(
      '¿Los miércoles pesan distinto?',
    )
  })

  test('weekend food — Sat/Sun ask for clearly more', () => {
    const sigs = makeSignals((wd) => ({ calories: wd >= 5 ? 3200 : 1500 }))
    const p = detectHabitPatterns(sigs).find((x) => x.id === 'weekend-food')
    expect(p).toBeDefined()
    expect(p!.data.kind).toBe('paired')
    if (p!.data.kind === 'paired') {
      const [wd, we] = p!.data.groups
      expect(we!.avg).toBeGreaterThan(wd!.avg)
    }
  })

  test('even calories weekday vs weekend → no weekend-food pattern', () => {
    expect(titles(makeSignals(() => ({ calories: 1800 })))).not.toContain('¿El finde pide más?')
  })

  test('low-sleep weekday — a short-sleep day surfaces, focused right', () => {
    const sigs = makeSignals((wd) => ({ sleep_minutes: wd === 4 ? 300 : 480 }))
    const p = detectHabitPatterns(sigs).find((x) => x.id.startsWith('low-sleep'))
    expect(p).toBeDefined()
    expect(p!.title).toBe('¿Los viernes duermes menos?')
    expect(p!.data.kind === 'weekday' && p!.data.focus).toBe(4)
  })

  test('even sleep → no low-sleep pattern', () => {
    expect(titles(makeSignals(() => ({ sleep_minutes: 450 })))).not.toContain(
      '¿Los viernes duermes menos?',
    )
  })

  test('copy — no clinical / guilt words anywhere', () => {
    const sigs = makeSignals((wd) => ({
      stress: wd === 2 ? 5 : 2,
      calories: wd >= 5 ? 3200 : 1500,
      sleep_minutes: wd === 4 ? 300 : 480,
    }))
    for (const p of detectHabitPatterns(sigs)) {
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
