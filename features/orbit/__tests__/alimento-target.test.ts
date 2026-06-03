import { dailyReadingCategory, deriveDimensions } from '../logic'
import { mkSig } from './signals.fixture'

const TARGET = { calorieTarget: 1600, proteinTarget: 130 }
const alimento = (sig: ReturnType<typeof mkSig>, ctx?: typeof TARGET) =>
  deriveDimensions(sig, ctx).find((d) => d.key === 'alimento')!.brightness

describe('alimento brightness — deficit-aware when targets are set', () => {
  test('no target → falls back to the meal-count read', () => {
    expect(alimento(mkSig('2026-06-01', { meal_count: 3 }))).toBeGreaterThan(0.9)
  })

  test('within the calorie target + protein hit → fully alight', () => {
    const b = alimento(
      mkSig('2026-06-01', { calories: 1400, protein_g: 130, meal_count: 3 }),
      TARGET,
    )
    expect(b).toBeGreaterThan(0.9)
  })

  test('far over the target → dims to the floor (the deficit is gone)', () => {
    const b = alimento(
      mkSig('2026-06-01', { calories: 3200, protein_g: 100, meal_count: 5 }),
      TARGET,
    )
    expect(b).toBeLessThan(0.2)
  })

  test('protein hit but over calories → still dim (no deficit, no weight loss)', () => {
    const hit = alimento(
      mkSig('2026-06-01', { calories: 2400, protein_g: 130, meal_count: 4 }),
      TARGET,
    )
    expect(hit).toBeLessThan(0.4)
  })

  test('eating MORE meals over target reads DIMMER than a clean deficit day', () => {
    const deficit = alimento(
      mkSig('2026-06-01', { calories: 1500, protein_g: 130, meal_count: 3 }),
      TARGET,
    )
    const overeat = alimento(
      mkSig('2026-06-01', { calories: 3400, protein_g: 110, meal_count: 5 }),
      TARGET,
    )
    expect(overeat).toBeLessThan(deficit)
  })
})

describe('dailyReadingCategory — over-target reading', () => {
  const opts = { isPrePeriod: false, proteinTarget: 130, calorieTarget: 1600 }

  test('notably over the target → "overTarget" (even with protein hit)', () => {
    const s = mkSig('2026-06-01', { calories: 3200, protein_g: 130, meal_count: 5 })
    expect(dailyReadingCategory(s, opts)).toBe('overTarget')
  })

  test('within the target + protein hit → not overTarget (proteinCared)', () => {
    const s = mkSig('2026-06-01', { calories: 1400, protein_g: 130, meal_count: 3 })
    expect(dailyReadingCategory(s, opts)).toBe('proteinCared')
  })

  test('no calorie target → never overTarget', () => {
    const s = mkSig('2026-06-01', { calories: 3200, protein_g: 100, meal_count: 5 })
    expect(dailyReadingCategory(s, { isPrePeriod: false, proteinTarget: 130 })).not.toBe(
      'overTarget',
    )
  })
})
