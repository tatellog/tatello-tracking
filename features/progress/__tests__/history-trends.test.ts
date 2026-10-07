import { historyTrends } from '../logic'

const sig = (day: string, o: Record<string, unknown> = {}) =>
  ({ day, calories: null, protein_g: null, trained: null, meal_count: null, ...o }) as never

const ctx = { today: '2026-10-07', calorieTarget: 1500, proteinTarget: 120 }

describe('historyTrends · números con denominador', () => {
  // Periodo actual: 8 sep – 7 oct. 4 días con comida, 3 en déficit.
  const cur = [
    sig('2026-10-06', { calories: 1300, protein_g: 130, trained: true }), // martes
    sig('2026-10-05', { calories: 1400, protein_g: 100 }), // lunes
    sig('2026-10-04', { calories: 1350, protein_g: 90, trained: true }), // domingo
    sig('2026-09-20', { calories: 2100, protein_g: 60 }),
  ]

  test('déficit de tus días con comida, con el lado de la semana', () => {
    const t = historyTrends(cur, ctx)
    expect(t.deficit).toMatchObject({ value: 3, denom: 4, prev: null })
    expect(t.deficit!.highlight).toBe('Tus días en déficit fueron sobre todo entre semana.')
  })

  test('"antes" solo con 5+ días con dato', () => {
    const prev = Array.from({ length: 5 }, (_, i) =>
      sig(`2026-08-${String(10 + i).padStart(2, '0')}`, { calories: 1400, protein_g: 80 }),
    )
    const t = historyTrends([...cur, ...prev], ctx)
    expect(t.deficit!.prev).toEqual({ value: 5, denom: 5 })
    expect(t.protein!.prevAvg).toBe(80)
    expect(historyTrends([...cur, ...prev.slice(0, 2)], ctx).protein!.prevAvg).toBeNull()
  })

  test('registro, proteína y entreno', () => {
    const t = historyTrends(cur, ctx)
    expect(t.logging).toMatchObject({ value: 4, denom: 30 })
    expect(t.logging.highlight).toContain('(3 días)')
    expect(t.protein).toMatchObject({ avg: 95, n: 4, inTarget: 1, gap: 25 })
    expect(t.workouts.value).toBe(2)
    expect(t.workouts.weeks).toHaveLength(4)
    expect(t.workouts.weeks[3]!.days).toBe(2)
    expect(t.range.label).toBe('8 sep – 7 oct')
  })
})

test('summary nombra solo lo que mejoró contra el mes pasado', () => {
  const prev = [sig('2026-08-20', { calories: 1400 })]
  const cur = [
    sig('2026-10-06', { calories: 1300, trained: true }),
    sig('2026-10-05', { calories: 1400 }),
  ]
  const t = historyTrends([...cur, ...prev], ctx)
  expect(t.improved).toMatchObject({ logging: true, workouts: true })
  expect(t.summary).toBe('Este mes registraste comida y entrenaste más que el mes pasado.')
  expect(historyTrends(prev, ctx).summary).toBeNull()
})
