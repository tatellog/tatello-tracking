import { computeFacts } from '../facts'
import type { Fact } from '../engine-types'
import { mkSig } from './signals.fixture'

const byKind = (facts: Fact[]) => Object.fromEntries(facts.map((f) => [f.kind, f]))

describe('computeFacts — registros → hechos agregados (Facts Engine)', () => {
  it('sin señales → sin hechos', () => {
    expect(computeFacts({ period: 'month', signals: [], calorieTarget: 1500 })).toEqual([])
  })

  it('produce los hechos base con evidenceCount honesto y el periodo real', () => {
    // 20 días: 12 en déficit (1200), 8 no (1800); todos con comida; 10 entrenos.
    const signals = []
    for (let i = 0; i < 20; i++) {
      const day = `2026-07-${String(i + 1).padStart(2, '0')}`
      signals.push(mkSig(day, { calories: i < 12 ? 1200 : 1800, meal_count: 3, trained: i < 10 }))
    }
    const f = byKind(computeFacts({ period: 'month', signals, calorieTarget: 1500 }))

    expect(f.deficit_days!.value).toBe(12)
    expect(f.deficit_days!.evidenceCount).toBe(20) // denominador = días con comida
    expect(f.workout_days!.value).toBe(10)
    expect(f.days_logged!.value).toBe(20)
    expect(f.avg_calories).toBeDefined()
    // Sin sueño ni peso registrados → NO se inventan esos hechos.
    expect(f.avg_sleep_minutes).toBeUndefined()
    expect(f.weight_change_kg).toBeUndefined()
    // El periodo sale del rango real de fechas.
    expect(f.deficit_days!.period).toEqual({ start: '2026-07-01', end: '2026-07-20' })
  })

  it('emite sueño solo si hay noches, y peso solo con ≥2 pesajes', () => {
    const signals = [
      mkSig('2026-07-01', { calories: 1200, meal_count: 2, sleep_minutes: 450, weight_kg: 70 }),
      mkSig('2026-07-02', { calories: 1300, meal_count: 2, sleep_minutes: 400 }),
      mkSig('2026-07-03', { calories: 1400, meal_count: 2, weight_kg: 69.5 }),
    ]
    const f = byKind(computeFacts({ period: 'week', signals, calorieTarget: 1500 }))

    expect(f.avg_sleep_minutes!.value).toBe(425) // (450+400)/2
    expect(f.avg_sleep_minutes!.evidenceCount).toBe(2) // 2 noches
    expect(f.days_slept_7h!.value).toBe(1) // solo 450 ≥ 420
    expect(f.weight_change_kg!.value).toBe(-0.5) // 69.5 − 70
    expect(f.weight_change_kg!.evidenceCount).toBe(2)
  })

  it('sin target de calorías → sin surplus_days y deficit_days = 0', () => {
    const facts = computeFacts({
      period: 'day',
      signals: [mkSig('2026-07-01', { calories: 1200, meal_count: 2 })],
    })
    const kinds = facts.map((x) => x.kind)
    expect(kinds).toContain('days_logged')
    expect(kinds).not.toContain('surplus_days')
    expect(facts.find((x) => x.kind === 'deficit_days')?.value).toBe(0)
  })
})
