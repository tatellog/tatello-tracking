import type { DailySignals } from '../api'
import { buildDayReadings, type DayCard, type DayReadingContext } from '../day-readings'

const CTX: DayReadingContext = { calorieTarget: 2000, proteinTarget: 120, waterGoalGlasses: 8 }
const sig = (o: Partial<DailySignals>): DailySignals =>
  ({ day: '2026-06-03', ...o }) as unknown as DailySignals

const card = (cards: DayCard[], key: string): DayCard | undefined =>
  cards.find((c) => c.key === key)
const metric = (c: DayCard | undefined, key: string) => c?.metrics.find((m) => m.key === key)

describe('buildDayReadings', () => {
  test('no signals → nothing', () => {
    expect(buildDayReadings(null, CTX)).toEqual([])
  })

  test('a quiet day with nothing logged → no cards', () => {
    expect(buildDayReadings(sig({}), CTX)).toEqual([])
  })

  test('protein: grams + win when reached', () => {
    const m = metric(
      card(buildDayReadings(sig({ meal_count: 2, protein_g: 60 }), CTX), 'comida'),
      'protein',
    )
    expect(m?.value).toBe('60 / 120 g')
    expect(m?.tone).toBe('context')
    expect(m?.fill).toBeCloseTo(0.5)

    const won = metric(
      card(buildDayReadings(sig({ meal_count: 3, protein_g: 130 }), CTX), 'comida'),
      'protein',
    )
    expect(won?.tone).toBe('win')
  })

  test('calories within target → figure + "de X kcal", quiet tone', () => {
    const m = metric(
      card(buildDayReadings(sig({ meal_count: 3, calories: 1600 }), CTX), 'comida'),
      'cal',
    )
    expect(m?.value).toBe('1600')
    expect(m?.sub).toBe('de 2000 kcal')
    expect(m?.tone).toBe('context')
  })

  test('OVER the deficit → honest delta "+340 sobre tu objetivo" in gold-tone, never guilt', () => {
    const comida = card(buildDayReadings(sig({ meal_count: 5, calories: 2340 }), CTX), 'comida')
    const m = metric(comida, 'cal')
    expect(m?.value).toBe('+340')
    expect(m?.sub).toBe('sobre tu objetivo')
    expect(m?.tone).toBe('over')
    expect(m?.over).toBeGreaterThan(0)
    // The number is honest; the voice stays warm; never a "te pasaste" verdict.
    expect(comida?.coach).not.toMatch(/pasaste|de más|fallaste/i)
  })

  test('way over → the coach asks gently', () => {
    const comida = card(buildDayReadings(sig({ meal_count: 5, calories: 3200 }), CTX), 'comida')
    expect(comida?.coach).toBe('Hoy el cuerpo pidió más. ¿Algo pasó?')
  })

  test('deficit verdict — clear "En déficit" / "Fuera del déficit"', () => {
    const inside = card(buildDayReadings(sig({ meal_count: 3, calories: 1600 }), CTX), 'comida')
    expect(inside?.status).toEqual({ text: 'En déficit', tone: 'context' })
    const out = card(buildDayReadings(sig({ meal_count: 5, calories: 2340 }), CTX), 'comida')
    expect(out?.status).toEqual({ text: 'Fuera del déficit', tone: 'over' })
    // No verdict without calorie data.
    expect(
      card(buildDayReadings(sig({ meal_count: 2, protein_g: 60 }), CTX), 'comida')?.status,
    ).toBeUndefined()
  })

  test('water: glasses progress; gone quiet at 0', () => {
    expect(
      metric(card(buildDayReadings(sig({ water_glasses: 6 }), CTX), 'agua'), 'water')?.value,
    ).toBe('6 / 8 vasos')
    expect(card(buildDayReadings(sig({ water_glasses: 0 }), CTX), 'agua')).toBeUndefined()
  })

  test('cuerpo: training chip + sleep figure (no bar — sleep is not a goal)', () => {
    const c = card(buildDayReadings(sig({ trained: true, sleep_minutes: 432 }), CTX), 'cuerpo')
    expect(metric(c, 'train')?.display).toBe('chip')
    const sleep = metric(c, 'sleep')
    expect(sleep?.display).toBe('plain')
    expect(sleep?.value).toBe('7.2 h')
    expect(sleep?.fill).toBeUndefined()
  })

  test('bienestar: energy dots + cycle chip', () => {
    const c = card(buildDayReadings(sig({ energy: 4, on_period: true }), CTX), 'bienestar')
    expect(metric(c, 'energy')?.dots).toBe(4)
    expect(metric(c, 'cycle')?.value).toBe('En tu periodo')
    expect(c?.coach).toContain('en alza')
  })

  test('cards only appear when they have content', () => {
    expect(buildDayReadings(sig({ trained: true }), CTX).map((c) => c.key)).toEqual(['cuerpo'])
  })
})
